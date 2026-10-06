package com.kiro.api.common;

import io.micrometer.core.instrument.Counter;
import io.micrometer.core.instrument.MeterRegistry;
import io.micrometer.core.instrument.Timer;
import java.lang.management.ManagementFactory;
import java.util.HashMap;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicLong;
import java.util.concurrent.atomic.LongAdder;
import org.springframework.stereotype.Service;

/**
 * In-memory counters/latencies backing the frontend-compatible {@code GET /metrics}
 * JSON shape, mirrored into Micrometer for {@code /actuator/prometheus}.
 */
@Service
public class MetricsService {

  private final MeterRegistry registry;
  private final Map<String, LongAdder> counters = new ConcurrentHashMap<>();
  private final Map<String, Latency> latencies = new ConcurrentHashMap<>();
  private final long startedAt = System.currentTimeMillis();

  public MetricsService(MeterRegistry registry) {
    this.registry = registry;
  }

  public void increment(String name) {
    increment(name, 1);
  }

  public void increment(String name, long amount) {
    counters.computeIfAbsent(name, k -> new LongAdder()).add(amount);
    Counter.builder("kiro_" + name.replace('.', '_')).register(registry).increment(amount);
  }

  public void recordLatency(String name, long millis, boolean error) {
    latencies.computeIfAbsent(name, k -> new Latency()).record(millis, error);
    Timer.builder("kiro_" + name.replace('.', '_')).register(registry)
        .record(millis, TimeUnit.MILLISECONDS);
  }

  public Map<String, Object> snapshot() {
    Map<String, Long> c = new HashMap<>();
    counters.forEach((k, v) -> c.put(k, v.sum()));
    Map<String, Map<String, Object>> l = new HashMap<>();
    latencies.forEach((k, v) -> l.put(k, v.snapshot()));
    return Map.of(
        "counters", c,
        "latencies", l,
        "uptimeSeconds", (System.currentTimeMillis() - startedAt) / 1000);
  }

  public String prometheus() {
    StringBuilder sb = new StringBuilder();
    counters.forEach((k, v) -> {
      String name = "kiro_" + k.replace('.', '_') + "_total";
      sb.append("# TYPE ").append(name).append(" counter\n").append(name).append(' ').append(v.sum()).append('\n');
    });
    latencies.forEach((k, v) -> {
      String base = "kiro_" + k.replace('.', '_');
      var snap = v.snapshot();
      sb.append("# TYPE ").append(base).append("_count counter\n").append(base).append("_count ")
          .append(snap.get("count")).append('\n');
      sb.append("# TYPE ").append(base).append("_avg_ms gauge\n").append(base).append("_avg_ms ")
          .append(snap.get("avgMs")).append('\n');
      sb.append("# TYPE ").append(base).append("_errors_total counter\n").append(base)
          .append("_errors_total ").append(snap.get("errors")).append('\n');
    });
    sb.append("# TYPE kiro_uptime_seconds gauge\nkiro_uptime_seconds ")
        .append((System.currentTimeMillis() - startedAt) / 1000).append('\n');
    return sb.toString();
  }

  public long uptimeSeconds() {
    return ManagementFactory.getRuntimeMXBean().getUptime() / 1000;
  }

  private static final class Latency {
    final AtomicLong count = new AtomicLong();
    final AtomicLong errors = new AtomicLong();
    final LongAdder totalMs = new LongAdder();

    void record(long millis, boolean error) {
      count.incrementAndGet();
      totalMs.add(millis);
      if (error) errors.incrementAndGet();
    }

    Map<String, Object> snapshot() {
      long n = count.get();
      double avg = n == 0 ? 0 : (double) totalMs.sum() / n;
      return Map.of("count", n, "avgMs", avg, "errors", errors.get());
    }
  }
}
