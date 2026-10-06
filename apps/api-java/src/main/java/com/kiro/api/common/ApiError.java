package com.kiro.api.common;

import java.time.Instant;
import java.util.UUID;

public record ApiError(
    Instant timestamp, int status, String error, String message, String path, String requestId) {

  public static ApiError of(int status, String error, String message, String path) {
    return new ApiError(Instant.now(), status, error, message, path, UUID.randomUUID().toString());
  }
}
