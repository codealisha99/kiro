package com.kiro.api.config;

import java.util.List;
import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "app")
public record AppProperties(
    Jwt jwt,
    Cors cors,
    String aiServiceUrl,
    String storageDir,
    String storageDriver,
    int chunkSize,
    int chunkOverlap) {

  public AppProperties {
    if (jwt == null) jwt = new Jwt("", 3600);
    if (cors == null) cors = new Cors(List.of("http://localhost:3000"));
    if (aiServiceUrl == null) aiServiceUrl = "http://localhost:8000";
    if (storageDir == null) storageDir = "/tmp/kiro-storage";
    if (storageDriver == null) storageDriver = "local";
    if (chunkSize == 0) chunkSize = 1000;
    if (chunkOverlap == 0) chunkOverlap = 200;
  }

  public record Jwt(String secret, long expiresInSeconds) {
    public Jwt {
      if (expiresInSeconds == 0) expiresInSeconds = 3600;
    }
  }

  public record Cors(List<String> allowedOrigins) {}
}
