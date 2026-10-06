package com.kiro.api.auth;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

import com.kiro.api.config.AppProperties;
import com.kiro.api.domain.SessionRepository;
import com.kiro.api.domain.Tenant;
import com.kiro.api.domain.TenantRepository;
import com.kiro.api.domain.User;
import com.kiro.api.domain.UserRepository;
import com.kiro.api.security.AuthenticatedPrincipal;
import com.kiro.api.security.JwtService;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.ValueOperations;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.web.server.ResponseStatusException;

@ExtendWith(MockitoExtension.class)
class AuthServiceTest {

  @Mock UserRepository users;
  @Mock TenantRepository tenants;
  @Mock SessionRepository sessions;
  @Mock StringRedisTemplate redis;
  @Mock ValueOperations<String, String> valueOps;

  private AuthService service() {
    AppProperties props = new AppProperties(
        new AppProperties.Jwt("test-secret-that-is-long-enough-for-hs256-123456", 3600),
        new AppProperties.Cors(List.of("http://localhost:3000")),
        "http://localhost:8000", "/tmp/kiro-storage", "local", 1000, 200);
    lenient().when(redis.opsForValue()).thenReturn(valueOps);
    lenient().when(valueOps.get(anyString())).thenReturn(null);
    return new AuthService(users, tenants, sessions, new BCryptPasswordEncoder(4),
        new JwtService(props), props, redis);
  }

  private User user(String id, String tenant, String email, String role, String rawPw) {
    User u = new User();
    u.setId(id);
    u.setTenantId(tenant);
    u.setEmail(email);
    u.setRole(role);
    u.setPassword(rawPw == null ? null : new BCryptPasswordEncoder(4).encode(rawPw));
    return u;
  }

  @Test
  void registerBootstrapsTenantAdmin() {
    when(tenants.save(any())).thenAnswer(inv -> {
      Tenant t = inv.getArgument(0);
      t.setId("t-new");
      return t;
    });
    when(users.findByTenantIdAndEmail(eq("t-new"), eq("a@b.c"))).thenReturn(Optional.empty());
    when(users.save(any())).thenAnswer(inv -> {
      User u = inv.getArgument(0);
      u.setId("u-new");
      return u;
    });

    AuthResponse res = service().register(new RegisterRequest("Acme", "A@B.c", "password123", "Al"));

    assertEquals("t-new", res.user().tenantId());
    assertEquals("a@b.c", res.user().email());
    assertEquals("admin", res.user().role());
    assertNotNull(res.tokens().accessToken());
  }

  @Test
  void registerSameEmailInSameTenantConflicts() {
    when(tenants.save(any())).thenAnswer(inv -> {
      Tenant t = inv.getArgument(0);
      t.setId("t1");
      return t;
    });
    when(users.findByTenantIdAndEmail(eq("t1"), eq("a@b.c")))
        .thenReturn(Optional.of(user("u", "t1", "a@b.c", "ADMIN", null)));
    assertThrows(ResponseStatusException.class,
        () -> service().register(new RegisterRequest("Acme", "a@b.c", "password123", null)));
  }

  @Test
  void loginSucceedsWithCorrectPassword() {
    when(users.findByEmail("a@b.c"))
        .thenReturn(List.of(user("u1", "t1", "a@b.c", "EMPLOYEE", "secret123")));
    when(sessions.save(any())).thenAnswer(inv -> inv.getArgument(0));

    AuthResponse res = service().login(new LoginRequest("a@b.c", "secret123"));
    assertEquals("u1", res.user().id());
  }

  @Test
  void loginFailsWithBadPassword() {
    when(users.findByEmail("a@b.c"))
        .thenReturn(List.of(user("u1", "t1", "a@b.c", "EMPLOYEE", "secret123")));
    ResponseStatusException e = assertThrows(ResponseStatusException.class,
        () -> service().login(new LoginRequest("a@b.c", "wrong")));
    assertEquals(401, e.getStatusCode().value());
  }

  @Test
  void logoutClearsSessionAndMarker() {
    var principal = new AuthenticatedPrincipal("u1", "a@b.c", "t1", "employee");
    service().logout(principal, "tok123");
    verify(sessions).deleteByToken("tok123");
    verify(sessions).deleteByUserId("u1");
    verify(redis).delete("session:u1");
  }

  @Test
  void meRejectsTenantMismatch() {
    var principal = new AuthenticatedPrincipal("u1", "a@b.c", "t-other", "employee");
    when(users.findById("u1")).thenReturn(Optional.of(user("u1", "t1", "a@b.c", "EMPLOYEE", null)));
    assertThrows(ResponseStatusException.class, () -> service().me(principal));
  }
}
