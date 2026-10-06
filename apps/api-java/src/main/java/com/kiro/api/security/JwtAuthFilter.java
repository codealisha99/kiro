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

  public JwtAuthFilter(JwtService jwt, StringRedisTemplate redis) {
    this.jwt = jwt;
    this.redis = redis;
  }

  @Override
  protected void doFilterInternal(HttpServletRequest req, HttpServletResponse res, FilterChain chain)
      throws ServletException, IOException {
    String header = req.getHeader("Authorization");
    if (header != null && header.startsWith("Bearer ")) {
      String token = header.substring(7).trim();
      try {
        AuthenticatedPrincipal principal = jwt.parse(token);
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
