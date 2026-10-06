package com.kiro.api.domain;

import jakarta.persistence.*;
import java.time.Instant;
import java.util.Map;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

@Entity
@Table(name = "\"ai_responses\"")
public class AiResponse extends BaseEntity {

  @Column(name = "\"requestId\"", nullable = false)
  private String requestId;

  @Column(name = "\"answer\"", nullable = false, columnDefinition = "TEXT")
  private String answer;

  @Column(name = "\"status\"", nullable = false)
  private String status = "answered";

  @Column(name = "\"model\"", nullable = false)
  private String model;

  @Column(name = "\"modelVersion\"", nullable = false)
  private String modelVersion = "1";

  @Column(name = "\"confidence\"", nullable = false)
  private double confidence;

  @JdbcTypeCode(SqlTypes.JSON)
  @Column(name = "\"usage\"")
  private Map<String, Object> usage;

  @Column(name = "\"createdAt\"", nullable = false)
  private Instant createdAt = Instant.now();

  public String getRequestId() { return requestId; }
  public void setRequestId(String v) { this.requestId = v; }
  public String getAnswer() { return answer; }
  public void setAnswer(String v) { this.answer = v; }
  public String getStatus() { return status; }
  public void setStatus(String v) { this.status = v; }
  public String getModel() { return model; }
  public void setModel(String v) { this.model = v; }
  public String getModelVersion() { return modelVersion; }
  public void setModelVersion(String v) { this.modelVersion = v; }
  public double getConfidence() { return confidence; }
  public void setConfidence(double v) { this.confidence = v; }
  public Map<String, Object> getUsage() { return usage; }
  public void setUsage(Map<String, Object> v) { this.usage = v; }
  public Instant getCreatedAt() { return createdAt; }
}
