package com.kiro.api.ingestion;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

import com.kiro.api.domain.DocumentChunkRepository;
import com.kiro.api.security.AuthenticatedPrincipal;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class IngestionEmbedStatusTest {
  @Mock DocumentChunkRepository chunks;
  @InjectMocks IngestionService service;

  private final AuthenticatedPrincipal user =
      new AuthenticatedPrincipal("u1", "test@example.com", "t1", "admin");

  private void counts(long total, long embedded) {
    var counts = mock(DocumentChunkRepository.EmbedCounts.class);
    when(counts.getTotal()).thenReturn(total);
    when(counts.getEmbedded()).thenReturn(embedded);
    when(chunks.countEmbeddings("t1")).thenReturn(counts);
  }

  @Test
  void reportsTenantScopedPendingEmbeddings() {
    counts(10, 4);
    var status = service.getEmbedStatus(user);
    assertEquals(10L, status.get("totalChunks"));
    assertEquals(4L, status.get("embeddedChunks"));
    assertEquals(6L, status.get("pendingChunks"));
    assertEquals(false, status.get("ready"));
    verify(chunks).countEmbeddings("t1");
  }

  @Test
  void emptyWorkspaceIsReady() {
    counts(0, 0);
    assertEquals(true, service.getEmbedStatus(user).get("ready"));
  }

  @Test
  void completedWorkspaceIsReady() {
    counts(10, 10);
    var status = service.getEmbedStatus(user);
    assertEquals(0L, status.get("pendingChunks"));
    assertEquals(true, status.get("ready"));
  }
}
