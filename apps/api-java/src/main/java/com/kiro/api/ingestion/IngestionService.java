package com.kiro.api.ingestion;

import com.kiro.api.domain.Document;
import com.kiro.api.domain.DocumentAcl;
import com.kiro.api.domain.DocumentChunk;
import com.kiro.api.domain.DocumentVersion;
import com.kiro.api.job.IngestJobService;
import com.kiro.api.security.AuthenticatedPrincipal;
import com.kiro.api.storage.DocumentStorage;
import jakarta.validation.constraints.NotBlank;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Instant;
import java.util.ArrayList;
import java.util.HexFormat;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.jdbc.core.JdbcTemplate;

@Service
public class IngestionService {

  private final com.kiro.api.domain.SourceRepository sources;
  private final com.kiro.api.domain.DocumentRepository documents;
  private final com.kiro.api.domain.DocumentVersionRepository versions;
  private final com.kiro.api.domain.DocumentChunkRepository chunks;
  private final com.kiro.api.domain.DocumentAclRepository acls;
  private final ChunkerService chunker;
  private final ParserService parser;
  private final IngestJobService queue;
  private final DocumentStorage storage;
  private final com.kiro.api.user.UserService users;
  private final JdbcTemplate jdbc;

  public IngestionService(
      com.kiro.api.domain.SourceRepository sources,
      com.kiro.api.domain.DocumentRepository documents,
      com.kiro.api.domain.DocumentVersionRepository versions,
      com.kiro.api.domain.DocumentChunkRepository chunks,
      com.kiro.api.domain.DocumentAclRepository acls,
      ChunkerService chunker,
      ParserService parser,
      IngestJobService queue,
      DocumentStorage storage,
      com.kiro.api.user.UserService users,
      JdbcTemplate jdbc) {
    this.sources = sources;
    this.documents = documents;
    this.versions = versions;
    this.chunks = chunks;
    this.acls = acls;
    this.chunker = chunker;
    this.parser = parser;
    this.queue = queue;
    this.storage = storage;
    this.users = users;
    this.jdbc = jdbc;
  }

  // ---- sources ----

  public List<Map<String, Object>> listSources(AuthenticatedPrincipal user) {
    List<Map<String, Object>> out = new ArrayList<>();
    List<Document> visible = documents.findVisible(user.tenantId(), user.id(), user.roleUpper());
    for (var s : sources.findByTenantIdAndDeletedFalseOrderByCreatedAtAsc(user.tenantId())) {
      if ("PROVIDER".equals(s.getType()) && jdbc.queryForObject(
          "SELECT count(*) FROM provider_connections WHERE tenant_id=? AND provider_source_id=? AND owner_id=? AND status<>'DELETED'",
          Long.class, user.tenantId(), s.getId(), user.id()) == 0) continue;
      long count = visible.stream()
          .filter(d -> d.getSourceId().equals(s.getId())).count();
      var m = new java.util.LinkedHashMap<String, Object>();
      m.put("id", s.getId());
      m.put("tenantId", s.getTenantId());
      m.put("type", s.getType().toLowerCase());
      m.put("name", s.getName());
      m.put("status", s.getStatus().toLowerCase());
      m.put("lastSyncAt", s.getLastSyncAt() == null ? null : s.getLastSyncAt().toString());
      m.put("createdAt", s.getCreatedAt().toString());
      m.put("documentCount", count);
      out.add(m);
    }
    return out;
  }

  @Transactional
  public com.kiro.api.domain.Source createSource(AuthenticatedPrincipal user, String type, String name) {
    String normalized = type == null ? "" : type.toUpperCase();
    if (!List.of("GOOGLE_DRIVE", "SLACK", "CRM", "MANUAL").contains(normalized)) {
      throw new ResponseStatusException(HttpStatus.CONFLICT, "Unknown source type: " + type);
    }
    var s = new com.kiro.api.domain.Source();
    s.setTenantId(user.tenantId());
    s.setType(normalized);
    s.setName(name);
    s.setStatus("CONNECTED");
    return sources.save(s);
  }

  @Transactional
  public Map<String, Boolean> deleteSource(AuthenticatedPrincipal user, String id) {
    var source = sources.findFirstByIdAndTenantIdAndDeletedFalse(id, user.tenantId())
        .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Source not found"));
    if ("PROVIDER".equals(source.getType())) throw new ResponseStatusException(HttpStatus.CONFLICT,
        "Disconnect or delete this source from Connected applications");
    source.setDeleted(true);
    source.setStatus("DISCONNECTED");
    sources.save(source);
    return Map.of("ok", true);
  }

  // ---- documents ----

  public Map<String, Object> getEmbedStatus(AuthenticatedPrincipal user) {
    var counts = chunks.countEmbeddings(user.tenantId());
    long total = counts.getTotal();
    long embedded = counts.getEmbedded();
    long pending = Math.max(0, total - embedded);
    return Map.of("totalChunks", total, "embeddedChunks", embedded,
        "pendingChunks", pending, "ready", pending == 0);
  }

  public List<Map<String, Object>> listDocuments(AuthenticatedPrincipal user) {
    List<Map<String, Object>> out = new ArrayList<>();
    for (Document d : documents.findVisible(user.tenantId(), user.id(), user.roleUpper())) {
      int versionCount = versions.findByDocumentIdOrderByVersionDesc(d.getId()).size();
      out.add(Map.of(
          "id", d.getId(),
          "sourceId", d.getSourceId(),
          "title", d.getTitle(),
          "classification", d.getClassification().toLowerCase(),
          "status", d.getStatus().toLowerCase(),
          "updatedAt", d.getUpdatedAt().toString(),
          "versionCount", versionCount));
    }
    return out;
  }

  public Map<String, Object> getDocument(AuthenticatedPrincipal user, String id) {
    return getDocument(user, id, null);
  }

  public Map<String, Object> getDocument(AuthenticatedPrincipal user, String id, Integer requestedVersion) {
    Document doc = documents.findVisibleById(user.tenantId(), id, user.id(), user.roleUpper())
        .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Document not found"));
    List<DocumentVersion> vers = versions.findByDocumentIdOrderByVersionDesc(doc.getId());
    DocumentVersion latest = requestedVersion == null
        ? vers.isEmpty() ? null : vers.get(0)
        : vers.stream().filter(v -> v.getVersion() == requestedVersion).findFirst()
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Document version not found"));
    List<DocumentChunk> chunkRows = latest == null
        ? List.of()
        : chunks.findByDocumentVersionId(latest.getId());
    List<DocumentChunk> ordered = new ArrayList<>(chunkRows);
    ordered.sort((a, b) -> Integer.compare(metaIndex(a), metaIndex(b)));

    String content;
    if (latest != null && latest.getContent() != null) {
      content = latest.getContent();
    } else {
      StringBuilder sb = new StringBuilder();
      for (DocumentChunk c : ordered) {
        if (!sb.isEmpty()) sb.append("\n\n");
        sb.append(c.getContent());
      }
      content = sb.toString();
    }
    List<Map<String, Object>> chunkDtos = new ArrayList<>();
    for (DocumentChunk c : ordered) {
      chunkDtos.add(Map.of("id", c.getId(), "index", metaIndex(c), "content", c.getContent()));
    }
    List<Map<String, Object>> versionDtos = new ArrayList<>();
    for (DocumentVersion v : vers) {
      var version = new java.util.LinkedHashMap<String, Object>();
      version.put("id", v.getId());
      version.put("version", v.getVersion());
      version.put("contentHash", v.getContentHash());
      version.put("filename", v.getFilename());
      version.put("createdAt", v.getCreatedAt().toString());
      versionDtos.add(version);
    }
    var out = new java.util.LinkedHashMap<String, Object>();
    out.put("id", doc.getId());
    out.put("sourceId", doc.getSourceId());
    out.put("title", doc.getTitle());
    out.put("classification", doc.getClassification().toLowerCase());
    out.put("status", doc.getStatus().toLowerCase());
    out.put("updatedAt", doc.getUpdatedAt().toString());
    out.put("versionCount", vers.size());
    out.put("content", content);
    out.put("filename", latest == null ? null : latest.getFilename());
    out.put("chunks", chunkDtos);
    out.put("versions", versionDtos);
    boolean canManage = canDeleteDocument(user, doc);
    out.put("canDelete", canManage);
    out.put("canEdit", canManage);
    out.put("selectedVersion", latest == null ? null : latest.getVersion());
    out.put("versionCreatedAt", latest == null ? null : latest.getCreatedAt().toString());
    return out;
  }

  @Transactional
  public Map<String, Object> updateDocument(AuthenticatedPrincipal user, String id,
      String title, String content, int expectedVersion) {
    Document doc = documents.findForUpdate(id, user.tenantId())
        .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Document not found"));
    if (!canDeleteDocument(user, doc)) {
      throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Document not found");
    }
    if (title == null || title.isBlank() || title.length() > 200
        || content == null || content.isBlank() || content.length() > 400_000) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
          "Use a title of up to 200 characters and document text of up to 400,000 characters.");
    }
    DocumentVersion previous = versions.findFirstByDocumentIdOrderByVersionDesc(id)
        .orElseThrow(() -> new ResponseStatusException(HttpStatus.CONFLICT, "This document has no version to edit"));
    if (expectedVersion != previous.getVersion()) {
      throw new ResponseStatusException(HttpStatus.CONFLICT,
          "A newer version was saved. Your changes have not been applied. Open the current version before editing again.");
    }
    String nextTitle = title.trim();
    String nextContent = content.trim();
    String hash = sha256(nextContent);
    if (nextTitle.equals(doc.getTitle()) && hash.equals(previous.getContentHash())) {
      return getDocument(user, id);
    }
    var raw = chunker.chunk(nextContent);
    if (raw.isEmpty()) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Document produced no searchable text");
    }
    DocumentVersion revision = new DocumentVersion();
    revision.setDocumentId(id);
    revision.setVersion(previous.getVersion() + 1);
    revision.setContentHash(hash);
    revision.setContent(nextContent);
    revision.setApprovalStatus("APPROVED");
    versions.save(revision);
    for (var entry : raw) {
      DocumentChunk chunk = new DocumentChunk();
      chunk.setDocumentVersionId(revision.getId());
      chunk.setContent(entry.content());
      chunk.setMetadata(Map.of("index", entry.index(), "source", "edit"));
      chunks.save(chunk);
    }
    doc.setTitle(nextTitle);
    doc.setUpdatedAt(Instant.now());
    documents.save(doc);
    queue.enqueueEmbedVersion(revision.getId());
    return getDocument(user, id);
  }

  public List<Map<String, Object>> listVersions(AuthenticatedPrincipal user, String id) {
    documents.findVisibleById(user.tenantId(), id, user.id(), user.roleUpper())
        .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Document not found"));
    List<Map<String, Object>> out = new ArrayList<>();
    for (DocumentVersion v : versions.findByDocumentIdOrderByVersionDesc(id)) {
      var m = new java.util.LinkedHashMap<String, Object>();
      m.put("id", v.getId());
      m.put("documentId", v.getDocumentId());
      m.put("version", v.getVersion());
      m.put("contentHash", v.getContentHash());
      m.put("filename", v.getFilename());
      m.put("createdAt", v.getCreatedAt().toString());
      out.add(m);
    }
    return out;
  }

  private boolean canDeleteDocument(AuthenticatedPrincipal user, Document doc) {
    return user.id().equals(doc.getOwnerId()) || "admin".equalsIgnoreCase(user.role())
        || acls.findFirstByDocumentIdAndPrincipalTypeAndPrincipalIdAndPermission(
            doc.getId(), "USER", user.id(), "ADMIN").isPresent();
  }

  @Transactional
  public Map<String, Boolean> deleteDocument(AuthenticatedPrincipal user, String id) {
    Document doc = documents.findFirstByIdAndTenantIdAndDeletedFalse(id, user.tenantId())
        .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Document not found"));
    if (!canDeleteDocument(user, doc)) {
      throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Document not found");
    }
    doc.setDeleted(true);
    documents.save(doc);
    return Map.of("ok", true);
  }

  @Transactional
  public Map<String, Boolean> revokeAccess(
      AuthenticatedPrincipal user, String documentId, String principalType, String principalId) {
    Document doc = documents.findFirstByIdAndTenantIdAndDeletedFalse(documentId, user.tenantId())
        .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Document not found"));
    if (!doc.getOwnerId().equals(user.id()) && !"admin".equalsIgnoreCase(user.role())) {
      throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Document not found");
    }
    acls.deleteByDocumentIdAndPrincipalTypeAndPrincipalId(
        documentId, normalizePrincipalType(principalType), principalId);
    return Map.of("ok", true);
  }

  /**
   * Manual ingest: idempotent upsert on (tenant, source, externalId); synchronous
   * chunks; embeddings async via queue. Mirrors ingestManualDocument exactly.
   */
  @Transactional
  public Map<String, Object> ingestManualDocument(
      AuthenticatedPrincipal user,
      String title,
      String content,
      String classificationRaw,
      List<AclGrantInput> aclInput,
      String filename,
      String sourceName,
      String externalIdHint) {
    if (title == null || title.isBlank()) {
      throw new ResponseStatusException(HttpStatus.CONFLICT, "title is required");
    }
    if (content == null || content.isBlank()) {
      throw new ResponseStatusException(HttpStatus.CONFLICT, "content is required");
    }
    String classification = normalizeClassification(classificationRaw);
    var source = ensureNamedSource(user.tenantId(), sourceName == null ? "Manual ingest" : sourceName);
    String contentHash = sha256(content);
    String externalId = (externalIdHint == null || externalIdHint.isBlank())
        ? "manual:" + contentHash.substring(0, 16)
        : externalIdHint;

    Optional<Document> existing =
        documents.findFirstByTenantIdAndSourceIdAndExternalId(user.tenantId(), source.getId(), externalId);
    Document document;
    boolean created;
    if (existing.isPresent()) {
      document = existing.get();
      if (!user.id().equals(document.getOwnerId()) && !"admin".equalsIgnoreCase(user.role())) {
        throw new ResponseStatusException(HttpStatus.CONFLICT,
            "This content belongs to an existing document. Ask its owner or an administrator to update it.");
      }
      document.setTitle(title);
      document.setClassification(classification);
      document.setDeleted(false);
      document.setUpdatedAt(Instant.now());
      documents.save(document);
      created = false;
    } else {
      document = new Document();
      document.setTenantId(user.tenantId());
      document.setSourceId(source.getId());
      document.setExternalId(externalId);
      document.setTitle(title);
      document.setOwnerId(user.id());
      document.setClassification(classification);
      documents.save(document);
      created = true;
    }

    Optional<DocumentVersion> latestOpt =
        versions.findFirstByDocumentIdOrderByVersionDesc(document.getId());
    if (latestOpt.isPresent() && latestOpt.get().getContentHash().equals(contentHash)) {
      return Map.of(
          "id", document.getId(),
          "title", document.getTitle(),
          "sourceId", document.getSourceId(),
          "classification", document.getClassification().toLowerCase(),
          "version", latestOpt.get().getVersion(),
          "created", false,
          "contentChanged", false);
    }

    int nextVersion = latestOpt.map(v -> v.getVersion() + 1).orElse(1);
    String storageKey = user.tenantId() + "/" + document.getId() + "/v" + nextVersion + "/"
        + (filename == null ? "document.txt" : filename);
    try {
      storage.put(storageKey, content.getBytes(StandardCharsets.UTF_8));
    } catch (Exception ignored) {
      // fire-and-forget, non-blocking (same as NestJS .catch(() => undefined))
    }
    DocumentVersion version = new DocumentVersion();
    version.setDocumentId(document.getId());
    version.setVersion(nextVersion);
    version.setContentHash(contentHash);
    version.setContent(content);
    version.setFilename(filename);
    version.setApprovalStatus("APPROVED");
    versions.save(version);

    List<ChunkerService.RawChunk> raw = chunker.chunk(content);
    if (raw.isEmpty()) {
      throw new ResponseStatusException(HttpStatus.CONFLICT, "Document produced no searchable text");
    }
    String metaSource = filename != null ? "upload" : "manual";
    for (ChunkerService.RawChunk c : raw) {
      DocumentChunk chunk = new DocumentChunk();
      chunk.setDocumentVersionId(version.getId());
      chunk.setContent(c.content());
      chunk.setMetadata(Map.of("index", c.index(), "source", metaSource));
      chunks.save(chunk);
    }

    List<AclGrantInput> acl = (aclInput != null && !aclInput.isEmpty())
        ? aclInput
        : "CONFIDENTIAL".equals(classification)
            ? List.of(
                new AclGrantInput("role", "MANAGER", "read"),
                new AclGrantInput("role", "ADMIN", "read"))
            : List.of();
    for (AclGrantInput entry : acl) {
      try {
        DocumentAcl grant = new DocumentAcl();
        grant.setDocumentId(document.getId());
        grant.setPrincipalType(normalizePrincipalType(entry.principalType()));
        grant.setPrincipalId(entry.principalId());
        grant.setPermission(normalizePermission(entry.permission()));
        acls.save(grant);
      } catch (Exception dup) {
        // skipDuplicates: ignore conflicting re-inserts
      }
    }

    queue.enqueueEmbedVersion(version.getId());

    return Map.of(
        "id", document.getId(),
        "title", document.getTitle(),
        "sourceId", document.getSourceId(),
        "classification", document.getClassification().toLowerCase(),
        "version", nextVersion,
        "created", created,
        "contentChanged", true);
  }

  @Transactional
  public Map<String, Object> ingestUploadedFile(
      AuthenticatedPrincipal user, byte[] bytes, String originalName, String mime,
      String title, String classification) {
    var parsed = parser.parse(bytes, originalName, mime, title);
    return ingestManualDocument(user, parsed.title(), parsed.content(), classification,
        null, parsed.filename(), null, null);
  }

  @Transactional
  public Map<String, Object> seedDemo(AuthenticatedPrincipal user) {
    var existing = sources.findFirstByTenantIdAndNameAndDeletedFalse(user.tenantId(), DemoCorpus.SOURCE_NAME);
    int createdCount = 0;
    for (var doc : DemoCorpus.DOCUMENTS) {
      List<AclGrantInput> acl = doc.acl().stream()
          .map(g -> new AclGrantInput(g.principalType(), g.principalId(), g.permission()))
          .toList();
      var result = ingestManualDocument(user, doc.title(), doc.content(), doc.classification(),
          acl, doc.externalKey() + ".md", DemoCorpus.SOURCE_NAME, "demo:" + doc.externalKey());
      if (Boolean.TRUE.equals(result.get("created")) || Boolean.TRUE.equals(result.get("contentChanged"))) {
        createdCount++;
      }
    }
    Map<String, String> viewer = users.ensureDemoViewer(user);
    return Map.of(
        "seeded", createdCount > 0 || existing.isEmpty(),
        "documentCount", DemoCorpus.DOCUMENTS.size(),
        "sourceName", DemoCorpus.SOURCE_NAME,
        "viewer", viewer);
  }

  // ---- internals ----

  private com.kiro.api.domain.Source ensureNamedSource(String tenantId, String name) {
    return sources.findFirstByTenantIdAndNameAndDeletedFalse(tenantId, name)
        .orElseGet(() -> {
          var s = new com.kiro.api.domain.Source();
          s.setTenantId(tenantId);
          s.setType("MANUAL");
          s.setName(name);
          s.setStatus("CONNECTED");
          return sources.save(s);
        });
  }

  static String normalizeClassification(String raw) {
    if (raw == null) return "INTERNAL";
    return switch (raw.toUpperCase()) {
      case "PUBLIC", "CONFIDENTIAL", "RESTRICTED" -> raw.toUpperCase();
      default -> "INTERNAL";
    };
  }

  static String normalizePrincipalType(String raw) {
    if (raw == null) return "ROLE";
    return switch (raw.toUpperCase()) {
      case "USER" -> "USER";
      case "GROUP" -> "GROUP";
      default -> "ROLE";
    };
  }

  static String normalizePermission(String raw) {
    if (raw == null) return "READ";
    return switch (raw.toUpperCase()) {
      case "WRITE" -> "WRITE";
      case "ADMIN" -> "ADMIN";
      default -> "READ";
    };
  }

  private static int metaIndex(DocumentChunk c) {
    if (c.getMetadata() == null) return 0;
    Object v = c.getMetadata().get("index");
    if (v instanceof Number n) return n.intValue();
    try {
      return Integer.parseInt(String.valueOf(v));
    } catch (Exception e) {
      return 0;
    }
  }

  static String sha256(String content) {
    try {
      MessageDigest md = MessageDigest.getInstance("SHA-256");
      return HexFormat.of().formatHex(md.digest(content.getBytes(StandardCharsets.UTF_8)));
    } catch (Exception e) {
      throw new IllegalStateException(e);
    }
  }

  /** Validation DTO for document ingest (mirrors IngestDocumentDto). */
  public record IngestDocumentDto(
      @NotBlank String title,
      @NotBlank String content,
      String classification,
      List<AclGrantInput> acl) {}
}
