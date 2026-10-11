package com.kiro.api.retrieval;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.Mockito.*;

import com.kiro.api.ai.AiServiceClient;
import com.kiro.api.security.AuthenticatedPrincipal;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.utility.DockerImageName;

@Testcontainers(disabledWithoutDocker = true)
class RetrievalPostgresTest {
  @Container
  static final PostgreSQLContainer<?> postgres = new PostgreSQLContainer<>(
      DockerImageName.parse("pgvector/pgvector:pg16").asCompatibleSubstituteFor("postgres"));

  static JdbcTemplate jdbc;
  static RetrievalService retrieval;

  @BeforeAll
  static void setup() {
    String url = postgres.getJdbcUrl() + "&stringtype=unspecified";
    Flyway.configure().dataSource(url, postgres.getUsername(), postgres.getPassword()).load().migrate();
    jdbc = new JdbcTemplate(new DriverManagerDataSource(url, postgres.getUsername(), postgres.getPassword()));
    List<Double> vector = new ArrayList<>(Collections.nCopies(1536, 0.0));
    vector.set(0, 1.0);
    AiServiceClient ai = mock(AiServiceClient.class);
    when(ai.embedTexts(anyList())).thenReturn(new AiServiceClient.EmbedResult(
        List.of(vector), "test", 1536));
    retrieval = new RetrievalService(jdbc, ai);
    jdbc.execute("INSERT INTO sources (id, \"tenantId\", type, name) VALUES ('source', 'tenant', 'MANUAL', 'Handbook')");
    for (String id : List.of("public", "owned", "user-grant", "role-grant", "hidden", "other-tenant")) {
      jdbc.update("INSERT INTO documents (id, \"tenantId\", \"sourceId\", \"externalId\", title, \"ownerId\", classification) VALUES (?, ?, 'source', ?, ?, ?, ?)",
          id, id.equals("other-tenant") ? "other" : "tenant", id, id,
          id.equals("owned") ? "reader" : "owner", id.equals("public") ? "PUBLIC" : "RESTRICTED");
      jdbc.update("INSERT INTO document_versions (id, \"documentId\", version, \"contentHash\", \"approvalStatus\") VALUES (?, ?, 1, 'hash', 'APPROVED')", id, id);
      jdbc.update("INSERT INTO document_chunks (id, \"documentVersionId\", content, embedding) VALUES (?, ?, 'Refund policy allows returns within 30 days', ?::vector)",
          id, id, RetrievalService.toVectorLiteral(vector));
    }
    jdbc.execute("INSERT INTO document_acl (id, \"documentId\", \"principalType\", \"principalId\") VALUES ('user', 'user-grant', 'USER', 'reader'), ('role', 'role-grant', 'ROLE', 'EMPLOYEE')");
  }

  @Test
  void keywordRetrievalHonorsOwnerUserRoleAndTenantFilters() {
    assertVisible(retrieval.searchKeyword(reader(), "refund policy"));
  }

  @Test
  void semanticRetrievalHonorsTheSameFilters() {
    assertVisible(retrieval.searchSemantic(reader(), "refund policy"));
  }

  @Test
  void anotherTenantCannotRetrieveOurDocuments() {
    var outsider = new AuthenticatedPrincipal("reader", "reader@example.com", "empty-tenant", "employee");
    assertTrue(retrieval.search(outsider, "refund policy", 5).isEmpty());
  }

  private static AuthenticatedPrincipal reader() {
    return new AuthenticatedPrincipal("reader", "reader@example.com", "tenant", "employee");
  }

  private static void assertVisible(List<RetrievedChunk> chunks) {
    assertEquals(java.util.Set.of("public", "owned", "user-grant", "role-grant"),
        chunks.stream().map(RetrievedChunk::documentId).collect(java.util.stream.Collectors.toSet()));
  }
}
