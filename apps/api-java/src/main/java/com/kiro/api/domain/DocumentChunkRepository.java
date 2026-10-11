package com.kiro.api.domain;

import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface DocumentChunkRepository extends JpaRepository<DocumentChunk, String> {
  interface EmbedCounts {
    long getTotal();
    long getEmbedded();
  }

  @Query(value = """
      SELECT COUNT(*) AS total, COUNT(dc.embedding) AS embedded
      FROM document_chunks dc
      JOIN document_versions dv ON dv.id = dc."documentVersionId"
      JOIN documents d ON d.id = dv."documentId"
      WHERE d."tenantId" = :tenantId AND d.deleted = false
      """, nativeQuery = true)
  EmbedCounts countEmbeddings(@Param("tenantId") String tenantId);

  List<DocumentChunk> findByDocumentVersionId(String versionId);

  List<DocumentChunk> findByIdIn(List<String> ids);
}
