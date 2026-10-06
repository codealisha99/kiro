package com.kiro.api.auth;

import com.kiro.api.security.AuthenticatedPrincipal;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/auth")
public class AuthController {

  private final AuthService auth;

  public AuthController(AuthService auth) {
    this.auth = auth;
  }

  @PostMapping("/register")
  @ResponseStatus(HttpStatus.CREATED)
  public AuthResponse register(@Valid @RequestBody RegisterRequest req) {
    return auth.register(req);
  }

  @PostMapping("/login")
  public AuthResponse login(@Valid @RequestBody LoginRequest req) {
    return auth.login(req);
  }

  @PostMapping("/logout")
  public java.util.Map<String, Boolean> logout(
      @AuthenticationPrincipal AuthenticatedPrincipal principal,
      @RequestHeader(value = "Authorization", required = false) String authorization) {
    String token = null;
    if (authorization != null && authorization.startsWith("Bearer ")) {
      token = authorization.substring(7).trim();
    }
    auth.logout(principal, token);
    return java.util.Map.of("ok", true);
  }

  @GetMapping("/me")
  public UserDto me(@AuthenticationPrincipal AuthenticatedPrincipal principal) {
    return auth.me(principal);
  }
}
