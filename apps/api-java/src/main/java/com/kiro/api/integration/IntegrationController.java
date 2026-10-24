package com.kiro.api.integration;
import com.kiro.api.security.AuthenticatedPrincipal;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Min;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;

@RestController @RequestMapping("/integrations") @Validated
public class IntegrationController {
  private final IntegrationService service;
  public IntegrationController(IntegrationService service) { this.service=service; }
  @GetMapping("/catalog") public Object catalog(@AuthenticationPrincipal AuthenticatedPrincipal u) { return service.catalog(u); }
  @GetMapping public Object list(@AuthenticationPrincipal AuthenticatedPrincipal u) { return service.list(u); }
  @PostMapping public Object create(@AuthenticationPrincipal AuthenticatedPrincipal u,@Valid @RequestBody IntegrationService.ConnectionInput b) { return service.create(u,b); }
  @PutMapping("/{id}/credential") public Object credential(@AuthenticationPrincipal AuthenticatedPrincipal u,@PathVariable String id,@Valid @RequestBody IntegrationService.TokenInput b) { return service.credential(u,id,b.token()); }
  @DeleteMapping("/{id}") public Object disconnect(@AuthenticationPrincipal AuthenticatedPrincipal u,@PathVariable String id) { return service.disconnect(u,id); }
  @PostMapping("/{id}/sync") public Object sync(@AuthenticationPrincipal AuthenticatedPrincipal u,@PathVariable String id) { return service.sync(u,id); }
  @GetMapping("/{id}/records") public Object records(@AuthenticationPrincipal AuthenticatedPrincipal u,@PathVariable String id,@RequestParam(defaultValue="0") @Min(0) int offset) { return service.records(u,id,offset); }
  @GetMapping("/{id}/runs") public Object runs(@AuthenticationPrincipal AuthenticatedPrincipal u,@PathVariable String id) { return service.runs(u,id); }
}
