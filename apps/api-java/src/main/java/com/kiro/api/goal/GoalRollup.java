package com.kiro.api.goal;

import java.math.BigDecimal;
import java.util.*;

/**
 * Progress for every goal in a tenant, from numbers only (no titles). CHILDREN goals average their
 * non-cancelled children, recursively. Cycles are guarded so a bad row yields null instead of looping.
 */
final class GoalRollup {
  private GoalRollup() {}

  static Map<String, Double> progressById(List<Map<String, Object>> goals) {
    var byId = new HashMap<String, Map<String, Object>>();
    var children = new HashMap<String, List<String>>();
    for (var g : goals) {
      byId.put((String) g.get("id"), g);
      if (g.get("parent_id") != null && !"CANCELLED".equals(g.get("status"))) {
        children.computeIfAbsent((String) g.get("parent_id"), k -> new ArrayList<>()).add((String) g.get("id"));
      }
    }
    var memo = new HashMap<String, Double>();
    for (String id : byId.keySet()) of(id, byId, children, memo, new HashSet<>());
    return memo;
  }

  private static Double of(String id, Map<String, Map<String, Object>> byId, Map<String, List<String>> children,
      Map<String, Double> memo, Set<String> visiting) {
    if (memo.containsKey(id)) return memo.get(id);
    if (!visiting.add(id)) return null;
    var g = byId.get(id);
    String measure = (String) g.get("measure");
    Double p = switch (measure) {
      case "METRIC" -> GoalProgress.metric(dec(g, "start_value"), dec(g, "target_value"), dec(g, "current_value"));
      case "TASKS" -> GoalProgress.tasks(num(g, "done_count"), num(g, "task_count"));
      case "CHILDREN" -> GoalProgress.mean(children.getOrDefault(id, List.of()).stream()
          .map(c -> of(c, byId, children, memo, visiting)).toList());
      default -> null;
    };
    visiting.remove(id);
    memo.put(id, p);
    return p;
  }

  static BigDecimal dec(Map<String, Object> row, String key) {
    return row.get(key) instanceof BigDecimal b ? b : null;
  }

  static int num(Map<String, Object> row, String key) {
    return row.get(key) instanceof Number n ? n.intValue() : 0;
  }
}
