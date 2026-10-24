package com.kiro.api.ingestion;

import static org.junit.jupiter.api.Assertions.*;

import com.kiro.api.job.IngestJobService;
import com.kiro.api.security.AuthenticatedPrincipal;
import com.kiro.api.storage.DocumentStorage;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.web.server.ResponseStatusException;

@SpringBootTest
@org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc
@ActiveProfiles("test")
class DocumentRevisionTest {
  @Autowired IngestionService ingestion;
  @Autowired org.springframework.test.web.servlet.MockMvc mvc;
  @MockBean IngestJobService jobs;
  @MockBean DocumentStorage storage;

  @Test
  void browserCanPreflightRevisionRequests() throws Exception {
    mvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders.options("/documents/doc")
        .header("Origin", "http://localhost:3000")
        .header("Access-Control-Request-Method", "PATCH")
        .header("Access-Control-Request-Headers", "authorization,content-type"))
        .andExpect(org.springframework.test.web.servlet.result.MockMvcResultMatchers.status().isOk())
        .andExpect(org.springframework.test.web.servlet.result.MockMvcResultMatchers.header()
            .string("Access-Control-Allow-Methods", org.hamcrest.Matchers.containsString("PATCH")));
  }

  AuthenticatedPrincipal owner() {
    return new AuthenticatedPrincipal("owner", "owner@example.com", UUID.randomUUID().toString(), "employee");
  }

  String create(AuthenticatedPrincipal owner) {
    return (String) ingestion.ingestManualDocument(owner, "Travel policy", "Refunds within 14 days.",
        "internal", null, null, null, null).get("id");
  }

  @Test
  void revisionKeepsOriginalEvidenceAndDocumentIdentity() {
    var owner = owner();
    String id = create(owner);
    var result = ingestion.updateDocument(owner, id, "Updated travel policy", "Refunds within 30 days.", 1);
    assertEquals(id, result.get("id"));
    assertEquals(2, result.get("selectedVersion"));
    assertEquals("Refunds within 30 days.", result.get("content"));
    assertEquals("internal", result.get("classification"));
    var original = ingestion.getDocument(owner, id, 1);
    assertEquals("Refunds within 14 days.", original.get("content"));
    assertEquals(1, original.get("selectedVersion"));
    assertEquals(2, original.get("versionCount"));
    assertThrows(ResponseStatusException.class, () -> ingestion.getDocument(owner, id, 99));
  }

  @Test
  void staleEditorCannotOverwriteNewerKnowledge() {
    var owner = owner();
    String id = create(owner);
    ingestion.updateDocument(owner, id, "Travel policy", "Refunds within 30 days.", 1);
    var error = assertThrows(ResponseStatusException.class,
        () -> ingestion.updateDocument(owner, id, "Stale title", "Refunds within 90 days.", 1));
    assertEquals(409, error.getStatusCode().value());
    assertEquals("Refunds within 30 days.", ingestion.getDocument(owner, id).get("content"));
    assertEquals(2, ingestion.getDocument(owner, id).get("versionCount"));
  }

  @Test
  void readerCannotEditAndRevocationProtectsHistoricalVersions() {
    var owner = owner();
    var reader = new AuthenticatedPrincipal("reader", "reader@example.com", owner.tenantId(), "employee");
    String id = (String) ingestion.ingestManualDocument(owner, "Private policy", "Private original text",
        "restricted", List.of(new AclGrantInput("user", reader.id(), "read")), null, null, null).get("id");
    assertEquals(false, ingestion.getDocument(reader, id, 1).get("canEdit"));
    assertThrows(ResponseStatusException.class,
        () -> ingestion.updateDocument(reader, id, "Other title", "Other text", 1));
    ingestion.revokeAccess(owner, id, "user", reader.id());
    var denied = assertThrows(ResponseStatusException.class, () -> ingestion.getDocument(reader, id, 1));
    assertEquals(404, denied.getStatusCode().value());
    ingestion.deleteDocument(owner, id);
    assertThrows(ResponseStatusException.class, () -> ingestion.getDocument(owner, id, 1));
  }

  @Test
  void unchangedSaveDoesNotManufactureAVersionAndBlankRevisionIsRejected() {
    var owner = owner();
    String id = create(owner);
    assertEquals(1, ingestion.updateDocument(owner, id, "Travel policy", "Refunds within 14 days.", 1).get("versionCount"));
    assertThrows(ResponseStatusException.class, () -> ingestion.updateDocument(owner, id, " ", " ", 1));
    assertEquals(1, ingestion.getDocument(owner, id).get("versionCount"));
  }
}
