package com.kiro.api.goal;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.util.List;

/**
 * Pure progress and health math. Health thresholds (10 and 25 percentage points) are this
 * product's own convention, not an industry standard.
 */
public final class GoalProgress {
  private GoalProgress() {}

  static final double ON_TRACK_GAP = 0.10;
  static final double AT_RISK_GAP = 0.25;
  private static final double EPS = 1e-9;

  static double clamp(double x) { return Math.max(0, Math.min(1, x)); }

  /** clamp((current - start) / (target - start), 0, 1); null when data is missing or target equals start. */
  public static Double metric(BigDecimal start, BigDecimal target, BigDecimal current) {
    if (start == null || target == null || current == null) return null;
    if (target.compareTo(start) == 0) return null;
    double span = target.subtract(start).doubleValue();
    return clamp(current.subtract(start).doubleValue() / span);
  }

  /** Done linked tasks over all linked tasks; null when nothing is linked. */
  public static Double tasks(int done, int total) {
    return total <= 0 ? null : clamp((double) done / total);
  }

  /** Mean of the non-null child progress values; null when there are none. */
  public static Double mean(List<Double> values) {
    var present = values.stream().filter(v -> v != null).toList();
    if (present.isEmpty()) return null;
    return present.stream().mapToDouble(Double::doubleValue).average().orElse(0);
  }

  /** clamp((today - start) / (due - start), 0, 1). A zero-length window is complete once due is reached. */
  public static double expected(LocalDate start, LocalDate due, LocalDate today) {
    long span = java.time.temporal.ChronoUnit.DAYS.between(start, due);
    if (span <= 0) return today.isBefore(due) ? 0.0 : 1.0;
    return clamp((double) java.time.temporal.ChronoUnit.DAYS.between(start, today) / span);
  }

  /** First matching rule wins: cancelled, achieved, no data, past due, then gap to expected. */
  public static String health(String status, Double progress, double expected, LocalDate due, LocalDate today) {
    if ("CANCELLED".equals(status)) return "CANCELLED";
    if ("ACHIEVED".equals(status) || (progress != null && progress >= 1)) return "ACHIEVED";
    if (progress == null) return "NO_DATA";
    if (today.isAfter(due)) return "OFF_TRACK";
    double gap = expected - progress;
    if (gap <= ON_TRACK_GAP + EPS) return "ON_TRACK";
    if (gap <= AT_RISK_GAP + EPS) return "AT_RISK";
    return "OFF_TRACK";
  }

  /** METRIC: target - current. TASKS: open linked tasks. Otherwise null. */
  /** Distance still to go toward the target, never negative; works for goals that decrease (latency, failures). */
  public static BigDecimal remaining(String measure, BigDecimal start, BigDecimal target, BigDecimal current,
      int taskCount, int doneCount) {
    if ("METRIC".equals(measure)) {
      if (start == null || target == null || current == null) return null;
      BigDecimal toGo = target.subtract(current).multiply(BigDecimal.valueOf(target.compareTo(start)));
      return toGo.max(BigDecimal.ZERO).setScale(2, RoundingMode.HALF_UP);
    }
    if ("TASKS".equals(measure)) return BigDecimal.valueOf(Math.max(0, taskCount - doneCount));
    return null;
  }
}
