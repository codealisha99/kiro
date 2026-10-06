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
import org.springframework.web.server.ResponseStatusException;

/**
 * 30 requests / 60s per user-or-IP on sensitive endpoints (mirrors ThrottleGuard:
 * key = handler + (userId or ip)). Redis-backed with in-memory fallback.
 */
@Component
public class RateLimitFilter extends OncePerRequestFilter {

  static final int MAX_REQUESTS = 30;
  static final Duration WINDOW = Duration.ofMinutes(1);

  private final StringRedisTemplate redis;
  private final ConcurrentHashMap<String, Bucket> memory = new ConcurrentHashMap<>();

  public RateLimitFilter(StringRedisTemplate redis) {
    this.redis = redis;
  }

  @Override
  protected boolean shouldNotFilter(HttpServletRequest req) {
    String uri = req.getRequestURI();
    String method = req.getMethod();
    boolean sensitive =
        ("POST".equals(method) && "/brain/query".equals(uri))
            || ("POST".equals(method) && "/documents/upload".equals(uri));
    return !sensitive;
  }

  @Override
  protected void doFilterInternal(HttpServletRequest req, HttpServletResponse res, FilterChain chain)
      throws ServletException, IOException {
    String who = com.kiro.api.security.JwtAuthFilter.current()
        .map(com.kiro.api.security.AuthenticatedPrincipal::id)
        .orElseGet(() -> Optional.ofNullable(req.getRemoteAddr()).orElse("anon"));
    String key = "throttle:" + req.getMethod() + ":" + req.getRequestURI() + ":" + who;
    try {
      Long count = redis.opsForValue().increment(key);
      if (count != null && count == 1L) {
        redis.expire(key, WINDOW);
      }
      if (count != null && count > MAX_REQUESTS) {
        throw new ResponseStatusException(HttpStatus.TOO_MANY_REQUESTS, "Too many requests, try again later");
      }
    } catch (ResponseStatusException e) {
      throw e;
    } catch (Exception redisDown) {
      Bucket b = memory.computeIfAbsent(key, k -> new Bucket());
      synchronized (b) {
        long now = System.currentTimeMillis();
        if (now > b.resetAt) {
          b.count = 0;
          b.resetAt = now + WINDOW.toMillis();
        }
        if (++b.count > MAX_REQUESTS) {
          throw new ResponseStatusException(HttpStatus.TOO_MANY_REQUESTS, "Too many requests, try again later");
        }
      }
    }
    chain.doFilter(req, res);
  }

  private static final class Bucket {
    int count;
    long resetAt;
  }
}
