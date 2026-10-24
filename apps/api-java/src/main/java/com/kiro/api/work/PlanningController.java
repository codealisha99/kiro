package com.kiro.api.work;
import com.kiro.api.security.AuthenticatedPrincipal;
import jakarta.validation.Valid;
import java.time.LocalDate;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import static com.kiro.api.work.PlanningService.*;
@RestController @RequestMapping("/work/projects/{projectId}/planning")
public class PlanningController {
 private final PlanningService s;public PlanningController(PlanningService s){this.s=s;}
 @GetMapping public Object list(@AuthenticationPrincipal AuthenticatedPrincipal u,@PathVariable String projectId){return s.list(u,projectId);}
 @PostMapping("/goals") public Object goal(@AuthenticationPrincipal AuthenticatedPrincipal u,@PathVariable String projectId,@Valid @RequestBody Goal b){return s.goal(u,projectId,null,b);}
 @PutMapping("/goals/{id}") public Object goalUpdate(@AuthenticationPrincipal AuthenticatedPrincipal u,@PathVariable String projectId,@PathVariable String id,@Valid @RequestBody Goal b){return s.goal(u,projectId,id,b);}
 @PostMapping("/initiatives") public Object initiative(@AuthenticationPrincipal AuthenticatedPrincipal u,@PathVariable String projectId,@Valid @RequestBody Initiative b){return s.initiative(u,projectId,b);}
 @PostMapping("/milestones") public Object milestone(@AuthenticationPrincipal AuthenticatedPrincipal u,@PathVariable String projectId,@Valid @RequestBody Milestone b){return s.milestone(u,projectId,b);}
 @PutMapping("/tasks/{id}") public Object task(@AuthenticationPrincipal AuthenticatedPrincipal u,@PathVariable String projectId,@PathVariable String id,@Valid @RequestBody TaskPlan b){return s.taskPlan(u,projectId,id,b);}
  @PostMapping("/availability") public Object availability(@AuthenticationPrincipal AuthenticatedPrincipal u,@PathVariable String projectId,@Valid @RequestBody Availability b){return s.availability(u,projectId,b);}
  @PostMapping("/commitments") public Object commitment(@AuthenticationPrincipal AuthenticatedPrincipal u,@PathVariable String projectId,@Valid @RequestBody Commitment b){return s.commitment(u,projectId,b);}
 @PostMapping("/skills") public Object skill(@AuthenticationPrincipal AuthenticatedPrincipal u,@PathVariable String projectId,@Valid @RequestBody Skill b){return s.skill(u,projectId,b);}
 @PostMapping("/time") public Object time(@AuthenticationPrincipal AuthenticatedPrincipal u,@PathVariable String projectId,@Valid @RequestBody TimeEntry b){return s.time(u,projectId,b);}
 @DeleteMapping("/{kind}/{id}") public Object revoke(@AuthenticationPrincipal AuthenticatedPrincipal u,@PathVariable String projectId,@PathVariable String kind,@PathVariable String id){return s.revoke(u,projectId,kind,id);}
 @GetMapping("/capacity") public Object capacity(@AuthenticationPrincipal AuthenticatedPrincipal u,@PathVariable String projectId,@RequestParam LocalDate start,@RequestParam LocalDate end){return s.capacity(u,projectId,start,end);}
}
