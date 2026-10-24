package com.kiro.api.work;

import com.kiro.api.security.AuthenticatedPrincipal;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Min;
import java.util.*;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;
import static com.kiro.api.work.WorkDtos.*;

@RestController
@RequestMapping("/work")
@Validated
public class WorkController {
  private final WorkService work;
  public WorkController(WorkService work) { this.work=work; }
  @GetMapping("/overview")
  public Object overview(@AuthenticationPrincipal AuthenticatedPrincipal u) { return work.overview(u); }
  @GetMapping("/projects")
  public Object projects(@AuthenticationPrincipal AuthenticatedPrincipal u,@RequestParam(defaultValue="0") @Min(0) int offset) { return work.projects(u,offset); }
  @PostMapping("/projects")
  public Object create(@AuthenticationPrincipal AuthenticatedPrincipal u,@Valid @RequestBody ProjectInput b) { return work.createProject(u,b); }
  @GetMapping("/projects/{id}")
  public Object detail(@AuthenticationPrincipal AuthenticatedPrincipal u,@PathVariable String id,@RequestParam(defaultValue="0") @Min(0) int offset) { return work.detail(u,id,offset); }
  @PostMapping("/projects/{id}/tasks")
  public Object task(@AuthenticationPrincipal AuthenticatedPrincipal u,@PathVariable String id,@Valid @RequestBody TaskInput b) { return work.saveTask(u,id,null,b); }
  @PutMapping("/projects/{id}/tasks/{taskId}")
  public Object update(@AuthenticationPrincipal AuthenticatedPrincipal u,@PathVariable String id,@PathVariable String taskId,@Valid @RequestBody TaskInput b) { return work.saveTask(u,id,taskId,b); }
  @PostMapping("/projects/{id}/grants")
  public Object grant(@AuthenticationPrincipal AuthenticatedPrincipal u,@PathVariable String id,@Valid @RequestBody GrantInput b) { return work.grant(u,id,b,false); }
  @PostMapping("/projects/{id}/revoke")
  public Object revoke(@AuthenticationPrincipal AuthenticatedPrincipal u,@PathVariable String id,@Valid @RequestBody GrantInput b) { return work.grant(u,id,b,true); }
  @PostMapping("/tasks/{id}/dependencies")
  public Object dependency(@AuthenticationPrincipal AuthenticatedPrincipal u,@PathVariable String id,@Valid @RequestBody DependencyInput b) { return work.dependency(u,id,b); }
  @GetMapping("/tasks/{id}/impact")
  public Object impact(@AuthenticationPrincipal AuthenticatedPrincipal u,@PathVariable String id) { return work.impact(u,id); }
  @GetMapping("/insights")
  public Object insights(@AuthenticationPrincipal AuthenticatedPrincipal u,@RequestParam(defaultValue="0") @Min(0) int offset) { return work.insightList(u,offset); }
  @PostMapping("/insights/{id}/triage")
  public Object triage(@AuthenticationPrincipal AuthenticatedPrincipal u,@PathVariable String id,
      @Valid @RequestBody InsightTriageInput b) { return work.triageInsight(u,id,b); }
  @GetMapping("/projects/{id}/history")
  public Object history(@AuthenticationPrincipal AuthenticatedPrincipal u,@PathVariable String id,@RequestParam(defaultValue="0") @Min(0) int offset) { return work.history(u,id,offset); }
  @PostMapping("/projects/{id}/scenarios")
  public Object scenario(@AuthenticationPrincipal AuthenticatedPrincipal u,@PathVariable String id,@Valid @RequestBody ScenarioInput b) { return work.scenario(u,id,b); }
  @GetMapping("/scenarios/{id}")
  public Object scenarioResult(@AuthenticationPrincipal AuthenticatedPrincipal u,@PathVariable String id) { return work.scenarioResult(u,id); }
}
