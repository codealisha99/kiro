package com.kiro.api.user;

import com.kiro.api.auth.UserDto;
import com.kiro.api.security.AuthenticatedPrincipal;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import java.util.List;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

record InviteRequest(
    @NotBlank @Email String email,
    @NotBlank @Size(min = 8) String password,
    String name,
    String role) {}

@RestController
@RequestMapping("/users")
public class UserController {

  private final UserService service;

  public UserController(UserService service) {
    this.service = service;
  }

  @GetMapping
  @PreAuthorize("hasRole('ADMIN')")
  public List<UserDto> list(@AuthenticationPrincipal AuthenticatedPrincipal principal) {
    return service.listByTenant(principal);
  }

  @PostMapping("/invite")
  @PreAuthorize("hasRole('ADMIN')")
  public UserDto invite(
      @AuthenticationPrincipal AuthenticatedPrincipal principal,
      @RequestBody @jakarta.validation.Valid InviteRequest req) {
    return service.invite(principal, req);
  }
}
