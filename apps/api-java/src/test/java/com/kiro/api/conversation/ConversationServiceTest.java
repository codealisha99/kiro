package com.kiro.api.conversation;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

import com.kiro.api.domain.*;
import com.kiro.api.security.AuthenticatedPrincipal;
import java.util.*;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.*;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class ConversationServiceTest {
  @Mock ConversationRepository conversations;
  @Mock AiRequestRepository requests;
  @Mock AiResponseRepository responses;
  @Mock ResponseEvidenceRepository evidence;
  @Mock DocumentRepository documents;
  @Mock DocumentVersionRepository versions;
  @Mock DocumentChunkRepository chunks;
  @Mock SourceRepository sources;
  @InjectMocks ConversationService service;
  final AuthenticatedPrincipal user = new AuthenticatedPrincipal("reader", "r@example.com", "tenant", "employee");

  void setup() {
    var conversation = new Conversation(); conversation.setId("conv");
    var request = new AiRequest(); request.setId("req"); request.setQuery("Policy?");
    var response = new AiResponse(); response.setId("resp"); response.setAnswer("Secret [2]");
    var entry = new ResponseEvidence(); entry.setDocumentId("doc"); entry.setVersionId("v1"); entry.setCitationIndex(2);
    when(conversations.findFirstByIdAndTenantIdAndUserId("conv", "tenant", "reader")).thenReturn(Optional.of(conversation));
    when(requests.findByConversationIdOrderByCreatedAtAsc("conv")).thenReturn(List.of(request));
    when(responses.findByRequestIdOrderByCreatedAtDesc("req")).thenReturn(List.of(response));
    when(evidence.findByResponseId("resp")).thenReturn(List.of(entry));
  }

  @Test
  void revokedOrDeletedDocumentWithholdsAnswerAndMetadata() {
    setup();
    when(documents.findVisibleById("tenant", "doc", "reader", "EMPLOYEE")).thenReturn(Optional.empty());
    var version = new DocumentVersion(); version.setId("v1");
    when(versions.findById("v1")).thenReturn(Optional.of(version));
    var result = service.get(user, "conv");
    var message = (Map<?, ?>) ((List<?>) result.get("messages")).get(0);
    assertEquals("unknown", message.get("status"));
    assertFalse(message.get("answer").toString().contains("Secret"));
    assertEquals(List.of(), message.get("sources"));
    verify(documents, never()).findById(anyString());
  }

  @Test
  void authorizedHistoryKeepsOriginalCitationNumber() {
    setup();
    var doc = new Document(); doc.setId("doc"); doc.setSourceId("source"); doc.setTitle("Policy");
    when(documents.findVisibleById("tenant", "doc", "reader", "EMPLOYEE")).thenReturn(Optional.of(doc));
    var version = new DocumentVersion(); version.setVersion(1);
    when(versions.findById("v1")).thenReturn(Optional.of(version));
    var result = service.get(user, "conv");
    var message = (Map<?, ?>) ((List<?>) result.get("messages")).get(0);
    assertEquals("Secret [2]", message.get("answer"));
    var source = (Map<?, ?>) ((List<?>) message.get("sources")).get(0);
    assertEquals(2, source.get("citationIndex"));
  }

  @Test
  void otherUsersConversationIsNotReturned() {
    when(conversations.findFirstByIdAndTenantIdAndUserId("conv", "tenant", "reader")).thenReturn(Optional.empty());
    assertThrows(org.springframework.web.server.ResponseStatusException.class, () -> service.get(user, "conv"));
    verifyNoInteractions(requests, documents);
  }
  @Test void structuredHistoryFailsClosedWithoutReplayAuthorization() {
    var c=new Conversation(); c.setId("conv");
    var r=new AiRequest(); r.setId("req"); r.setQuery("Team workload?");
    var a=new AiResponse(); a.setId("resp");a.setModel("structured-work");a.setAnswer("Restricted project totals");
    when(conversations.findFirstByIdAndTenantIdAndUserId("conv","tenant","reader")).thenReturn(Optional.of(c));
    when(requests.findByConversationIdOrderByCreatedAtAsc("conv")).thenReturn(List.of(r));
    when(responses.findByRequestIdOrderByCreatedAtDesc("req")).thenReturn(List.of(a));
    var access=mock(com.kiro.api.organization.OrganizationAnswerAccess.class);
    service.setOrganizationAnswerAccess(access);
    var messages=(List<?>)service.get(user,"conv").get("messages");
    assertFalse(messages.toString().contains("Restricted project totals"));
    a.setUsage(Map.of("authorizationFingerprint","same"));
    when(access.canReplay(user,a.getUsage())).thenReturn(true);
    assertTrue(service.get(user,"conv").toString().contains("Restricted project totals"));
    when(access.canReplay(user,a.getUsage())).thenReturn(false);
    assertFalse(service.get(user,"conv").toString().contains("Restricted project totals"));
  }

}
