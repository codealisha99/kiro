package com.kiro.api.domain;

import jakarta.persistence.*;
import java.time.Instant;

@Entity
@Table(
    name = "\"users\"",
    uniqueConstraints = @UniqueConstraint(name = "users_tenantId_email_key",
        columnNames = {"\"tenantId\"", "\"email\""}))
public class User extends BaseEntity {

  @Column(name = "\"tenantId\"", nullable = false)
  private String tenantId;

  @Column(name = "\"email\"", nullable = false)
  private String email;

  @Column(name = "\"name\"")
  private String name;

  /** BCrypt hash; null for SSO users. Never serialized. */
  @Column(name = "\"password\"")
  private String password;

  /** Stored UPPER (EMPLOYEE/MANAGER/ADMIN); exposed lowercase on the wire. */
  @Column(name = "\"role\"", nullable = false)
  private String role = "EMPLOYEE";

  @Column(name = "\"createdAt\"", nullable = false)
  private Instant createdAt = Instant.now();

  @Column(name = "\"updatedAt\"", nullable = false)
  private Instant updatedAt = Instant.now();

  public String getTenantId() {
    return tenantId;
  }

  public void setTenantId(String tenantId) {
    this.tenantId = tenantId;
  }

  public String getEmail() {
    return email;
  }

  public void setEmail(String email) {
    this.email = email;
  }

  public String getName() {
    return name;
  }

  public void setName(String name) {
    this.name = name;
  }

  public String getPassword() {
    return password;
  }

  public void setPassword(String password) {
    this.password = password;
  }

  public String getRole() {
    return role;
  }

  public void setRole(String role) {
    this.role = role;
  }

  public Instant getCreatedAt() {
    return createdAt;
  }

  public Instant getUpdatedAt() {
    return updatedAt;
  }
}
