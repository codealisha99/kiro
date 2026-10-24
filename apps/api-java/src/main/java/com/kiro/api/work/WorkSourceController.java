package com.kiro.api.work;
import com.kiro.api.security.AuthenticatedPrincipal;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Min;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;
@RestController @RequestMapping("/work/projects/{projectId}/sources") @Validated
public class WorkSourceController {
  private final WorkSourceService service;
  public WorkSourceController(WorkSourceService service) { this.service=service; }
  @GetMapping public Object list(@AuthenticationPrincipal AuthenticatedPrincipal u,@PathVariable String projectId,@RequestParam(defaultValue="0") @Min(0) int offset) {return service.list(u,projectId,offset);}
  @PostMapping public Object map(@AuthenticationPrincipal AuthenticatedPrincipal u,@PathVariable String projectId,@Valid @RequestBody WorkSourceService.MappingInput input) {return service.map(u,projectId,input);}
  @DeleteMapping("/{id}") public Object revoke(@AuthenticationPrincipal AuthenticatedPrincipal u,@PathVariable String projectId,@PathVariable String id) {return service.revoke(u,projectId,id);}
}
