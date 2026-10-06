package com.kiro.api.common;

import com.kiro.api.ai.AiServiceClient;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.concurrent.Callable;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.TimeoutException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
class HealthController {

  private final JdbcTemplate jdbc;
  private final org.springframework.data.redis.core.StringRedisTemplate redis;
  private final AiServiceClient ai;

  HealthController(
      JdbcTemplate jdbc,
      org.springframework.data.redis.core.StringRedisTemplate redis,
      AiServiceClient ai) {
    this.jdbc = jdbc;
    this.redis = redis;
    this.ai = ai;
  }

  /** Compat health endpoint (same shape as NestJS). AI is optional → degraded, not down. */
  @GetMapping("/health")
  public Map<String, Object> health() {
    Map<String, Object> checks = new LinkedHashMap<>();
    checks.put("db", check(() -> {
      jdbc.queryForObject("SELECT 1", Integer.class);
      return null;
    }, 2000));
    checks.put("redis", check(() -> {
      redis.getConnectionFactory().getConnection().ping();
      return null;
    }, 2000));
    checks.put("ai", check(() -> {
      ai.status();
      return null;
    }, 3000));
    boolean degraded = checks.values().stream().anyMatch(c -> "error".equals(((Map<?, ?>) c).get("status")));
    Map<String, Object> out = new LinkedHashMap<>();
    out.put("status", degraded ? "degraded" : "ok");
    out.put("service", "kiro-api");
    out.put("timestamp", java.time.Instant.now().toString());
    out.put("checks", checks);
    return out;
  }

  private Map<String, Object> check(Callable<Void> fn, long timeoutMs) {
    long start = System.currentTimeMillis();
    Map<String, Object> result = new LinkedHashMap<>();
    Future<Void> f = Executors.newSingleThreadExecutor().submit(fn);
    try {
      f.get(timeoutMs, TimeUnit.MILLISECONDS);
      result.put("status", "ok");
    } catch (InterruptedException | ExecutionException | TimeoutException e) {
      result.put("status", "error");
      result.put("error", String.valueOf(e.getMessage()));
    } finally {
      f.cancel(true);
    }
    result.put("latencyMs", System.currentTimeMillis() - start);
    return result;
  }
}
