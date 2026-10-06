package com.kiro.api.feedback;

import com.kiro.api.domain.AiRequestRepository;
import com.kiro.api.domain.Feedback;
import com.kiro.api.domain.FeedbackRepository;
import com.kiro.api.security.AuthenticatedPrincipal;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.stereotype.Service;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

record FeedbackBody(@NotBlank String requestId, @NotNull Boolean helpful, String comment) {}

@Service
class FeedbackService {

  private final FeedbackRepository feedback;
  private final AiRequestRepository requests;

  FeedbackService(FeedbackRepository feedback, AiRequestRepository requests) {
    this.feedback = feedback;
    this.requests = requests;
  }

  Map<String, Boolean> submit(AuthenticatedPrincipal user, FeedbackBody body) {
    requests.findFirstByIdAndTenantIdAndUserId(body.requestId(), user.tenantId(), user.id())
        .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Request not found"));
    Feedback f = new Feedback();
    f.setTenantId(user.tenantId());
    f.setUserId(user.id());
    f.setRequestId(body.requestId());
    f.setHelpful(body.helpful());
    f.setComment(body.comment());
    feedback.save(f);
    return Map.of("ok", true);
  }
}

@RestController
@RequestMapping("/feedback")
class FeedbackController {

  private final FeedbackService service;

  FeedbackController(FeedbackService service) {
    this.service = service;
  }

  @PostMapping
  public Map<String, Boolean> submit(
      @AuthenticationPrincipal AuthenticatedPrincipal user,
      @RequestBody @jakarta.validation.Valid FeedbackBody body) {
    return service.submit(user, body);
  }
}
