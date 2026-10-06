package com.kiro.api.rag;

import com.kiro.api.security.AuthenticatedPrincipal;
import jakarta.validation.constraints.NotBlank;
import java.util.Map;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

record BrainQueryBody(@NotBlank String query, String conversationId) {}

@RestController
@RequestMapping("/brain")
class BrainController {

  private final RagService rag;

  BrainController(RagService rag) {
    this.rag = rag;
  }

  @PostMapping("/query")
  public Map<String, Object> query(
      @AuthenticationPrincipal AuthenticatedPrincipal user,
      @RequestBody @jakarta.validation.Valid BrainQueryBody body) {
    return rag.query(user, body.query(), body.conversationId());
  }
}
