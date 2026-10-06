package com.kiro.api.security;

import com.kiro.api.config.AppProperties;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.JwtException;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import java.nio.charset.StandardCharsets;
import java.util.Date;
import javax.crypto.SecretKey;
import org.springframework.stereotype.Service;

@Service
public class JwtService {

  private final AppProperties props;

  public JwtService(AppProperties props) {
    this.props = props;
  }

  public SecretKey key() {
    String secret = props.jwt().secret();
    if (secret == null || secret.isBlank()) {
      throw new IllegalStateException(
          "JWT secret is not configured. Set JWT_SECRET (fail-fast: no dev fallback in this backend).");
    }
    byte[] bytes = secret.getBytes(StandardCharsets.UTF_8);
    if (bytes.length < 32) {
      // Pad short dev secrets to the HS256 minimum; production must use a long secret.
      byte[] padded = new byte[32];
      System.arraycopy(bytes, 0, padded, 0, bytes.length);
      bytes = padded;
    }
    return Keys.hmacShaKeyFor(bytes);
  }

  public String issue(String userId, String email, String tenantId, String role) {
    long expiresIn = props.jwt().expiresInSeconds();
    Date now = new Date();
    return Jwts.builder()
        .subject(userId)
        .claim("email", email)
        .claim("tenantId", tenantId)
        .claim("role", role.toLowerCase())
        .issuedAt(now)
        .expiration(new Date(now.getTime() + expiresIn * 1000))
        .signWith(key())
        .compact();
  }

  public AuthenticatedPrincipal parse(String token) {
    try {
      Claims claims = Jwts.parser().verifyWith(key()).build().parseSignedClaims(token).getPayload();
      String sub = claims.getSubject();
      String tenantId = claims.get("tenantId", String.class);
      if (sub == null || tenantId == null) {
        throw new JwtException("JWT missing sub/tenantId");
      }
      return new AuthenticatedPrincipal(
          sub,
          claims.get("email", String.class),
          tenantId,
          String.valueOf(claims.get("role", String.class)).toLowerCase());
    } catch (JwtException | IllegalArgumentException e) {
      throw new JwtException("Invalid JWT: " + e.getMessage(), e);
    }
  }
}
