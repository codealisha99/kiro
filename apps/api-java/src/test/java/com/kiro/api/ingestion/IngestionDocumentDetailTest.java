package com.kiro.api.ingestion;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

import com.kiro.api.domain.*;
import com.kiro.api.security.AuthenticatedPrincipal;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class IngestionDocumentDetailTest {
  @Mock DocumentRepository documents;
  @Mock DocumentVersionRepository versions;
  @Mock DocumentChunkRepository chunks;
  @Mock DocumentAclRepository acls;
  @Mock SourceRepository sources;
  @InjectMocks IngestionService service;

  @Test
  void pastedDocumentWithoutFilenameCanBeOpened() {
    var user = new AuthenticatedPrincipal("u1", "test@example.com", "t1", "admin");
    var doc = new Document();
    doc.setId("d1");
    doc.setTitle("Pasted policy");
    var version = new DocumentVersion();
    version.setId("v1");
    version.setVersion(1);
    version.setContentHash("hash");
    version.setContent("The original text");
    when(documents.findVisibleById("t1", "d1", "u1", "ADMIN")).thenReturn(Optional.of(doc));
    when(versions.findByDocumentIdOrderByVersionDesc("d1")).thenReturn(List.of(version));
    when(chunks.findByDocumentVersionId("v1")).thenReturn(List.of());

    var result = service.getDocument(user, "d1");

    assertEquals("The original text", result.get("content"));
    assertNull(result.get("filename"));
    assertEquals(true, result.get("canDelete"));
    var versionDetails = (List<?>) result.get("versions");
    var firstVersion = (Map<?, ?>) versionDetails.get(0);
    assertTrue(firstVersion.containsKey("filename"));
    assertNull(firstVersion.get("filename"));
  }
  @Test
  void readerCannotRemoveAnotherOwnersDocument() {
    var user = new AuthenticatedPrincipal("reader", "r@example.com", "t1", "employee");
    var doc = new Document(); doc.setId("d1"); doc.setOwnerId("owner"); doc.setTitle("Policy");
    when(documents.findVisibleById("t1", "d1", "reader", "EMPLOYEE")).thenReturn(Optional.of(doc));
    when(versions.findByDocumentIdOrderByVersionDesc("d1")).thenReturn(List.of());
    when(acls.findFirstByDocumentIdAndPrincipalTypeAndPrincipalIdAndPermission("d1", "USER", "reader", "ADMIN")).thenReturn(Optional.empty());
    assertEquals(false, service.getDocument(user, "d1").get("canDelete"));
    when(documents.findFirstByIdAndTenantIdAndDeletedFalse("d1", "t1")).thenReturn(Optional.of(doc));
    assertThrows(org.springframework.web.server.ResponseStatusException.class, () -> service.deleteDocument(user, "d1"));
    verify(documents, never()).save(any());
  }

  @Test
  void duplicateContentCannotReclassifyAnotherOwnersDocument() {
    var user = new AuthenticatedPrincipal("reader", "r@example.com", "t1", "employee");
    var source = new Source(); source.setId("s1");
    var doc = new Document(); doc.setId("d1"); doc.setOwnerId("owner"); doc.setClassification("RESTRICTED");
    when(sources.findFirstByTenantIdAndNameAndDeletedFalse("t1", "Manual ingest")).thenReturn(Optional.of(source));
    when(documents.findFirstByTenantIdAndSourceIdAndExternalId(eq("t1"), eq("s1"), anyString())).thenReturn(Optional.of(doc));
    assertThrows(org.springframework.web.server.ResponseStatusException.class,
        () -> service.ingestManualDocument(user, "Policy", "Same content", "public", null, null, null, null));
    assertEquals("RESTRICTED", doc.getClassification());
    verify(documents, never()).save(any());
  }

}
