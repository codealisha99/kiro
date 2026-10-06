package com.kiro.api.domain;

import jakarta.persistence.*;
import java.time.Instant;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

@Entity
@Table(name = "\"audit_logs\"")
public class AuditLog extends BaseEntity {

  @Column(name = "\"tenantId\"", nullable = false)
  private String tenantId;

  @Column(name = "\"userId\"")
  private String userId;

  @Column(name = "\"action\"", nullable = false)
  private String action;

  @Column(name = "\"resource\"")
  private String resource;

  @Column(name = "\"resourceId\"")
  private String resourceId;

  @Column(name = "\"query\"", columnDefinition = "TEXT")
  private String query;

  @JdbcTypeCode(SqlTypes.JSON)
  @Column(name = "\"retrievedSources\"")
  private Object retrievedSources;

  @Column(name = "\"permissionDecision\"")
  private String permissionDecision;

  @Column(name = "\"model\"")
  private String model;

  @Column(name = "\"responseId\"")
  private String responseId;

  @Column(name = "\"error\"", columnDefinition = "TEXT")
  private String error;

  @Column(name = "\"createdAt\"", nullable = false)
  private Instant createdAt = Instant.now();

  public String getTenantId() { return tenantId; }
  public void setTenantId(String v) { this.tenantId = v; }
  public String getUserId() { return userId; }
  public void setUserId(String v) { this.userId = v; }
  public String getAction() { return action; }
  public void setAction(String v) { this.action = v; }
  public String getResource() { return resource; }
  public void setResource(String v) { this.resource = v; }
  public String getResourceId() { return resourceId; }
  public void setResourceId(String v) { this.resourceId = v; }
  public String getQuery() { return query; }
  public void setQuery(String v) { this.query = v; }
  public Object getRetrievedSources() { return retrievedSources; }
  public void setRetrievedSources(Object v) { this.retrievedSources = v; }
  public String getPermissionDecision() { return permissionDecision; }
  public void setPermissionDecision(String v) { this.permissionDecision = v; }
  public String getModel() { return model; }
  public void setModel(String v) { this.model = v; }
  public String getResponseId() { return responseId; }
  public void setResponseId(String v) { this.responseId = v; }
  public String getError() { return error; }
  public void setError(String v) { this.error = v; }
  public Instant getCreatedAt() { return createdAt; }
}
