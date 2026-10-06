package com.kiro.api.domain;

import jakarta.persistence.*;
import java.time.Instant;

@Entity
@Table(name = "\"feedback\"")
public class Feedback extends BaseEntity {

  @Column(name = "\"tenantId\"", nullable = false)
  private String tenantId;

  @Column(name = "\"userId\"", nullable = false)
  private String userId;

  @Column(name = "\"requestId\"", nullable = false)
  private String requestId;

  @Column(name = "\"helpful\"", nullable = false)
  private boolean helpful;

  @Column(name = "\"comment\"", columnDefinition = "TEXT")
  private String comment;

  @Column(name = "\"createdAt\"", nullable = false)
  private Instant createdAt = Instant.now();

  public String getTenantId() { return tenantId; }
  public void setTenantId(String v) { this.tenantId = v; }
  public String getUserId() { return userId; }
  public void setUserId(String v) { this.userId = v; }
  public String getRequestId() { return requestId; }
  public void setRequestId(String v) { this.requestId = v; }
  public boolean isHelpful() { return helpful; }
  public void setHelpful(boolean v) { this.helpful = v; }
  public String getComment() { return comment; }
  public void setComment(String v) { this.comment = v; }
  public Instant getCreatedAt() { return createdAt; }
}
