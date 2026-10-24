package com.kiro.api.security;

import io.jsonwebtoken.JwtException;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.util.Optional;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

/**
 * Validates Bearer JWT and enforces the Redis session marker
 * ({@code session:{userId} == token}). Logout deletes the marker, so a
 * logged-out token is rejected here (the NestJS jti-delete was a no-op;
 * this backend makes logout actually invalidate the session).
 */
@Component
public class JwtAuthFilter extends OncePerRequestFilter {

  private static final Logger log = LoggerFactory.getLogger(JwtAuthFilter.class);

  private final JwtService jwt;
  private final StringRedisTemplate redis;
  private final com.kiro.api.domain.SessionRepository sessions;
  private final com.kiro.api.domain.UserRepository users;

  public JwtAuthFilter(JwtService jwt, StringRedisTemplate redis,
      com.kiro.api.domain.SessionRepository sessions, com.kiro.api.domain.UserRepository users) {
    this.jwt = jwt;
    this.redis = redis;
    this.sessions = sessions;
    this.users = users;
  }

  @Override
  protected void doFilterInternal(HttpServletRequest req, HttpServletResponse res, FilterChain chain)
      throws ServletException, IOException {
    String header = req.getHeader("Authorization");
    if (header != null && header.startsWith("Bearer ")) {
      String token = header.substring(7).trim();
      try {
        AuthenticatedPrincipal principal = jwt.parse(token);
        var session = sessions.findByToken(token).orElse(null);
        var user = users.findById(principal.id()).orElse(null);
        if (session == null || !session.getUserId().equals(principal.id())
            || !session.getExpiresAt().isAfter(java.time.Instant.now())
            || user == null || !user.getTenantId().equals(principal.tenantId())) {
          throw new JwtException("Session no longer valid");
        }
        // Current database role wins over stale JWT role claims.
        principal = new AuthenticatedPrincipal(user.getId(), user.getEmail(), user.getTenantId(), user.getRole().toLowerCase());
        String marker = redis.opsForValue().get("session:" + principal.id());
        if (marker == null || !marker.equals(token)) {
          res.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
          res.setContentType("application/json");
          res.getWriter().write("{\"message\":\"Session no longer valid\"}");
          return;
        }
        var auth = new UsernamePasswordAuthenticationToken(principal, token, principal.authorities());
        SecurityContextHolder.getContext().setAuthentication(auth);
      } catch (JwtException e) {
        log.debug("JWT rejected: {}", e.getMessage());
      } catch (Exception e) {
        log.debug("Session check failed (redis unavailable?): {}", e.getMessage());
        // Fail-closed on auth infrastructure errors for state-changing requests is handled
        // by downstream 401 (no authentication set). Reads behave the same.
      }
    }
    chain.doFilter(req, res);
  }

  public static Optional<AuthenticatedPrincipal> current() {
    var auth = SecurityContextHolder.getContext().getAuthentication();
    if (auth != null && auth.getPrincipal() instanceof AuthenticatedPrincipal p) {
      return Optional.of(p);
    }
    return Optional.empty();
  }
}
