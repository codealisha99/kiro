package com.kiro.api.integration;

import com.kiro.api.ingestion.ChunkerService;
import com.kiro.api.job.IngestJobService;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.HexFormat;
import java.util.UUID;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/** Keeps the latest provider record version in the ordinary, ACL-filtered RAG index. */
@Component
public class ProviderRecordIndexer {
  private final JdbcTemplate db;
  private final ChunkerService chunker;
  private final IngestJobService jobs;

  public ProviderRecordIndexer(JdbcTemplate db, ChunkerService chunker, IngestJobService jobs) {
    this.db = db;
    this.chunker = chunker;
    this.jobs = jobs;
  }

  @Transactional
  public void index(String tenantId, String sourceId, String externalId, String ownerId,
      String title, String content) {
    String safeContent = content == null ? title : content;
    String contentHash = sha256(safeContent);
    String documentId = db.queryForObject("""
        INSERT INTO "documents" ("id","tenantId","sourceId","externalId","title","ownerId","classification","status","deleted")
        VALUES (?,?,?,?,?,?,'RESTRICTED','PUBLISHED',false)
        ON CONFLICT ("tenantId","sourceId","externalId") DO UPDATE
        SET "title"=EXCLUDED."title", "deleted"=false, "updatedAt"=now()
        RETURNING "id"
        """, String.class, UUID.randomUUID().toString(), tenantId, sourceId, externalId,
        truncate(title, 1000), ownerId);

    var latest = db.query("""
        SELECT "id","version","contentHash" FROM "document_versions"
        WHERE "documentId"=? ORDER BY "version" DESC LIMIT 1
        """, rs -> rs.next() ? new Version(rs.getString("id"), rs.getInt("version"), rs.getString("contentHash")) : null,
        documentId);
    if (latest != null && latest.contentHash().equals(contentHash)) return;

    int version = latest == null ? 1 : latest.number() + 1;
    String versionId = UUID.randomUUID().toString();
    db.update("""
        INSERT INTO "document_versions" ("id","documentId","version","contentHash","content","filename","approvalStatus")
        VALUES (?,?,?,?,?,?,'APPROVED')
        """, versionId, documentId, version, contentHash, safeContent, "provider-record.txt");
    var chunks = chunker.chunk(safeContent);
    for (var chunk : chunks) {
      db.update("INSERT INTO \"document_chunks\" (\"id\",\"documentVersionId\",\"content\",\"metadata\") VALUES (?,?,?,?::jsonb)",
          UUID.randomUUID().toString(), versionId, chunk.content(), "{\"index\":" + chunk.index() + ",\"source\":\"provider\"}");
    }
    if (!chunks.isEmpty()) jobs.enqueueEmbedVersion(versionId);
  }

  private static String sha256(String content) {
    try { return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(content.getBytes(StandardCharsets.UTF_8))); }
    catch (Exception e) { throw new IllegalStateException("Content hashing unavailable", e); }
  }

  private static String truncate(String value, int max) {
    if (value == null) return "Imported provider record";
    return value.substring(0, Math.min(value.length(), max));
  }

  private record Version(String id, int number, String contentHash) {}
}
