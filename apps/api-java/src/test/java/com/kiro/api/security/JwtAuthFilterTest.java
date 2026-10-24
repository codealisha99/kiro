package com.kiro.api.security;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;
import com.kiro.api.domain.*;
import java.time.Instant;
import java.util.Optional;
import org.junit.jupiter.api.*;
import org.springframework.data.redis.core.*;
import org.springframework.mock.web.*;
import org.springframework.security.core.context.SecurityContextHolder;

class JwtAuthFilterTest {
  @AfterEach void clear() { SecurityContextHolder.clearContext(); }
  @Test void durableRevocationRejectsStaleRedisToken() throws Exception {
    var jwt=mock(JwtService.class); var redis=mock(StringRedisTemplate.class);
    var sessions=mock(SessionRepository.class); var users=mock(UserRepository.class);
    when(jwt.parse("token")).thenReturn(new AuthenticatedPrincipal("u","u@test","t","admin"));
    when(sessions.findByToken("token")).thenReturn(Optional.empty());
    var request=new MockHttpServletRequest(); request.addHeader("Authorization","Bearer token");
    new JwtAuthFilter(jwt,redis,sessions,users).doFilter(request,new MockHttpServletResponse(),new MockFilterChain());
    assertNull(SecurityContextHolder.getContext().getAuthentication());
    verifyNoInteractions(redis);
  }
  @Test void currentDatabaseRoleOverridesJwtRole() throws Exception {
    var jwt=mock(JwtService.class); var redis=mock(StringRedisTemplate.class);
    var values=mock(ValueOperations.class); when(redis.opsForValue()).thenReturn(values);
    when(values.get("session:u")).thenReturn("token");
    var sessions=mock(SessionRepository.class); var users=mock(UserRepository.class);
    when(jwt.parse("token")).thenReturn(new AuthenticatedPrincipal("u","u@test","t","admin"));
    Session session=new Session(); session.setUserId("u"); session.setExpiresAt(Instant.now().plusSeconds(60));
    User user=new User(); user.setId("u"); user.setTenantId("t"); user.setEmail("u@test"); user.setRole("EMPLOYEE");
    when(sessions.findByToken("token")).thenReturn(Optional.of(session)); when(users.findById("u")).thenReturn(Optional.of(user));
    var request=new MockHttpServletRequest(); request.addHeader("Authorization","Bearer token");
    new JwtAuthFilter(jwt,redis,sessions,users).doFilter(request,new MockHttpServletResponse(),new MockFilterChain());
    assertEquals("employee",JwtAuthFilter.current().orElseThrow().role());
  }
}
