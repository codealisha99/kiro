package com.kiro.api.domain;

import jakarta.persistence.*;
import java.time.Instant;

@Entity
@Table(
    name = "\"document_versions\"",
    uniqueConstraints = @UniqueConstraint(
        name = "document_versions_documentId_version_key",
        columnNames = {"\"documentId\"", "\"version\""}))
public class DocumentVersion extends BaseEntity {

  @Column(name = "\"documentId\"", nullable = false)
  private String documentId;

  @Column(name = "\"version\"", nullable = false)
  private int version;

  @Column(name = "\"contentHash\"", nullable = false)
  private String contentHash;

  @Column(name = "\"content\"", columnDefinition = "TEXT")
  private String content;

  @Column(name = "\"filename\"")
  private String filename;

  @Column(name = "\"approvalStatus\"", nullable = false)
  private String approvalStatus = "PENDING";

  @Column(name = "\"createdAt\"", nullable = false)
  private Instant createdAt = Instant.now();

  public String getDocumentId() { return documentId; }
  public void setDocumentId(String v) { this.documentId = v; }
  public int getVersion() { return version; }
  public void setVersion(int v) { this.version = v; }
  public String getContentHash() { return contentHash; }
  public void setContentHash(String v) { this.contentHash = v; }
  public String getContent() { return content; }
  public void setContent(String v) { this.content = v; }
  public String getFilename() { return filename; }
  public void setFilename(String v) { this.filename = v; }
  public String getApprovalStatus() { return approvalStatus; }
  public void setApprovalStatus(String v) { this.approvalStatus = v; }
  public Instant getCreatedAt() { return createdAt; }
}
