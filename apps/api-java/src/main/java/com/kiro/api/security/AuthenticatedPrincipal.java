package com.kiro.api.security;

import java.util.Collection;
import java.util.List;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;

/** Authenticated principal: user id + tenant id + lowercase role (mirrors NestJS AuthenticatedUser). */
public record AuthenticatedPrincipal(String id, String email, String tenantId, String role) {

  public String roleUpper() {
    return role.toUpperCase();
  }

  public Collection<? extends GrantedAuthority> authorities() {
    return List.of(new SimpleGrantedAuthority("ROLE_" + role.toUpperCase()));
  }

  public boolean isAdmin() {
    return "admin".equalsIgnoreCase(role);
  }

  public boolean isManagerOrAdmin() {
    return "manager".equalsIgnoreCase(role) || isAdmin();
  }
}
