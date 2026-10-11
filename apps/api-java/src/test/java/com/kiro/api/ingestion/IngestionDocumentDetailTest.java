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
    var versionDetails = (List<?>) result.get("versions");
    var firstVersion = (Map<?, ?>) versionDetails.get(0);
    assertTrue(firstVersion.containsKey("filename"));
    assertNull(firstVersion.get("filename"));
  }
}
