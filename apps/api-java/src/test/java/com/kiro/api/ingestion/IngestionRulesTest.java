package com.kiro.api.ingestion;

import static org.junit.jupiter.api.Assertions.*;

import org.junit.jupiter.api.Test;

class IngestionRulesTest {

  @Test
  void classificationDefaultsInternal() {
    assertEquals("INTERNAL", IngestionService.normalizeClassification(null));
    assertEquals("INTERNAL", IngestionService.normalizeClassification("weird"));
    assertEquals("PUBLIC", IngestionService.normalizeClassification("public"));
    assertEquals("CONFIDENTIAL", IngestionService.normalizeClassification("Confidential"));
    assertEquals("RESTRICTED", IngestionService.normalizeClassification("RESTRICTED"));
  }

  @Test
  void principalTypeAndPermissionNormalization() {
    assertEquals("USER", IngestionService.normalizePrincipalType("user"));
    assertEquals("GROUP", IngestionService.normalizePrincipalType("group"));
    assertEquals("ROLE", IngestionService.normalizePrincipalType("role"));
    assertEquals("ROLE", IngestionService.normalizePrincipalType(null));
    assertEquals("WRITE", IngestionService.normalizePermission("write"));
    assertEquals("ADMIN", IngestionService.normalizePermission("admin"));
    assertEquals("READ", IngestionService.normalizePermission(null));
    assertEquals("READ", IngestionService.normalizePermission("read"));
  }

  @Test
  void sha256MatchesKnownVector() {
    assertEquals("9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08",
        IngestionService.sha256("test"));
  }
}
