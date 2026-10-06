package com.kiro.api.domain;

import jakarta.persistence.*;
import java.time.Instant;

@Entity
@Table(name = "\"conversations\"")
public class Conversation extends BaseEntity {

  @Column(name = "\"tenantId\"", nullable = false)
  private String tenantId;

  @Column(name = "\"userId\"", nullable = false)
  private String userId;

  @Column(name = "\"title\"")
  private String title;

  @Column(name = "\"createdAt\"", nullable = false)
  private Instant createdAt = Instant.now();

  @Column(name = "\"updatedAt\"", nullable = false)
  private Instant updatedAt = Instant.now();

  public String getTenantId() { return tenantId; }
  public void setTenantId(String v) { this.tenantId = v; }
  public String getUserId() { return userId; }
  public void setUserId(String v) { this.userId = v; }
  public String getTitle() { return title; }
  public void setTitle(String v) { this.title = v; }
  public Instant getCreatedAt() { return createdAt; }
  public Instant getUpdatedAt() { return updatedAt; }
  public void setUpdatedAt(Instant v) { this.updatedAt = v; }
}
