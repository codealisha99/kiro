package com.kiro.api.work;
import com.kiro.api.security.AuthenticatedPrincipal;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Min;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;
@RestController @RequestMapping("/work/projects/{projectId}/actions") @Validated
public class WorkActionController {
 private final WorkActionService s;public WorkActionController(WorkActionService s){this.s=s;}
 @GetMapping public Object list(@AuthenticationPrincipal AuthenticatedPrincipal u,@PathVariable String projectId,@RequestParam(defaultValue="0") @Min(0) int offset){return s.list(u,projectId,offset);}
 @PostMapping public Object propose(@AuthenticationPrincipal AuthenticatedPrincipal u,@PathVariable String projectId,@Valid @RequestBody WorkActionService.Proposal b){return s.propose(u,projectId,b);}
 @PostMapping("/{id}/decision") public Object decide(@AuthenticationPrincipal AuthenticatedPrincipal u,@PathVariable String projectId,@PathVariable String id,@Valid @RequestBody WorkActionService.Decision b){return s.decide(u,projectId,id,b);}
 @PostMapping("/{id}/execute") public Object execute(@AuthenticationPrincipal AuthenticatedPrincipal u,@PathVariable String projectId,@PathVariable String id,@Valid @RequestBody WorkActionService.Execution b){return s.execute(u,projectId,id,b);}
}
