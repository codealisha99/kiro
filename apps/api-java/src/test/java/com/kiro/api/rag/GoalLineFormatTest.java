package com.kiro.api.rag;

import static org.junit.jupiter.api.Assertions.*;

import java.util.HashMap;
import org.junit.jupiter.api.Test;

class GoalLineFormatTest {
  @Test
  void metricGoalRendersProgressHealthAndRemaining() {
    var row = new HashMap<String, Object>();
    row.put("title", "Company ARR");
    row.put("scopeName", "Company");
    row.put("progress", 0.4);
    row.put("expected", 0.5);
    row.put("health", "AT_RISK");
    row.put("remaining", 60.0);
    row.put("unit", "$k");
    row.put("dueDate", "2026-12-31");
    assertEquals("Company ARR (Company): 40% complete, 50% expected, at risk, 60.0 $k remaining, due 2026-12-31",
        RagService.goalLine(row));
  }

  @Test
  void goalWithoutDataSaysSo() {
    var row = new HashMap<String, Object>();
    row.put("title", "Hire");
    row.put("scopeName", "Delivery");
    row.put("progress", null);
    row.put("expected", 0.2);
    row.put("health", "NO_DATA");
    row.put("measure", "TASKS");
    row.put("remaining", 3);
    row.put("dueDate", "2026-06-30");
    assertTrue(RagService.goalLine(row).startsWith("Hire (Delivery): no progress data, 20% expected, no data, 3 open tasks remaining"));
  }
}
