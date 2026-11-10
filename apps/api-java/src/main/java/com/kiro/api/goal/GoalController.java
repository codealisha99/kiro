package com.kiro.api.goal;

import com.kiro.api.security.AuthenticatedPrincipal;
import jakarta.validation.Valid;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import static com.kiro.api.goal.GoalDtos.*;

@RestController
@RequestMapping("/goals")
public class GoalController {
  private final GoalReader reader;
  private final GoalService service;

  public GoalController(GoalReader reader, GoalService service) {
    this.reader = reader;
    this.service = service;
  }

  @GetMapping public Object list(@AuthenticationPrincipal AuthenticatedPrincipal u) { return reader.list(u); }
  @GetMapping("/options") public Object options(@AuthenticationPrincipal AuthenticatedPrincipal u) { return reader.options(u); }
  @GetMapping("/{id}") public Object detail(@AuthenticationPrincipal AuthenticatedPrincipal u, @PathVariable String id) { return reader.detail(u, id); }
  @PostMapping public Object create(@AuthenticationPrincipal AuthenticatedPrincipal u, @Valid @RequestBody GoalInput b) { return service.create(u, b); }
  @PutMapping("/{id}") public Object update(@AuthenticationPrincipal AuthenticatedPrincipal u, @PathVariable String id, @Valid @RequestBody GoalInput b) { return service.update(u, id, b); }
  @PostMapping("/{id}/checkins") public Object checkin(@AuthenticationPrincipal AuthenticatedPrincipal u, @PathVariable String id, @Valid @RequestBody CheckinInput b) { return service.checkin(u, id, b); }
  @PostMapping("/{id}/tasks") public Object link(@AuthenticationPrincipal AuthenticatedPrincipal u, @PathVariable String id, @Valid @RequestBody TaskLinkInput b) { return service.link(u, id, b); }
}
