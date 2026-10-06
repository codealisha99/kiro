package com.kiro.api.domain;

import jakarta.persistence.*;
import java.time.Instant;
import java.util.UUID;

@MappedSuperclass
public abstract class BaseEntity {

  @Id
  @Column(name = "\"id\"")
  private String id;

  public String getId() {
    return id;
  }

  public void setId(String id) {
    this.id = id;
  }

  @PrePersist
  public void ensureId() {
    if (id == null) id = UUID.randomUUID().toString();
  }

  protected static Instant now() {
    return Instant.now();
  }
}
