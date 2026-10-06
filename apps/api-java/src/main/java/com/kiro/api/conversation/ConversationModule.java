package com.kiro.api.conversation;

import com.kiro.api.domain.AiRequest;
import com.kiro.api.domain.AiRequestRepository;
import com.kiro.api.domain.AiResponse;
import com.kiro.api.domain.AiResponseRepository;
import com.kiro.api.domain.Conversation;
import com.kiro.api.domain.ConversationRepository;
import com.kiro.api.domain.Document;
import com.kiro.api.domain.DocumentChunk;
import com.kiro.api.domain.DocumentChunkRepository;
import com.kiro.api.domain.DocumentRepository;
import com.kiro.api.domain.DocumentVersion;
import com.kiro.api.domain.DocumentVersionRepository;
import com.kiro.api.domain.ResponseEvidence;
import com.kiro.api.domain.ResponseEvidenceRepository;
import com.kiro.api.domain.Source;
import com.kiro.api.domain.SourceRepository;
import com.kiro.api.security.AuthenticatedPrincipal;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

@Service
class ConversationService {

  private final ConversationRepository conversations;
  private final AiRequestRepository requests;
  private final AiResponseRepository responses;
  private final ResponseEvidenceRepository evidence;
  private final DocumentRepository documents;
  private final DocumentVersionRepository versions;
  private final DocumentChunkRepository chunks;
  private final SourceRepository sources;

  ConversationService(
      ConversationRepository conversations,
      AiRequestRepository requests,
      AiResponseRepository responses,
      ResponseEvidenceRepository evidence,
      DocumentRepository documents,
      DocumentVersionRepository versions,
      DocumentChunkRepository chunks,
      SourceRepository sources) {
    this.conversations = conversations;
    this.requests = requests;
    this.responses = responses;
    this.evidence = evidence;
    this.documents = documents;
    this.versions = versions;
    this.chunks = chunks;
    this.sources = sources;
  }

  List<Map<String, Object>> list(AuthenticatedPrincipal user) {
    List<Map<String, Object>> out = new ArrayList<>();
    for (Conversation c : conversations.findByTenantIdAndUserIdOrderByUpdatedAtDesc(
        user.tenantId(), user.id())) {
      var m = new LinkedHashMap<String, Object>();
      m.put("id", c.getId());
      m.put("title", c.getTitle());
      m.put("createdAt", c.getCreatedAt().toString());
      m.put("updatedAt", c.getUpdatedAt().toString());
      out.add(m);
    }
    return out;
  }

  @Transactional
  Conversation create(AuthenticatedPrincipal user, String title) {
    Conversation c = new Conversation();
    c.setTenantId(user.tenantId());
    c.setUserId(user.id());
    c.setTitle(title);
    return conversations.save(c);
  }

  @Transactional(readOnly = true)
  Map<String, Object> get(AuthenticatedPrincipal user, String id) {
    Conversation c = conversations.findFirstByIdAndTenantIdAndUserId(id, user.tenantId(), user.id())
        .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Conversation not found"));
    List<AiRequest> reqs = requests.findByConversationIdOrderByCreatedAtAsc(c.getId());

    Map<String, DocumentChunk> chunkById = new HashMap<>();
    List<String> allChunkIds = new ArrayList<>();
    Map<String, List<ResponseEvidence>> evidenceByRequest = new HashMap<>();
    Map<String, AiResponse> responseByRequest = new HashMap<>();
    for (AiRequest r : reqs) {
      List<AiResponse> rs = responses.findByRequestIdOrderByCreatedAtDesc(r.getId());
      if (!rs.isEmpty()) responseByRequest.put(r.getId(), rs.get(0));
      List<ResponseEvidence> ev = rs.isEmpty() ? List.of() : evidence.findByResponseId(rs.get(0).getId());
      evidenceByRequest.put(r.getId(), ev);
      for (ResponseEvidence e : ev) {
        if (e.getChunkId() != null) allChunkIds.add(e.getChunkId());
      }
    }
    if (!allChunkIds.isEmpty()) {
      for (DocumentChunk ch : chunks.findByIdIn(allChunkIds)) chunkById.put(ch.getId(), ch);
    }

    List<Map<String, Object>> messages = new ArrayList<>();
    for (AiRequest r : reqs) {
      AiResponse resp = responseByRequest.get(r.getId());
      List<Map<String, Object>> srcs = new ArrayList<>();
      for (ResponseEvidence e : evidenceByRequest.getOrDefault(r.getId(), List.of())) {
        Document d = documents.findById(e.getDocumentId()).orElse(null);
        DocumentVersion v = versions.findById(e.getVersionId()).orElse(null);
        Source s = (d == null) ? null : sources.findById(d.getSourceId()).orElse(null);
        if (d == null || v == null) continue;
        DocumentChunk ch = e.getChunkId() == null ? null : chunkById.get(e.getChunkId());
        String excerpt = "";
        if (ch != null && ch.getContent().length() > 240) excerpt = ch.getContent().substring(0, 240);
        else if (ch != null) excerpt = ch.getContent();
        var m = new LinkedHashMap<String, Object>();
        m.put("documentId", d.getId());
        m.put("chunkId", e.getChunkId());
        m.put("title", d.getTitle());
        m.put("sourceName", s == null ? "" : s.getName());
        m.put("version", v.getVersion());
        m.put("score", e.getRelevanceScore());
        m.put("excerpt", excerpt);
        m.put("updatedAt", d.getUpdatedAt().toString());
        m.put("classification", d.getClassification().toLowerCase());
        srcs.add(m);
      }
      var msg = new LinkedHashMap<String, Object>();
      msg.put("id", r.getId());
      msg.put("query", r.getQuery());
      msg.put("answer", resp == null ? "" : resp.getAnswer());
      msg.put("status", resp == null ? "answered" : resp.getStatus());
      msg.put("createdAt", r.getCreatedAt().toString());
      msg.put("sources", srcs);
      messages.add(msg);
    }

    var out = new LinkedHashMap<String, Object>();
    out.put("id", c.getId());
    out.put("title", c.getTitle());
    out.put("createdAt", c.getCreatedAt().toString());
    out.put("updatedAt", c.getUpdatedAt().toString());
    out.put("messages", messages);
    return out;
  }
}

@RestController
@RequestMapping("/conversations")
class ConversationController {

  private final ConversationService service;

  ConversationController(ConversationService service) {
    this.service = service;
  }

  @GetMapping
  public List<Map<String, Object>> list(@AuthenticationPrincipal AuthenticatedPrincipal user) {
    return service.list(user);
  }

  @PostMapping
  public Map<String, Object> create(
      @AuthenticationPrincipal AuthenticatedPrincipal user,
      @RequestBody(required = false) Map<String, String> body) {
    Conversation c = service.create(user, body == null ? null : body.get("title"));
    var out = new LinkedHashMap<String, Object>();
    out.put("id", c.getId());
    out.put("title", c.getTitle());
    out.put("createdAt", c.getCreatedAt().toString());
    out.put("updatedAt", c.getUpdatedAt().toString());
    return out;
  }

  @GetMapping("/{id}")
  public Map<String, Object> get(
      @AuthenticationPrincipal AuthenticatedPrincipal user, @PathVariable String id) {
    return service.get(user, id);
  }
}
