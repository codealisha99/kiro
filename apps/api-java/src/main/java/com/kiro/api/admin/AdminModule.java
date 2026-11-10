package com.kiro.api.admin;

import com.kiro.api.domain.AiRequestRepository;
import com.kiro.api.domain.AuditLogRepository;
import com.kiro.api.domain.DocumentChunkRepository;
import com.kiro.api.domain.DocumentRepository;
import com.kiro.api.domain.FeedbackRepository;
import com.kiro.api.domain.SourceRepository;
import com.kiro.api.job.IngestJobService;
import com.kiro.api.security.AuthenticatedPrincipal;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.data.domain.PageRequest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.stereotype.Service;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@Service
class AdminService {

  private final AuditLogRepository audits;
  private final IngestJobService queue;
  private final SourceRepository sources;
  private final DocumentRepository documents;
  private final AiRequestRepository requests;
  private final FeedbackRepository feedback;
  private final DocumentChunkRepository chunks;
  private final JdbcTemplate jdbc;

  AdminService(
      AuditLogRepository audits,
      IngestJobService queue,
      SourceRepository sources,
      DocumentRepository documents,
      AiRequestRepository requests,
      FeedbackRepository feedback,
      DocumentChunkRepository chunks,
      JdbcTemplate jdbc) {
    this.audits = audits;
    this.queue = queue;
    this.sources = sources;
    this.documents = documents;
    this.requests = requests;
    this.feedback = feedback;
    this.chunks = chunks;
    this.jdbc = jdbc;
  }

  List<Map<String, Object>> audit(AuthenticatedPrincipal user, int limit) {
    int take = Math.min(Math.max(limit, 1), 500);
    List<Map<String, Object>> out = new ArrayList<>();
    for (var a : audits.findByTenantIdOrderByCreatedAtDesc(user.tenantId(), PageRequest.of(0, take))) {
      var m = new LinkedHashMap<String, Object>();
      m.put("id", a.getId());
      m.put("tenantId", a.getTenantId());
      m.put("userId", a.getUserId());
      m.put("action", a.getAction());
      m.put("resource", a.getResource());
      m.put("resourceId", a.getResourceId());
      m.put("query", a.getQuery());
      m.put("permissionDecision", a.getPermissionDecision());
      m.put("model", a.getModel());
      m.put("error", a.getError());
      m.put("createdAt", a.getCreatedAt().toString());
      out.add(m);
    }
    return out;
  }

  // Tenant-scoped only. The job queue is shared by every workspace, so its lengths and raw entries
  // are never returned; failures are kept only when their document version belongs to this tenant.
  Map<String, Object> ingestion(AuthenticatedPrincipal user) {
    var counts = chunks.countEmbeddings(user.tenantId());
    List<Map<String, String>> recent = queue.recentFailures(500);
    List<String> ids = recent.stream().map(f -> f.get("versionId")).distinct().toList();
    java.util.Set<String> owned = java.util.Set.of();
    if (!ids.isEmpty()) {
      Object[] params = new Object[ids.size() + 1];
      params[0] = user.tenantId();
      for (int i = 0; i < ids.size(); i++) params[i + 1] = ids.get(i);
      owned = new java.util.HashSet<>(jdbc.queryForList("""
          SELECT dv."id" FROM "document_versions" dv JOIN "documents" d ON d."id" = dv."documentId"
          WHERE d."tenantId" = ? AND dv."id" IN (""" + String.join(",", java.util.Collections.nCopies(ids.size(), "?")) + ")",
          String.class, params));
    }
    final java.util.Set<String> mine = owned;
    var failed = recent.stream().filter(f -> mine.contains(f.get("versionId"))).limit(10).toList();
    return Map.of(
        "sources", sources.countByTenantIdAndDeletedFalse(user.tenantId()),
        "documents", documents.countByTenantIdAndDeletedFalse(user.tenantId()),
        "chunks", counts.getTotal(),
        "embeddedChunks", counts.getEmbedded(),
        "failed", failed);
  }

  Map<String, Object> metrics(AuthenticatedPrincipal user) {
    List<Map<String, Object>> fb = new ArrayList<>();
    for (var c : feedback.countByHelpful(user.tenantId())) {
      fb.add(Map.of("helpful", c.getHelpful(), "_count", c.getCnt()));
    }
    return Map.of(
        "queries", requests.countByTenantId(user.tenantId()),
        "feedback", fb,
        "recentErrors", audits.findTop10ByTenantIdAndActionOrderByCreatedAtDesc(
            user.tenantId(), "query.failed"));
  }
}

@RestController
@RequestMapping("/admin")
@PreAuthorize("hasRole('ADMIN')")
class AdminController {

  private final AdminService service;

  AdminController(AdminService service) {
    this.service = service;
  }

  @GetMapping("/audit")
  public List<Map<String, Object>> audit(
      @AuthenticationPrincipal AuthenticatedPrincipal user,
      @RequestParam(value = "limit", required = false) String limit) {
    int take;
    try {
      take = limit == null ? 50 : Integer.parseInt(limit);
    } catch (NumberFormatException e) {
      take = 50;
    }
    return service.audit(user, take);
  }

  @GetMapping("/ingestion")
  public Map<String, Object> ingestion(@AuthenticationPrincipal AuthenticatedPrincipal user) {
    return service.ingestion(user);
  }

  @GetMapping("/metrics")
  public Map<String, Object> metrics(@AuthenticationPrincipal AuthenticatedPrincipal user) {
    return service.metrics(user);
  }
}
