package com.kiro.api.common;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.ConstraintViolationException;
import java.util.stream.Collectors;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.AuthenticationException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.server.ResponseStatusException;

@RestControllerAdvice
public class GlobalExceptionHandler {

  private static final Logger log = LoggerFactory.getLogger(GlobalExceptionHandler.class);

  @ExceptionHandler(MethodArgumentNotValidException.class)
  public ResponseEntity<ApiError> validation(MethodArgumentNotValidException e, HttpServletRequest req) {
    String msg = e.getBindingResult().getFieldErrors().stream()
        .map(f -> f.getField() + " " + f.getDefaultMessage())
        .collect(Collectors.joining(", "));
    return error(HttpStatus.BAD_REQUEST, "Bad Request", msg.isBlank() ? "Validation failed" : msg, req);
  }

  @ExceptionHandler({ConstraintViolationException.class, HttpMessageNotReadableException.class})
  public ResponseEntity<ApiError> badRequest(Exception e, HttpServletRequest req) {
    return error(HttpStatus.BAD_REQUEST, "Bad Request", "Invalid request", req);
  }

  @ExceptionHandler(AuthenticationException.class)
  public ResponseEntity<ApiError> auth(AuthenticationException e, HttpServletRequest req) {
    return error(HttpStatus.UNAUTHORIZED, "Unauthorized", "Authentication required", req);
  }

  @ExceptionHandler(AccessDeniedException.class)
  public ResponseEntity<ApiError> denied(AccessDeniedException e, HttpServletRequest req) {
    return error(HttpStatus.FORBIDDEN, "Forbidden", "Requires elevated role", req);
  }

  @ExceptionHandler(ResponseStatusException.class)
  public ResponseEntity<ApiError> status(ResponseStatusException e, HttpServletRequest req) {
    HttpStatus s = HttpStatus.resolve(e.getStatusCode().value());
    if (s == null) s = HttpStatus.INTERNAL_SERVER_ERROR;
    return error(s, s.getReasonPhrase(), e.getReason() != null ? e.getReason() : s.getReasonPhrase(), req);
  }

  @ExceptionHandler(Exception.class)
  public ResponseEntity<ApiError> unhandled(Exception e, HttpServletRequest req) {
    // Never leak stack traces or internals to the client.
    log.error("Unhandled error on {}: {}", req.getRequestURI(), e.toString());
    return error(HttpStatus.INTERNAL_SERVER_ERROR, "Internal Server Error", "Unexpected error", req);
  }

  private ResponseEntity<ApiError> error(HttpStatus s, String err, String msg, HttpServletRequest req) {
    return ResponseEntity.status(s).body(ApiError.of(s.value(), err, msg, req.getRequestURI()));
  }
}
