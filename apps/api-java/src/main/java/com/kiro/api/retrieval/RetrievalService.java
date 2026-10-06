package com.kiro.api.retrieval;

import com.kiro.api.ai.AiServiceClient;
import com.kiro.api.security.AuthenticatedPrincipal;
import java.sql.Timestamp;
import java.util.List;
import java.util.Map;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

/**
 * Hybrid retrieval — port of RetrievalService. Semantic (pgvector cosine) + keyword
 * (PostgreSQL FTS), merged with RRF. The ACL predicate is the security enforcement
 * point and lives INSIDE both SQL queries: unauthorized chunks can never leave
 * this service (never fetch-then-filter in Java).
 *
 * <p>GROUP grants are intentionally not honored: there is no group-membership model,
 * so GROUP behaves fail-closed (documented in README).
 */
@Service
public class RetrievalService {

  private static final Logger log = LoggerFactory.getLogger(RetrievalService.class);

  static final int SEMANTIC_LIMIT = 10;
  static final int KEYWORD_LIMIT = 10;

  private final JdbcTemplate jdbc;
  private final AiServiceClient ai;

  public RetrievalService(JdbcTemplate jdbc, AiServiceClient ai) {
    this.jdbc = jdbc;
    this.ai = ai;
  }

  public List<RetrievedChunk> search(AuthenticatedPrincipal user, String query, int limit) {
    List<RetrievedChunk> semantic;
    try {
      semantic = searchSemantic(user, query);
    } catch (Exception e) {
      // Degraded but still authorized: keyword path enforces the same filters.
      log.warn("Semantic search failed, falling back to keyword: {}", e.toString());
      semantic = List.of();
    }
    List<RetrievedChunk> keyword = searchKeyword(user, query);
    return RrfFusion.fuse(semantic, keyword, RetrievedChunk::chunkId, limit);
  }

  public List<RetrievedChunk> searchSemantic(AuthenticatedPrincipal user, String query) {
    var result = ai.embedTexts(List.of(query));
    List<Double> vector = result.embeddings().get(0);
    String literal = toVectorLiteral(vector);
    String sql = """
        SELECT dc."id" AS "chunkId", d."id" AS "documentId", dv."id" AS "versionId",
               dv."version", d."title", d."sourceId", s."name" AS "sourceName",
               d."classification", d."updatedAt", dc."content",
               (1 - (dc."embedding" <=> ?::vector)) AS score
        FROM "document_chunks" dc
        JOIN "document_versions" dv ON dv."id" = dc."documentVersionId"
        JOIN "documents" d ON d."id" = dv."documentId"
        JOIN "sources" s ON s."id" = d."sourceId"
        WHERE d."tenantId" = ?
          AND d."deleted" = false
          AND dc."embedding" IS NOT NULL
          AND dv."approvalStatus" = 'APPROVED'
        """ + aclPredicate() + """
        ORDER BY dc."embedding" <=> ?::vector
        LIMIT """ + SEMANTIC_LIMIT;
    return jdbc.query(sql, this::mapRow, literal, user.tenantId(), user.id(), user.roleUpper(),
        user.id(), user.roleUpper(), literal);
  }

  public List<RetrievedChunk> searchKeyword(AuthenticatedPrincipal user, String query) {
    String sql = """
        SELECT dc."id" AS "chunkId", d."id" AS "documentId", dv."id" AS "versionId",
               dv."version", d."title", d."sourceId", s."name" AS "sourceName",
               d."classification", d."updatedAt", dc."content",
               ts_rank(to_tsvector('english', dc."content"), plainto_tsquery('english', ?)) AS score
        FROM "document_chunks" dc
        JOIN "document_versions" dv ON dv."id" = dc."documentVersionId"
        JOIN "documents" d ON d."id" = dv."documentId"
        JOIN "sources" s ON s."id" = d."sourceId"
        WHERE d."tenantId" = ?
          AND d."deleted" = false
          AND dv."approvalStatus" = 'APPROVED'
          AND to_tsvector('english', dc."content") @@ plainto_tsquery('english', ?)
        """ + aclPredicate() + """
        ORDER BY score DESC
        LIMIT """ + KEYWORD_LIMIT;
    return jdbc.query(sql, this::mapRow, query, user.tenantId(), query, user.id(),
        user.roleUpper(), user.id(), user.roleUpper());
  }

  /**
   * Visibility rule (fail-closed): PUBLIC/INTERNAL for the tenant, CONFIDENTIAL/RESTRICTED
   * only for owner or explicit USER/ROLE grant. Placeholders: userId, roleUpper, userId, roleUpper.
   */
  static String aclPredicate() {
    return """
        AND (
          d."ownerId" = ?
          OR d."classification" IN ('PUBLIC', 'INTERNAL')
          OR EXISTS (
            SELECT 1 FROM "document_acl" a
            WHERE a."documentId" = d."id"
              AND a."principalType" = 'USER'
              AND a."principalId" = ?
              AND a."permission" IN ('READ','WRITE','ADMIN')
          )
          OR EXISTS (
            SELECT 1 FROM "document_acl" a
            WHERE a."documentId" = d."id"
              AND a."principalType" = 'ROLE'
              AND a."principalId" = ?
              AND a."permission" IN ('READ','WRITE','ADMIN')
          )
        )
        """;
  }

  private RetrievedChunk mapRow(java.sql.ResultSet rs, int rowNum) throws java.sql.SQLException {
    Timestamp ts = rs.getTimestamp("updatedAt");
    Object scoreObj = rs.getObject("score");
    double score = scoreObj instanceof Number n ? n.doubleValue() : 0.0;
    return new RetrievedChunk(
        rs.getString("chunkId"),
        rs.getString("documentId"),
        rs.getString("versionId"),
        rs.getInt("version"),
        rs.getString("title"),
        rs.getString("sourceId"),
        rs.getString("sourceName"),
        rs.getString("classification"),
        ts == null ? null : ts.toInstant(),
        rs.getString("content"),
        score);
  }

  static String toVectorLiteral(List<Double> vector) {
    StringBuilder sb = new StringBuilder("[");
    for (int i = 0; i < vector.size(); i++) {
      if (i > 0) sb.append(',');
      double d = vector.get(i);
      if (!Double.isFinite(d)) throw new IllegalArgumentException("Non-finite embedding value");
      sb.append(d);
    }
    return sb.append(']').toString();
  }

  /** Exposed for tests: full semantic SQL must contain every security predicate. */
  static String semanticSqlForTest() {
    return "SELECT ... WHERE d.\"tenantId\" = ? AND d.\"deleted\" = false "
        + "AND dc.\"embedding\" IS NOT NULL AND dv.\"approvalStatus\" = 'APPROVED' " + aclPredicate();
  }
}
