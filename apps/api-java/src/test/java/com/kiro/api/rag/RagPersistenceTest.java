package com.kiro.api.rag;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

import com.kiro.api.domain.AiRequestRepository;
import com.kiro.api.ai.AiServiceClient;
import com.kiro.api.domain.AuditLogRepository;
import com.kiro.api.job.IngestJobService;
import com.kiro.api.retrieval.RetrievedChunk;
import com.kiro.api.retrieval.RetrievalService;
import com.kiro.api.security.AuthenticatedPrincipal;
import java.util.List;
import java.time.Instant;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.test.context.ActiveProfiles;

@SpringBootTest
@ActiveProfiles("test")
class RagPersistenceTest {
  @Autowired RagService rag;
  @Autowired AiRequestRepository requests;
  @Autowired AuditLogRepository audits;
  @MockBean RetrievalService retrieval;
  @MockBean AiServiceClient ai;
  @MockBean IngestJobService jobs;

  @Test
  void answerWithoutEvidenceCommitsItsRequestAndAudit() {
    when(retrieval.search(any(), anyString(), anyInt())).thenReturn(List.of());
    var user = new AuthenticatedPrincipal("reader", "reader@example.com", "tenant", "employee");
    var answer = rag.query(user, "An unknown question", null);
    assertEquals("unknown", answer.get("status"));
    assertTrue(requests.findFirstByIdAndTenantIdAndUserId(
        (String) answer.get("requestId"), "tenant", "reader").isPresent());
  }

  @Test
  void extractiveAnswerCommitsItsCitationsAndStructuredAudit() {
    when(retrieval.search(any(), anyString(), anyInt())).thenReturn(List.of(
        new RetrievedChunk("chunk", "doc", "version", 1, "Refund policy", "source",
            "Handbook", "PUBLIC", Instant.now(), "Refunds are available within 30 days.", 0.8)));
    when(ai.generate(anyString(), anyString(), any(), any())).thenThrow(new IllegalStateException("No provider"));
    var user = new AuthenticatedPrincipal("reader", "reader@example.com", "tenant", "employee");
    var answer = rag.query(user, "Refund policy", null);
    assertEquals("partial", answer.get("status"));
    assertTrue(answer.get("answer").toString().contains("30 days"));
    assertFalse(((List<?>) answer.get("sources")).isEmpty());
    assertTrue(audits.findAll().stream().anyMatch(a ->
        a.getRetrievedSources() != null && a.getRetrievedSources().stream()
            .anyMatch(s -> "doc".equals(s.get("documentId")))));
  }
}
