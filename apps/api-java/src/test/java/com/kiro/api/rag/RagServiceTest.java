package com.kiro.api.rag;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

import com.kiro.api.common.MetricsService;
import com.kiro.api.domain.AiRequestRepository;
import com.kiro.api.domain.AiResponseRepository;
import com.kiro.api.domain.AuditLogRepository;
import com.kiro.api.domain.Conversation;
import com.kiro.api.domain.ConversationRepository;
import com.kiro.api.domain.ResponseEvidenceRepository;
import com.kiro.api.ai.AiServiceClient;
import com.kiro.api.retrieval.RetrievalService;
import com.kiro.api.retrieval.RetrievedChunk;
import com.kiro.api.security.AuthenticatedPrincipal;
import io.micrometer.core.instrument.simple.SimpleMeterRegistry;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class RagServiceTest {

  @Mock ConversationRepository conversations;
  @Mock AiRequestRepository requests;
  @Mock AiResponseRepository responses;
  @Mock ResponseEvidenceRepository evidence;
  @Mock AuditLogRepository audits;
  @Mock RetrievalService retrieval;
  @Mock AiServiceClient ai;

  private final AuthenticatedPrincipal user =
      new AuthenticatedPrincipal("u1", "a@b.c", "t1", "employee");

  private RagService service() {
    return new RagService(conversations, requests, responses, evidence, audits, retrieval, ai,
        new MetricsService(new SimpleMeterRegistry()));
  }

  private RetrievedChunk chunk(String id, String docId, String title, double score) {
    return new RetrievedChunk(id, docId, "v1", 1, title, "s1", "Northwind handbook",
        "PUBLIC", Instant.now(), "evidence content about refunds", score);
  }

  private RetrievedChunk chunk(String id, String title, double score) {
    return chunk(id, "d1", title, score);
  }

  @Test
  void parseAnswerStatusVariants() {
    assertEquals("answered", RagService.parseAnswer("STATUS:answered\nHello [1]").status());
    assertEquals("unknown", RagService.parseAnswer("STATUS:unknown\nNope").status());
    assertEquals("ambiguous", RagService.parseAnswer("status: Ambiguous\nWhich?").status());
    assertEquals("partial", RagService.parseAnswer("STATUS:partial\nSome").status());
    assertEquals("answered", RagService.parseAnswer("No status line").status());
    assertEquals("Hello [1]", RagService.parseAnswer("STATUS:answered\nHello [1]").answer());
  }

  @Test
  void citeChunksKeepsOnlyReferenced() {
    var chunks = List.of(chunk("c1", "A", 0.9), chunk("c2", "B", 0.8));
    assertEquals(List.of(chunks.get(1)), RagService.citeChunks("See [2] here", chunks));
    assertTrue(RagService.citeChunks("No citations", chunks).isEmpty());
    assertTrue(RagService.citeChunks("See [9]", chunks).isEmpty());
  }

  @Test
  void confidenceIsMaxScoreClamped() {
    var chunks = List.of(chunk("c1", "A", 2.5), chunk("c2", "B", -1.0));
    assertEquals(1.0, RagService.computeConfidence(chunks));
    assertEquals(0.0, RagService.computeConfidence(List.of()));
  }

  @Test
  @SuppressWarnings("unchecked")
  void emptyRetrievalShortCircuitsUnknownWithoutLlm() {
    when(retrieval.search(eq(user), anyString(), eq(5))).thenReturn(List.of());
    when(conversations.save(any())).thenAnswer(inv -> {
      Conversation c = inv.getArgument(0);
      c.setId("conv1");
      return c;
    });
    when(requests.save(any())).thenAnswer(inv -> inv.getArgument(0));
    when(responses.save(any())).thenAnswer(inv -> inv.getArgument(0));

    Map<String, Object> res = service().query(user, "revenue 2035?", null);

    assertEquals("unknown", res.get("status"));
    assertEquals(0.0, (Double) res.get("confidence"));
    assertTrue(((List<?>) res.get("sources")).isEmpty());
    verify(ai, never()).generate(anyString(), anyString(), any(), any());
    verify(audits, times(2)).save(any());
  }

  @Test
  @SuppressWarnings("unchecked")
  void groundedAnswerCitesAndPersistsEvidence() {
    var chunks = List.of(chunk("c1", "d1", "Refund policy", 0.9), chunk("c2", "d2", "Other", 0.4));
    when(retrieval.search(eq(user), anyString(), eq(5))).thenReturn(chunks);
    when(conversations.save(any())).thenAnswer(inv -> {
      Conversation c = inv.getArgument(0);
      c.setId("conv1");
      return c;
    });
    when(requests.save(any())).thenAnswer(inv -> inv.getArgument(0));
    when(responses.save(any())).thenAnswer(inv -> {
      com.kiro.api.domain.AiResponse r = inv.getArgument(0);
      r.setId("resp1");
      return r;
    });
    when(ai.generate(anyString(), anyString(), any(), any())).thenReturn(
        new AiServiceClient.GenerateResult("STATUS:answered\nRefunds in 30 days [1].", "gpt", "1", Map.of()));

    Map<String, Object> res = service().query(user, "refund policy?", null);

    assertEquals("answered", res.get("status"));
    List<Map<String, Object>> sources = (List<Map<String, Object>>) res.get("sources");
    assertEquals(1, sources.size());
    assertEquals("Refund policy", sources.get(0).get("title"));
    verify(evidence, times(1)).save(any());
  }

  @Test
  void blankQueryIsRejected() {
    assertThrows(org.springframework.web.server.ResponseStatusException.class,
        () -> service().query(user, "   ", null));
  }

  @Test
  void existingConversationIsReused() {
    Conversation c = new Conversation();
    c.setId("conv9");
    c.setTenantId("t1");
    c.setUserId("u1");
    when(conversations.findFirstByIdAndTenantIdAndUserId("conv9", "t1", "u1"))
        .thenReturn(Optional.of(c));
    when(retrieval.search(eq(user), anyString(), eq(5))).thenReturn(List.of());
    when(requests.save(any())).thenAnswer(inv -> inv.getArgument(0));
    when(responses.save(any())).thenAnswer(inv -> inv.getArgument(0));

    Map<String, Object> res = service().query(user, "hi?", "conv9");
    assertEquals("conv9", res.get("conversationId"));
    verify(conversations, never()).save(any());
  }
}
