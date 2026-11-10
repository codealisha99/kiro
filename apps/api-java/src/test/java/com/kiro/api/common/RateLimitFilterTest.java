package com.kiro.api.common;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

import org.junit.jupiter.api.Test;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.mock.web.MockFilterChain;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.web.server.ResponseStatusException;

class RateLimitFilterTest {
  // Redis unavailable: the filter must still limit through its in-memory fallback.
  private final StringRedisTemplate redis = mock(StringRedisTemplate.class, inv -> { throw new IllegalStateException("redis down"); });
  private final RateLimitFilter filter = new RateLimitFilter(redis);

  private static MockHttpServletRequest post(String uri, String ip) {
    var request = new MockHttpServletRequest("POST", uri);
    request.setRemoteAddr(ip);
    return request;
  }

  @Test
  void loginIsLimitedPerClientAddress() throws Exception {
    for (int i = 0; i < RateLimitFilter.MAX_REQUESTS; i++) {
      filter.doFilter(post("/auth/login", "203.0.113.7"), new MockHttpServletResponse(), new MockFilterChain());
    }
    var error = assertThrows(ResponseStatusException.class,
        () -> filter.doFilter(post("/auth/login", "203.0.113.7"), new MockHttpServletResponse(), new MockFilterChain()));
    assertEquals(429, error.getStatusCode().value());
    // Another address keeps its own budget.
    assertDoesNotThrow(() -> filter.doFilter(post("/auth/login", "198.51.100.9"), new MockHttpServletResponse(), new MockFilterChain()));
  }

  @Test
  void onlySensitiveWritesAreLimited() {
    assertFalse(filter.shouldNotFilter(post("/auth/register", "203.0.113.7")));
    assertFalse(filter.shouldNotFilter(post("/brain/query", "203.0.113.7")));
    assertTrue(filter.shouldNotFilter(new MockHttpServletRequest("GET", "/home")));
    assertTrue(filter.shouldNotFilter(post("/goals", "203.0.113.7")));
  }
}
