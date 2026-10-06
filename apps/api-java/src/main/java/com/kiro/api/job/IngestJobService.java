package com.kiro.api.job;

import com.kiro.api.ai.AiServiceClient;
import jakarta.annotation.PostConstruct;
import jakarta.annotation.PreDestroy;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.atomic.AtomicBoolean;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

/**
 * Redis-backed embed queue — Java replacement for the BullMQ {@code ingestion} queue.
 * Same semantics: idempotent job per version ({@code embed-version-{id}}), 4 attempts,
 * exponential backoff (5s base), concurrency 4, DLQ after exhaustion, stats endpoint.
 *
 * Data structures:
 *   kiro:jobs:embed            LIST   ready jobs (JSON {"versionId":...})
 *   kiro:jobs:embed:delayed    ZSET   retries, score = run-at epoch millis
 *   kiro:jobs:embed:seen        SET    idempotency (job ids currently queued/leased)
 *   kiro:jobs:embed:attempts    HASH   job id -> attempts made
 *   kiro:jobs:embed:dlq         LIST   dead letters, capped at 5000
 */
@Service
public class IngestJobService {

  private static final Logger log = LoggerFactory.getLogger(IngestJobService.class);

  static final String READY = "kiro:jobs:embed";
  static final String DELAYED = "kiro:jobs:embed:delayed";
  static final String SEEN = "kiro:jobs:embed:seen";
  static final String ATTEMPTS = "kiro:jobs:embed:attempts";
  static final String DLQ = "kiro:jobs:embed:dlq";
  static final int MAX_ATTEMPTS = 4;
  static final long BACKOFF_BASE_MS = 5_000;
  static final int CONCURRENCY = 4;
  static final int EMBED_BATCH = 24;

  private final StringRedisTemplate redis;
  private final JdbcTemplate jdbc;
  private final AiServiceClient ai;
  private final ExecutorService workers = Executors.newFixedThreadPool(CONCURRENCY);
  private final AtomicBoolean running = new AtomicBoolean(true);

  public IngestJobService(StringRedisTemplate redis, JdbcTemplate jdbc, AiServiceClient ai) {
    this.redis = redis;
    this.jdbc = jdbc;
    this.ai = ai;
  }

  @PostConstruct
  void start() {
    for (int i = 0; i < CONCURRENCY; i++) {
      workers.submit(this::loop);
    }
    log.info("Embed queue workers ready (concurrency={})", CONCURRENCY);
  }

  @PreDestroy
  void stop() {
    running.set(false);
    workers.shutdownNow();
  }

  /** Idempotent enqueue — mirrors jobId: embed-version-{versionId}. */
  public void enqueueEmbedVersion(String versionId) {
    String jobId = "embed-version-" + versionId;
    Long added = redis.opsForSet().add(SEEN, jobId);
    if (added != null && added == 0) return; // already queued/leased
    redis.opsForHash().put(ATTEMPTS, jobId, "0");
    redis.opsForList().rightPush(READY, "{\"versionId\":\"" + versionId + "\"}");
  }

  public Map<String, Object> queueStats() {
    Map<String, Object> stats = new HashMap<>();
    stats.put("waiting", len(READY));
    stats.put("delayed", zlen(DELAYED));
    stats.put("failed", len(DLQ));
    stats.put("active", 0);
    stats.put("completed", "-");
    return stats;
  }

  public List<Map<String, Object>> failedJobs(int limit) {
    List<String> items = redis.opsForList().range(DLQ, 0, Math.max(0, limit - 1));
    List<Map<String, Object>> out = new ArrayList<>();
    if (items == null) return out;
    for (String item : items) {
      out.add(Map.of("id", item, "name", "embed-version", "data", item));
    }
    return out;
  }

  // ---- worker ----

  private void loop() {
    while (running.get() && !Thread.currentThread().isInterrupted()) {
      try {
        String job = redis.opsForList().leftPop(READY, Duration.ofSeconds(2));
        if (job == null) continue;
        handle(job);
      } catch (Exception e) {
        if (!running.get()) return;
        log.warn("Embed worker pop failed: {}", e.toString());
      }
    }
  }

  /** Promotes due delayed retries every second. */
  @Scheduled(fixedDelay = 1000)
  void promoteDelayed() {
    try {
      long now = Instant.now().toEpochMilli();
      Set<String> due = redis.opsForZSet().rangeByScore(DELAYED, 0, now, 0, 100);
      if (due == null || due.isEmpty()) return;
      for (String job : due) {
        redis.opsForZSet().remove(DELAYED, job);
        redis.opsForList().rightPush(READY, job);
      }
    } catch (Exception e) {
      log.debug("Delayed promotion skipped: {}", e.toString());
    }
  }

  private void handle(String jobJson) {
    String versionId = jobJson.replaceAll(".*\"versionId\"\\s*:\\s*\"([^\"]+)\".*", "$1");
    String jobId = "embed-version-" + versionId;
    try {
      embedVersion(versionId);
      redis.opsForSet().remove(SEEN, jobId);
      redis.opsForHash().delete(ATTEMPTS, jobId);
    } catch (Exception e) {
      int attempts = attemptsOf(jobId) + 1;
      redis.opsForHash().put(ATTEMPTS, jobId, String.valueOf(attempts));
      if (attempts >= MAX_ATTEMPTS) {
        log.error("Embed job {} failed permanently: {}", jobId, e.toString());
        redis.opsForList().rightPush(DLQ, jobJson + " :: " + e);
        redis.opsForList().trim(DLQ, 0, 4999);
        redis.opsForSet().remove(SEEN, jobId);
      } else {
        long delay = BACKOFF_BASE_MS * (1L << (attempts - 1));
        redis.opsForZSet().add(DELAYED, jobJson, Instant.now().toEpochMilli() + delay);
      }
    }
  }

  /** Embeds all un-embedded chunks of a version in batches of 24 (mirrors ingestion.processor). */
  void embedVersion(String versionId) {
    List<ChunkRow> pending = jdbc.query(
        "SELECT \"id\", \"content\" FROM \"document_chunks\" WHERE \"documentVersionId\" = ? AND \"embedding\" IS NULL ORDER BY \"id\"",
        (rs, i) -> new ChunkRow(rs.getString(1), rs.getString(2)), versionId);
    for (int i = 0; i < pending.size(); i += EMBED_BATCH) {
      List<ChunkRow> batch = pending.subList(i, Math.min(pending.size(), i + EMBED_BATCH));
      List<String> texts = batch.stream().map(ChunkRow::content).toList();
      var result = ai.embedTexts(texts);
      for (int j = 0; j < batch.size(); j++) {
        String literal = toVectorLiteral(result.embeddings().get(j));
        jdbc.update("UPDATE \"document_chunks\" SET \"embedding\" = (?::vector) WHERE \"id\" = ?",
            literal, batch.get(j).id());
      }
    }
  }

  private int attemptsOf(String jobId) {
    Object v = redis.opsForHash().get(ATTEMPTS, jobId);
    try {
      return v == null ? 0 : Integer.parseInt(v.toString());
    } catch (NumberFormatException e) {
      return 0;
    }
  }

  private long len(String key) {
    Long v = redis.opsForList().size(key);
    return v == null ? 0 : v;
  }

  private long zlen(String key) {
    Long v = redis.opsForZSet().zCard(key);
    return v == null ? 0 : v;
  }

  static String toVectorLiteral(List<Double> vector) {
    StringBuilder sb = new StringBuilder("[");
    for (int i = 0; i < vector.size(); i++) {
      if (i > 0) sb.append(',');
      double d = vector.get(i);
      if (!Double.isFinite(d)) throw new IllegalArgumentException("Non-finite embedding value");
      sb.append(d);
    }
    return sb.append(']').toString();
  }

  record ChunkRow(String id, String content) {}

  /** For tests: run one job synchronously. */
  public Future<?> submitTestJob(String jobJson) {
    return workers.submit(() -> handle(jobJson));
  }
}
