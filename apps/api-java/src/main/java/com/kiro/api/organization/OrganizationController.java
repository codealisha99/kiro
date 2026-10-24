package com.kiro.api.organization;
import com.kiro.api.security.AuthenticatedPrincipal;
import jakarta.validation.Valid;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import static com.kiro.api.organization.OrganizationService.*;

@RestController
@RequestMapping("/organization")
public class OrganizationController {
  private final OrganizationService org; private final OrganizationDashboard dashboard;
  public OrganizationController(OrganizationService org,OrganizationDashboard dashboard) { this.org=org;this.dashboard=dashboard; }
  @GetMapping public Object setup(@AuthenticationPrincipal AuthenticatedPrincipal u) { return org.setup(u); }
  @GetMapping("/dashboard") public Object dashboard(@AuthenticationPrincipal AuthenticatedPrincipal u,@RequestParam(defaultValue="EMPLOYEE") String view) { return dashboard.dashboard(u,view); }
  @GetMapping("/my-teams") public Object teams(@AuthenticationPrincipal AuthenticatedPrincipal u) { return org.myTeams(u); }
  @GetMapping("/audit") public Object audit(@AuthenticationPrincipal AuthenticatedPrincipal u) { return org.auditHistory(u); }
  @PostMapping("/departments") public Object department(@AuthenticationPrincipal AuthenticatedPrincipal u,@Valid @RequestBody NameInput b) { return org.department(u,b); }
  @PostMapping("/teams") public Object team(@AuthenticationPrincipal AuthenticatedPrincipal u,@Valid @RequestBody TeamInput b) { return org.team(u,b); }
  @PostMapping("/memberships") public Object membership(@AuthenticationPrincipal AuthenticatedPrincipal u,@Valid @RequestBody MemberInput b) { return org.membership(u,b); }
  @PostMapping("/reporting") public Object reporting(@AuthenticationPrincipal AuthenticatedPrincipal u,@Valid @RequestBody ReportingInput b) { return org.reporting(u,b); }
  @PostMapping("/roles") public Object role(@AuthenticationPrincipal AuthenticatedPrincipal u,@Valid @RequestBody RoleInput b) { return org.role(u,null,b); }
  @PutMapping("/roles/{id}") public Object role(@AuthenticationPrincipal AuthenticatedPrincipal u,@PathVariable String id,@Valid @RequestBody RoleInput b) { return org.role(u,id,b); }
  @PostMapping("/bindings") public Object bind(@AuthenticationPrincipal AuthenticatedPrincipal u,@Valid @RequestBody BindingInput b) { return org.bind(u,b); }
  @DeleteMapping("/bindings/{id}") public Object revoke(@AuthenticationPrincipal AuthenticatedPrincipal u,@PathVariable String id) { return org.revoke(u,id); }
}
