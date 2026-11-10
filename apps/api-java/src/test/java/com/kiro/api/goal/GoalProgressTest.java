package com.kiro.api.goal;

import static org.junit.jupiter.api.Assertions.*;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;

class GoalProgressTest {
  static final LocalDate START = LocalDate.of(2026, 1, 1);
  static final LocalDate DUE = LocalDate.of(2026, 1, 11);
  static final LocalDate MID = LocalDate.of(2026, 1, 6);

  @Test
  void metricProgressIsClampedAndNullWithoutData() {
    assertEquals(0.25, GoalProgress.metric(bd(0), bd(100), bd(25)), 1e-9);
    assertEquals(1.0, GoalProgress.metric(bd(0), bd(100), bd(150)), 1e-9);
    assertEquals(0.0, GoalProgress.metric(bd(0), bd(100), bd(-10)), 1e-9);
    assertNull(GoalProgress.metric(bd(5), bd(5), bd(5)));
    assertNull(GoalProgress.metric(bd(0), bd(100), null));
  }

  @Test
  void taskProgressIsDoneOverLinkedAndNullWhenNothingLinked() {
    assertEquals(0.5, GoalProgress.tasks(2, 4), 1e-9);
    assertNull(GoalProgress.tasks(0, 0));
  }

  @Test
  void expectedIsElapsedShareOfWindowAndClamped() {
    assertEquals(0.5, GoalProgress.expected(START, DUE, MID), 1e-9);
    assertEquals(0.0, GoalProgress.expected(START, DUE, LocalDate.of(2025, 12, 1)), 1e-9);
    assertEquals(1.0, GoalProgress.expected(START, DUE, LocalDate.of(2026, 2, 1)), 1e-9);
    assertEquals(1.0, GoalProgress.expected(START, START, START), 1e-9);
  }

  @Test
  void healthFollowsFirstMatchingRule() {
    assertEquals("CANCELLED", GoalProgress.health("CANCELLED", 1.0, 0.5, DUE, MID));
    assertEquals("ACHIEVED", GoalProgress.health("ACHIEVED", 0.1, 0.5, DUE, MID));
    assertEquals("ACHIEVED", GoalProgress.health("ACTIVE", 1.0, 0.5, DUE, MID));
    assertEquals("NO_DATA", GoalProgress.health("ACTIVE", null, 0.5, DUE, MID));
    assertEquals("OFF_TRACK", GoalProgress.health("ACTIVE", 0.9, 0.5, DUE, LocalDate.of(2026, 1, 12)));
  }

  @Test
  void healthGapBands() {
    assertEquals("ON_TRACK", GoalProgress.health("ACTIVE", 0.45, 0.5, DUE, MID));
    assertEquals("ON_TRACK", GoalProgress.health("ACTIVE", 0.6, 0.5, DUE, MID));
    assertEquals("AT_RISK", GoalProgress.health("ACTIVE", 0.3, 0.5, DUE, MID));
    assertEquals("OFF_TRACK", GoalProgress.health("ACTIVE", 0.2, 0.5, DUE, MID));
  }

  @Test
  void remainingUsesTargetForMetricAndOpenTasksForTasks() {
    assertEquals(0, new BigDecimal("75.00").compareTo(GoalProgress.remaining("METRIC", bd(0), bd(100), bd(25), 0, 0)));
    assertEquals(0, BigDecimal.valueOf(3).compareTo(GoalProgress.remaining("TASKS", null, null, null, 4, 1)));
    assertNull(GoalProgress.remaining("CHILDREN", null, null, null, 0, 0));
    // Decreasing goal: 800 ms → 300 ms, now at 520 ms leaves 220 ms to go; overshooting leaves 0.
    assertEquals(0, new BigDecimal("220.00").compareTo(GoalProgress.remaining("METRIC", bd(800), bd(300), bd(520), 0, 0)));
    assertEquals(0, BigDecimal.ZERO.compareTo(GoalProgress.remaining("METRIC", bd(800), bd(300), bd(250), 0, 0)));
    assertEquals(0, BigDecimal.ZERO.compareTo(GoalProgress.remaining("METRIC", bd(0), bd(100), bd(130), 0, 0)));
  }

  @Test
  void childrenRollupAveragesNonCancelledChildrenAndGuardsCycles() {
    var parent = row("P", null, "ACTIVE", "CHILDREN", null, null, null, 0, 0);
    var metric = row("A", "P", "ACTIVE", "METRIC", bd(0), bd(100), bd(40), 0, 0);
    var tasks = row("B", "P", "ACTIVE", "TASKS", null, null, null, 2, 1);
    var cancelled = row("C", "P", "CANCELLED", "METRIC", bd(0), bd(100), bd(100), 0, 0);
    var progress = GoalRollup.progressById(List.of(parent, metric, tasks, cancelled));
    assertEquals(0.45, progress.get("P"), 1e-9);
    assertEquals(0.4, progress.get("A"), 1e-9);

    var loopA = row("X", "Y", "ACTIVE", "CHILDREN", null, null, null, 0, 0);
    var loopB = row("Y", "X", "ACTIVE", "CHILDREN", null, null, null, 0, 0);
    var looped = GoalRollup.progressById(List.of(loopA, loopB));
    assertNull(looped.get("X"));
    assertNull(looped.get("Y"));
  }

  static BigDecimal bd(int v) { return BigDecimal.valueOf(v); }

  static Map<String, Object> row(String id, String parent, String status, String measure,
      BigDecimal start, BigDecimal target, BigDecimal current, int tasks, int done) {
    var m = new java.util.HashMap<String, Object>();
    m.put("id", id);
    m.put("parent_id", parent);
    m.put("status", status);
    m.put("measure", measure);
    m.put("start_value", start);
    m.put("target_value", target);
    m.put("current_value", current);
    m.put("task_count", (long) tasks);
    m.put("done_count", (long) done);
    return m;
  }
}
