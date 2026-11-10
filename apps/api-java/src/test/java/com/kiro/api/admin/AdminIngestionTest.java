package com.kiro.api.admin;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

import com.kiro.api.domain.AiRequestRepository;
import com.kiro.api.domain.AuditLogRepository;
import com.kiro.api.domain.DocumentChunkRepository;
import com.kiro.api.domain.DocumentRepository;
import com.kiro.api.domain.FeedbackRepository;
import com.kiro.api.domain.SourceRepository;
import com.kiro.api.job.IngestJobService;
import com.kiro.api.security.AuthenticatedPrincipal;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;

class AdminIngestionTest {
  @Test
  void ingestionHealthShowsOnlyTheCallersOwnFailuresAndNoSharedQueueState() {
    var queue = mock(IngestJobService.class);
    var jdbc = mock(JdbcTemplate.class);
    var chunks = mock(DocumentChunkRepository.class);
    var counts = mock(DocumentChunkRepository.EmbedCounts.class);
    when(counts.getTotal()).thenReturn(10L);
    when(counts.getEmbedded()).thenReturn(7L);
    when(chunks.countEmbeddings("acme")).thenReturn(counts);
    // The dead-letter queue is shared: one failure is ours, one belongs to another workspace.
    when(queue.recentFailures(anyInt())).thenReturn(List.of(
        Map.of("versionId", "ours", "error", "timeout"),
        Map.of("versionId", "theirs", "error", "secret detail from another company")));
    when(jdbc.queryForList(anyString(), eq(String.class), any(Object[].class))).thenReturn(List.of("ours"));

    var service = new AdminService(mock(AuditLogRepository.class), queue, mock(SourceRepository.class),
        mock(DocumentRepository.class), mock(AiRequestRepository.class), mock(FeedbackRepository.class), chunks, jdbc);
    Map<String, Object> result = service.ingestion(new AuthenticatedPrincipal("u", "a@acme.test", "acme", "admin"));

    assertEquals(List.of(Map.of("versionId", "ours", "error", "timeout")), result.get("failed"));
    assertFalse(result.containsKey("queue"), "shared queue lengths reveal other workspaces' activity");
    assertEquals(10L, result.get("chunks"));
    assertEquals(7L, result.get("embeddedChunks"));
  }
}
