package com.kiro.api.domain;

import jakarta.persistence.*;

@Entity
@Table(
    name = "\"document_acl\"",
    uniqueConstraints = @UniqueConstraint(
        name = "document_acl_documentId_principalType_principalId_key",
        columnNames = {"\"documentId\"", "\"principalType\"", "\"principalId\""}))
public class DocumentAcl extends BaseEntity {

  @Column(name = "\"documentId\"", nullable = false)
  private String documentId;

  @Column(name = "\"principalType\"", nullable = false)
  private String principalType;

  @Column(name = "\"principalId\"", nullable = false)
  private String principalId;

  @Column(name = "\"permission\"", nullable = false)
  private String permission = "READ";

  public String getDocumentId() { return documentId; }
  public void setDocumentId(String v) { this.documentId = v; }
  public String getPrincipalType() { return principalType; }
  public void setPrincipalType(String v) { this.principalType = v; }
  public String getPrincipalId() { return principalId; }
  public void setPrincipalId(String v) { this.principalId = v; }
  public String getPermission() { return permission; }
  public void setPermission(String v) { this.permission = v; }
}
