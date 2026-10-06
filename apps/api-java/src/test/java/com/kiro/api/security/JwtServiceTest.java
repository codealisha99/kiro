package com.kiro.api.security;

import static org.junit.jupiter.api.Assertions.*;

import com.kiro.api.config.AppProperties;
import io.jsonwebtoken.JwtException;
import org.junit.jupiter.api.Test;

class JwtServiceTest {

  private JwtService service(String secret) {
    AppProperties props = new AppProperties(
        new AppProperties.Jwt(secret, 3600),
        new AppProperties.Cors(java.util.List.of("http://localhost:3000")),
        "http://localhost:8000", "/tmp/kiro-storage", "local", 1000, 200);
    return new JwtService(props);
  }

  @Test
  void issueAndParseRoundTrip() {
    JwtService svc = service("test-secret-that-is-long-enough-for-hs256-123456");
    String token = svc.issue("u1", "a@b.c", "t1", "ADMIN");
    AuthenticatedPrincipal p = svc.parse(token);
    assertEquals("u1", p.id());
    assertEquals("t1", p.tenantId());
    assertEquals("admin", p.role());
    assertTrue(p.authorities().stream().anyMatch(a -> a.getAuthority().equals("ROLE_ADMIN")));
  }

  @Test
  void tamperedTokenRejected() {
    JwtService svc = service("test-secret-that-is-long-enough-for-hs256-123456");
    String token = svc.issue("u1", "a@b.c", "t1", "employee");
    assertThrows(JwtException.class, () -> svc.parse(token + "tampered"));
  }

  @Test
  void missingSecretFailsFast() {
    JwtService svc = service("");
    assertThrows(IllegalStateException.class, () -> svc.issue("u1", "a@b.c", "t1", "employee"));
  }
}
