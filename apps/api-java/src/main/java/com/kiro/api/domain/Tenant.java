package com.kiro.api.domain;

import jakarta.persistence.*;
import java.time.Instant;

@Entity
@Table(name = "\"Tenant\"")
public class Tenant extends BaseEntity {

  @Column(name = "\"name\"", nullable = false)
  private String name;

  @Column(name = "\"createdAt\"", nullable = false)
  private Instant createdAt = Instant.now();

  @Column(name = "\"updatedAt\"", nullable = false)
  private Instant updatedAt = Instant.now();

  public String getName() {
    return name;
  }

  public void setName(String name) {
    this.name = name;
  }

  public Instant getCreatedAt() {
    return createdAt;
  }

  public Instant getUpdatedAt() {
    return updatedAt;
  }
}
