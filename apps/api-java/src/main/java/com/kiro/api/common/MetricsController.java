package com.kiro.api.common;

import com.kiro.api.security.AuthenticatedPrincipal;
import java.util.Map;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
class MetricsController {

  private final MetricsService metrics;

  MetricsController(MetricsService metrics) {
    this.metrics = metrics;
  }

  // Guarded (unlike NestJS, where these were public): exposes usage/latency internals.
  @GetMapping("/metrics")
  @PreAuthorize("hasRole('ADMIN')")
  public Map<String, Object> snapshot(@AuthenticationPrincipal AuthenticatedPrincipal user) {
    return metrics.snapshot();
  }

  @GetMapping(value = "/metrics/prometheus", produces = "text/plain; version=0.0.4")
  @PreAuthorize("hasRole('ADMIN')")
  public String prometheus(@AuthenticationPrincipal AuthenticatedPrincipal user) {
    return metrics.prometheus();
  }
}
