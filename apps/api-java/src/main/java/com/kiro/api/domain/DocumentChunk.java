package com.kiro.api.domain;

import jakarta.persistence.*;
import java.util.Map;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

/**
 * Note: the {@code embedding vector(1536)} column is deliberately NOT mapped here.
 * It is written by the embed worker and read by retrieval, both via native SQL
 * (JdbcTemplate), so JPA never needs to materialize the pgvector type.
 */
@Entity
@Table(name = "\"document_chunks\"")
public class DocumentChunk extends BaseEntity {

  @Column(name = "\"documentVersionId\"", nullable = false)
  private String documentVersionId;

  @Column(name = "\"content\"", nullable = false, columnDefinition = "TEXT")
  private String content;

  @JdbcTypeCode(SqlTypes.JSON)
  @Column(name = "\"metadata\"")
  private Map<String, Object> metadata;

  public String getDocumentVersionId() { return documentVersionId; }
  public void setDocumentVersionId(String v) { this.documentVersionId = v; }
  public String getContent() { return content; }
  public void setContent(String v) { this.content = v; }
  public Map<String, Object> getMetadata() { return metadata; }
  public void setMetadata(Map<String, Object> v) { this.metadata = v; }
}
