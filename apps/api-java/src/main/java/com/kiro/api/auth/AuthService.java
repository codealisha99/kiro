package com.kiro.api.auth;

import com.kiro.api.config.AppProperties;
import com.kiro.api.domain.Session;
import com.kiro.api.domain.SessionRepository;
import com.kiro.api.domain.Tenant;
import com.kiro.api.domain.TenantRepository;
import com.kiro.api.domain.User;
import com.kiro.api.domain.UserRepository;
import com.kiro.api.security.AuthenticatedPrincipal;
import com.kiro.api.security.JwtService;
import java.time.Duration;
import java.time.Instant;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
public class AuthService {

  private static final Duration SESSION_TTL = Duration.ofDays(7);

  private final UserRepository users;
  private final TenantRepository tenants;
  private final SessionRepository sessions;
  private final PasswordEncoder passwords;
  private final JwtService jwt;
  private final AppProperties props;
  private final StringRedisTemplate redis;

  public AuthService(
      UserRepository users,
      TenantRepository tenants,
      SessionRepository sessions,
      PasswordEncoder passwords,
      JwtService jwt,
      AppProperties props,
      StringRedisTemplate redis) {
    this.users = users;
    this.tenants = tenants;
    this.sessions = sessions;
    this.passwords = passwords;
    this.jwt = jwt;
    this.props = props;
    this.redis = redis;
  }

  @Transactional
  public AuthResponse register(RegisterRequest req) {
    String email = req.email().toLowerCase();
    // Tenant-scoped uniqueness: same email may exist in another tenant.
    Tenant tenant = new Tenant();
    tenant.setName(req.tenantName());
    tenants.save(tenant);

    if (users.findByTenantIdAndEmail(tenant.getId(), email).isPresent()) {
      throw new ResponseStatusException(HttpStatus.CONFLICT, "A user with this email already exists");
    }
    User user = new User();
    user.setTenantId(tenant.getId());
    user.setEmail(email);
    user.setName(req.name());
    user.setPassword(passwords.encode(req.password()));
    user.setRole("ADMIN"); // first user bootstraps the tenant as admin
    users.save(user);
    return new AuthResponse(toDto(user), issueTokens(user));
  }

  @Transactional
  public AuthResponse login(LoginRequest req) {
    String email = req.email().toLowerCase();
    // Login is resolved per-tenant: same email may exist in several tenants, so we
    // check the password against each candidate and sign in to the matching tenant.
    java.util.List<User> candidates = users.findByEmail(email);
    User user = candidates.stream()
        .filter(u -> u.getPassword() != null && passwords.matches(req.password(), u.getPassword()))
        .findFirst()
        .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Invalid credentials"));
    return new AuthResponse(toDto(user), issueTokens(user));
  }

  @Transactional
  public void logout(AuthenticatedPrincipal principal, String token) {
    if (token != null) {
      sessions.deleteByToken(token);
    }
    sessions.deleteByUserId(principal.id());
    try {
      redis.delete("session:" + principal.id());
    } catch (Exception ignored) {
      // Redis down: DB session deletion above is the durable invalidation.
    }
  }

  @Transactional(readOnly = true)
  public UserDto me(AuthenticatedPrincipal principal) {
    User db = users.findById(principal.id())
        .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Session no longer valid"));
    if (!db.getTenantId().equals(principal.tenantId())) {
      throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Session no longer valid");
    }
    return toDto(db);
  }

  private Tokens issueTokens(User user) {
    String role = user.getRole().toLowerCase();
    String accessToken = jwt.issue(user.getId(), user.getEmail(), user.getTenantId(), role);
    long expiresIn = props.jwt().expiresInSeconds();
    Session s = new Session();
    s.setUserId(user.getId());
    s.setToken(accessToken);
    s.setExpiresAt(Instant.now().plus(SESSION_TTL));
    sessions.save(s);
    try {
      redis.opsForValue().set("session:" + user.getId(), accessToken, SESSION_TTL);
    } catch (Exception ignored) {
      // DB row above remains the source of truth for logout.
    }
    return new Tokens(accessToken, expiresIn);
  }

  public static UserDto toDto(User u) {
    return new UserDto(u.getId(), u.getTenantId(), u.getEmail(), u.getName(), u.getRole().toLowerCase());
  }
}
