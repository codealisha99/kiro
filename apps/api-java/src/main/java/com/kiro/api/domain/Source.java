package com.kiro.api.domain;

import jakarta.persistence.*;
import java.time.Instant;
import java.util.Map;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

@Entity
@Table(name = "\"sources\"")
public class Source extends BaseEntity {

  @Column(name = "\"tenantId\"", nullable = false)
  private String tenantId;

  @Column(name = "\"type\"", nullable = false)
  private String type;

  @Column(name = "\"name\"", nullable = false)
  private String name;

  @JdbcTypeCode(SqlTypes.JSON)
  @Column(name = "\"config\"")
  private Map<String, Object> config;

  @Column(name = "\"status\"", nullable = false)
  private String status = "DISCONNECTED";

  @Column(name = "\"lastSyncAt\"")
  private Instant lastSyncAt;

  @Column(name = "\"deleted\"", nullable = false)
  private boolean deleted = false;

  @Column(name = "\"createdAt\"", nullable = false)
  private Instant createdAt = Instant.now();

  @Column(name = "\"updatedAt\"", nullable = false)
  private Instant updatedAt = Instant.now();

  public String getTenantId() { return tenantId; }
  public void setTenantId(String v) { this.tenantId = v; }
  public String getType() { return type; }
  public void setType(String v) { this.type = v; }
  public String getName() { return name; }
  public void setName(String v) { this.name = v; }
  public Map<String, Object> getConfig() { return config; }
  public void setConfig(Map<String, Object> v) { this.config = v; }
  public String getStatus() { return status; }
  public void setStatus(String v) { this.status = v; }
  public Instant getLastSyncAt() { return lastSyncAt; }
  public void setLastSyncAt(Instant v) { this.lastSyncAt = v; }
  public boolean isDeleted() { return deleted; }
  public void setDeleted(boolean v) { this.deleted = v; }
  public Instant getCreatedAt() { return createdAt; }
  public Instant getUpdatedAt() { return updatedAt; }
  public void setUpdatedAt(Instant v) { this.updatedAt = v; }
}
