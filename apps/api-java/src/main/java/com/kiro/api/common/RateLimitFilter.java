package com.kiro.api.common;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.time.Duration;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

/**
 * 30 requests / 60s per user-or-IP on sensitive endpoints (mirrors ThrottleGuard:
 * key = handler + (userId or ip)). Redis-backed with in-memory fallback. Login and registration are
 * keyed by client IP, which bounds password guessing per address; it does not stop an attacker who
 * rotates addresses (a per-account limit would, at the cost of letting anyone lock a user out).
 */
@Component
public class RateLimitFilter extends OncePerRequestFilter {

  static final int MAX_REQUESTS = 30;
  static final Duration WINDOW = Duration.ofMinutes(1);
  static final java.util.Set<String> SENSITIVE_POSTS =
      java.util.Set.of("/brain/query", "/documents/upload", "/auth/login", "/auth/register");

  private final StringRedisTemplate redis;
  private final ConcurrentHashMap<String, Bucket> memory = new ConcurrentHashMap<>();

  public RateLimitFilter(StringRedisTemplate redis) {
    this.redis = redis;
  }

  @Override
  protected boolean shouldNotFilter(HttpServletRequest req) {
    String uri = req.getRequestURI();
    String method = req.getMethod();
    boolean sensitive = "POST".equals(method) && SENSITIVE_POSTS.contains(uri);
    return !sensitive;
  }

  @Override
  protected void doFilterInternal(HttpServletRequest req, HttpServletResponse res, FilterChain chain)
      throws ServletException, IOException {
    String who = com.kiro.api.security.JwtAuthFilter.current()
        .map(com.kiro.api.security.AuthenticatedPrincipal::id)
        .orElseGet(() -> Optional.ofNullable(req.getRemoteAddr()).orElse("anon"));
    String key = "throttle:" + req.getMethod() + ":" + req.getRequestURI() + ":" + who;
    if (overLimit(key)) {
      // Written here rather than thrown: an exception from a servlet filter becomes an /error
      // dispatch, which Spring Security answers with 401 for anonymous callers.
      res.setStatus(HttpStatus.TOO_MANY_REQUESTS.value());
      res.setHeader("Retry-After", String.valueOf(WINDOW.toSeconds()));
      res.setContentType("application/json");
      res.getWriter().write("{\"message\":\"Too many requests, try again later\"}");
      return;
    }
    chain.doFilter(req, res);
  }

  private boolean overLimit(String key) {
    try {
      Long count = redis.opsForValue().increment(key);
      if (count != null && count == 1L) {
        redis.expire(key, WINDOW);
      }
      return count != null && count > MAX_REQUESTS;
    } catch (Exception redisDown) {
      Bucket b = memory.computeIfAbsent(key, k -> new Bucket());
      synchronized (b) {
        long now = System.currentTimeMillis();
        if (now > b.resetAt) {
          b.count = 0;
          b.resetAt = now + WINDOW.toMillis();
        }
        return ++b.count > MAX_REQUESTS;
      }
    }
  }

  private static final class Bucket {
    int count;
    long resetAt;
  }
}
