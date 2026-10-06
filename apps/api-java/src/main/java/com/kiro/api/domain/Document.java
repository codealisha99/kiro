package com.kiro.api.domain;

import jakarta.persistence.*;
import java.time.Instant;

@Entity
@Table(
    name = "\"documents\"",
    uniqueConstraints = @UniqueConstraint(
        name = "documents_tenantId_sourceId_externalId_key",
        columnNames = {"\"tenantId\"", "\"sourceId\"", "\"externalId\""}))
public class Document extends BaseEntity {

  @Column(name = "\"tenantId\"", nullable = false)
  private String tenantId;

  @Column(name = "\"sourceId\"", nullable = false)
  private String sourceId;

  @Column(name = "\"externalId\"", nullable = false)
  private String externalId;

  @Column(name = "\"title\"", nullable = false)
  private String title;

  @Column(name = "\"ownerId\"", nullable = false)
  private String ownerId;

  @Column(name = "\"classification\"", nullable = false)
  private String classification = "INTERNAL";

  @Column(name = "\"status\"", nullable = false)
  private String status = "PUBLISHED";

  @Column(name = "\"deleted\"", nullable = false)
  private boolean deleted = false;

  @Column(name = "\"createdAt\"", nullable = false)
  private Instant createdAt = Instant.now();

  @Column(name = "\"updatedAt\"", nullable = false)
  private Instant updatedAt = Instant.now();

  public String getTenantId() { return tenantId; }
  public void setTenantId(String v) { this.tenantId = v; }
  public String getSourceId() { return sourceId; }
  public void setSourceId(String v) { this.sourceId = v; }
  public String getExternalId() { return externalId; }
  public void setExternalId(String v) { this.externalId = v; }
  public String getTitle() { return title; }
  public void setTitle(String v) { this.title = v; }
  public String getOwnerId() { return ownerId; }
  public void setOwnerId(String v) { this.ownerId = v; }
  public String getClassification() { return classification; }
  public void setClassification(String v) { this.classification = v; }
  public String getStatus() { return status; }
  public void setStatus(String v) { this.status = v; }
  public boolean isDeleted() { return deleted; }
  public void setDeleted(boolean v) { this.deleted = v; }
  public Instant getCreatedAt() { return createdAt; }
  public Instant getUpdatedAt() { return updatedAt; }
  public void setUpdatedAt(Instant v) { this.updatedAt = v; }
}
