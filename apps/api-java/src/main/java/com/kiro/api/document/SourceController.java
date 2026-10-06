package com.kiro.api.document;

import com.kiro.api.connector.ConnectorService;
import com.kiro.api.ingestion.IngestionService;
import com.kiro.api.security.AuthenticatedPrincipal;
import jakarta.validation.constraints.NotBlank;
import java.util.List;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

record CreateSourceBody(@NotBlank String type, @NotBlank String name) {}

@RestController
@RequestMapping("/sources")
class SourceController {

  private final IngestionService ingestion;
  private final ConnectorService connectors;

  SourceController(IngestionService ingestion, ConnectorService connectors) {
    this.ingestion = ingestion;
    this.connectors = connectors;
  }

  @GetMapping
  public List<Map<String, Object>> list(@AuthenticationPrincipal AuthenticatedPrincipal user) {
    return ingestion.listSources(user);
  }

  @PostMapping
  @PreAuthorize("hasAnyRole('MANAGER','ADMIN')")
  @ResponseStatus(HttpStatus.CREATED)
  public Map<String, Object> create(
      @AuthenticationPrincipal AuthenticatedPrincipal user,
      @RequestBody @jakarta.validation.Valid CreateSourceBody body) {
    if (!List.of("google_drive", "slack", "crm", "manual").contains(body.type().toLowerCase())) {
      throw new org.springframework.web.server.ResponseStatusException(
          HttpStatus.CONFLICT, "Unknown source type: " + body.type());
    }
    var s = ingestion.createSource(user, body.type(), body.name());
    return Map.of(
        "id", s.getId(),
        "tenantId", s.getTenantId(),
        "type", s.getType().toLowerCase(),
        "name", s.getName(),
        "status", s.getStatus().toLowerCase());
  }

  @DeleteMapping("/{id}")
  @PreAuthorize("hasRole('ADMIN')")
  public Map<String, Boolean> remove(
      @AuthenticationPrincipal AuthenticatedPrincipal user, @PathVariable String id) {
    return ingestion.deleteSource(user, id);
  }

  @PostMapping("/{id}/sync")
  @PreAuthorize("hasAnyRole('MANAGER','ADMIN')")
  public Map<String, Object> sync(
      @AuthenticationPrincipal AuthenticatedPrincipal user, @PathVariable String id) {
    return connectors.sync(user.tenantId(), id, user);
  }
}
