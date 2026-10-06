package com.kiro.api.user;

import com.kiro.api.auth.AuthService;
import com.kiro.api.auth.UserDto;
import com.kiro.api.domain.User;
import com.kiro.api.domain.UserRepository;
import com.kiro.api.security.AuthenticatedPrincipal;
import java.util.List;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

@Service
public class UserService {

  private final UserRepository users;
  private final PasswordEncoder passwords;

  public UserService(UserRepository users, PasswordEncoder passwords) {
    this.users = users;
    this.passwords = passwords;
  }

  public List<UserDto> listByTenant(AuthenticatedPrincipal actor) {
    return users.findByTenantIdOrderByCreatedAtAsc(actor.tenantId()).stream()
        .map(AuthService::toDto).toList();
  }

  public UserDto invite(AuthenticatedPrincipal actor, InviteRequest req) {
    String email = req.email().toLowerCase();
    if (users.findByTenantIdAndEmail(actor.tenantId(), email).isPresent()) {
      throw new ResponseStatusException(HttpStatus.CONFLICT, "A user with this email already exists");
    }
    String role = switch (req.role() == null ? "employee" : req.role().toLowerCase()) {
      case "manager" -> "MANAGER";
      case "admin" -> "ADMIN";
      default -> "EMPLOYEE";
    };
    User u = new User();
    u.setTenantId(actor.tenantId());
    u.setEmail(email);
    u.setName(req.name());
    u.setPassword(passwords.encode(req.password()));
    u.setRole(role);
    users.save(u);
    return AuthService.toDto(u);
  }

  /** Idempotent demo viewer bootstrap (mirrors ensureDemoViewer). */
  public Map<String, String> ensureDemoViewer(AuthenticatedPrincipal actor) {
    String slug = actor.tenantId().replaceAll("[^a-zA-Z0-9]", "");
    slug = (slug.length() > 10 ? slug.substring(0, 10) : slug).toLowerCase();
    if (slug.isBlank()) slug = "tenant";
    String email = "viewer@" + slug + ".demo";
    String password = "northwind-viewer";
    var existing = users.findByTenantIdAndEmail(actor.tenantId(), email);
    if (existing.isPresent()) {
      return Map.of("email", email, "password", password,
          "role", existing.get().getRole().toLowerCase());
    }
    invite(actor, new InviteRequest(email, password, "Avery Chen", "employee"));
    return Map.of("email", email, "password", password, "role", "employee");
  }
}
