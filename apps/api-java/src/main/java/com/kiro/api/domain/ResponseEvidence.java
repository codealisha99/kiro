package com.kiro.api.domain;

import jakarta.persistence.*;

@Entity
@Table(name = "\"response_evidence\"")
public class ResponseEvidence extends BaseEntity {

  @Column(name = "\"responseId\"", nullable = false)
  private String responseId;

  @Column(name = "\"documentId\"", nullable = false)
  private String documentId;

  @Column(name = "\"versionId\"", nullable = false)
  private String versionId;

  @Column(name = "\"chunkId\"")
  private String chunkId;

  @Column(name = "\"relevanceScore\"", nullable = false)
  private double relevanceScore;

  public String getResponseId() { return responseId; }
  public void setResponseId(String v) { this.responseId = v; }
  public String getDocumentId() { return documentId; }
  public void setDocumentId(String v) { this.documentId = v; }
  public String getVersionId() { return versionId; }
  public void setVersionId(String v) { this.versionId = v; }
  public String getChunkId() { return chunkId; }
  public void setChunkId(String v) { this.chunkId = v; }
  public double getRelevanceScore() { return relevanceScore; }
  public void setRelevanceScore(double v) { this.relevanceScore = v; }
}
