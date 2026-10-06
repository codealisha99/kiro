package com.kiro.api.domain;

import jakarta.persistence.*;
import java.time.Instant;

@Entity
@Table(name = "\"ai_requests\"")
public class AiRequest extends BaseEntity {

  @Column(name = "\"tenantId\"", nullable = false)
  private String tenantId;

  @Column(name = "\"userId\"", nullable = false)
  private String userId;

  @Column(name = "\"conversationId\"", nullable = false)
  private String conversationId;

  @Column(name = "\"query\"", nullable = false, columnDefinition = "TEXT")
  private String query;

  @Column(name = "\"createdAt\"", nullable = false)
  private Instant createdAt = Instant.now();

  public String getTenantId() { return tenantId; }
  public void setTenantId(String v) { this.tenantId = v; }
  public String getUserId() { return userId; }
  public void setUserId(String v) { this.userId = v; }
  public String getConversationId() { return conversationId; }
  public void setConversationId(String v) { this.conversationId = v; }
  public String getQuery() { return query; }
  public void setQuery(String v) { this.query = v; }
  public Instant getCreatedAt() { return createdAt; }
}
