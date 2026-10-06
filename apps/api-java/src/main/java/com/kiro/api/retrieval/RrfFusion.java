package com.kiro.api.retrieval;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/** Reciprocal Rank Fusion — port of fusion.ts (k=60, first hit 1/61). */
public final class RrfFusion {

  private RrfFusion() {}

  public static Map<String, Double> fuseRrf(List<List<String>> lists) {
    Map<String, Double> scores = new HashMap<>();
    for (List<String> list : lists) {
      for (int rank = 0; rank < list.size(); rank++) {
        String id = list.get(rank);
        scores.merge(id, 1.0 / (rank + 61), Double::sum);
      }
    }
    return scores;
  }

  public static <T> List<T> topFused(Map<String, T> items, Map<String, Double> scores, int k) {
    List<Map.Entry<String, Double>> entries = new ArrayList<>(scores.entrySet());
    entries.sort((a, b) -> Double.compare(b.getValue(), a.getValue()));
    List<T> out = new ArrayList<>();
    for (int i = 0; i < Math.min(k, entries.size()); i++) {
      T item = items.get(entries.get(i).getKey());
      if (item != null) out.add(item);
    }
    return out;
  }

  /** Stable fused ordering helper used by RetrievalService. */
  public static <T> List<T> fuse(
      List<T> first, List<T> second, java.util.function.Function<T, String> idOf, int k) {
    List<String> a = first.stream().map(idOf).toList();
    List<String> b = second.stream().map(idOf).toList();
    Map<String, Double> scores = fuseRrf(List.of(a, b));
    Map<String, T> byId = new LinkedHashMap<>();
    for (T t : first) byId.putIfAbsent(idOf.apply(t), t);
    for (T t : second) byId.putIfAbsent(idOf.apply(t), t);
    return topFused(byId, scores, k);
  }
}
