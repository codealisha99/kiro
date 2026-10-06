package com.kiro.api.retrieval;

import static org.junit.jupiter.api.Assertions.*;

import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;

class RrfFusionTest {

  @Test
  void firstHitScoresOneOver61() {
    Map<String, Double> scores = RrfFusion.fuseRrf(List.of(List.of("a", "b")));
    assertEquals(1.0 / 61, scores.get("a"), 1e-12);
    assertEquals(1.0 / 62, scores.get("b"), 1e-12);
  }

  @Test
  void dualListWinnerRanksFirst() {
    Map<String, Double> scores = RrfFusion.fuseRrf(List.of(List.of("a", "b"), List.of("b", "a")));
    // b: 1/62 + 1/61 > a: 1/61 + 1/62 → tie here; use asymmetric lists instead
    Map<String, Double> s2 = RrfFusion.fuseRrf(List.of(List.of("winner", "x"), List.of("y", "winner")));
    Map<String, Double> s3 = RrfFusion.fuseRrf(List.of(List.of("winner"), List.of("winner")));
    assertTrue(s3.get("winner") > s2.get("winner"));
    assertNotNull(scores);
  }

  @Test
  void topFusedCapsAtKAndKeepsOrder() {
    Map<String, String> items = Map.of("a", "A", "b", "B", "c", "C");
    Map<String, Double> scores = RrfFusion.fuseRrf(List.of(List.of("c", "a", "b")));
    List<String> top2 = RrfFusion.topFused(items, scores, 2);
    assertEquals(List.of("C", "A"), top2);
  }

  @Test
  void aclPredicateIsFailClosed() {
    String sql = RetrievalService.semanticSqlForTest();
    assertTrue(sql.contains("d.\"tenantId\""));
    assertTrue(sql.contains("d.\"deleted\" = false"));
    assertTrue(sql.contains("dc.\"embedding\" IS NOT NULL"));
    assertTrue(sql.contains("dv.\"approvalStatus\" = 'APPROVED'"));
    assertTrue(sql.contains("d.\"ownerId\""));
    assertTrue(sql.contains("IN ('PUBLIC', 'INTERNAL')"));
    assertTrue(sql.contains("'USER'"));
    assertTrue(sql.contains("'ROLE'"));
  }

  @Test
  void vectorLiteralRejectsNonFinite() {
    assertEquals("[1.0,2.5]", RetrievalService.toVectorLiteral(List.of(1.0, 2.5)));
    assertThrows(IllegalArgumentException.class,
        () -> RetrievalService.toVectorLiteral(List.of(Double.NaN)));
  }
}
