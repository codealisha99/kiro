package com.kiro.api.config;

import com.kiro.api.common.RateLimitFilter;
import com.kiro.api.security.JwtAuthFilter;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;

@Configuration
@EnableMethodSecurity(prePostEnabled = true)
public class SecurityConfig {

  private final JwtAuthFilter jwtFilter;
  private final RateLimitFilter rateLimitFilter;

  public SecurityConfig(JwtAuthFilter jwtFilter, RateLimitFilter rateLimitFilter) {
    this.jwtFilter = jwtFilter;
    this.rateLimitFilter = rateLimitFilter;
  }

  @Bean
  public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
    http
        .csrf(AbstractHttpConfigurer::disable)
        .sessionManagement(sm -> sm.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
        // Contract parity with NestJS JwtAuthGuard: unauthenticated → 401 JSON, wrong role → 403.
        .exceptionHandling(e -> e
            .authenticationEntryPoint((req, res, ex) -> {
              res.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
              res.setContentType("application/json");
              res.getWriter().write("{\"message\":\"Unauthorized\"}");
            })
            .accessDeniedHandler((req, res, ex) -> {
              res.setStatus(HttpServletResponse.SC_FORBIDDEN);
              res.setContentType("application/json");
              res.getWriter().write("{\"message\":\"Forbidden\"}");
            }))
        .authorizeHttpRequests(auth -> auth
            .requestMatchers(HttpMethod.POST, "/auth/register", "/auth/login").permitAll()
            .requestMatchers(HttpMethod.GET, "/health", "/actuator/health", "/actuator/info").permitAll()
            // Everything else (incl. /metrics, /admin/health-less, /evals) requires auth;
            // role checks live on the controllers via @PreAuthorize.
            .anyRequest().authenticated())
        .addFilterBefore(jwtFilter, UsernamePasswordAuthenticationFilter.class)
        .addFilterAfter(rateLimitFilter, JwtAuthFilter.class);
    return http.build();
  }
}
