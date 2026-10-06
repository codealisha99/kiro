package com.kiro.api.domain;

import jakarta.persistence.*;
import java.time.Instant;

/**
 * Session row — written on login, deleted on logout/expiry. The Redis
 * {@code session:{userId}} marker is the hot path; this table is the durable
 * record (the NestJS model was dead — here it is actually maintained).
 */
@Entity
@Table(name = "\"sessions\"")
public class Session extends BaseEntity {

  @Column(name = "\"userId\"", nullable = false)
  private String userId;

  @Column(name = "\"token\"", nullable = false, unique = true)
  private String token;

  @Column(name = "\"expiresAt\"", nullable = false)
  private Instant expiresAt;

  @Column(name = "\"createdAt\"", nullable = false)
  private Instant createdAt = Instant.now();

  public String getUserId() {
    return userId;
  }

  public void setUserId(String userId) {
    this.userId = userId;
  }

  public String getToken() {
    return token;
  }

  public void setToken(String token) {
    this.token = token;
  }

  public Instant getExpiresAt() {
    return expiresAt;
  }

  public void setExpiresAt(Instant expiresAt) {
    this.expiresAt = expiresAt;
  }

  public Instant getCreatedAt() {
    return createdAt;
  }
}
