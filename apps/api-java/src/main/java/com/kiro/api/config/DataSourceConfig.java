package com.kiro.api.config;

import com.zaxxer.hikari.HikariDataSource;
import java.net.URI;
import java.net.URISyntaxException;
import java.util.ArrayList;
import java.util.List;
import javax.sql.DataSource;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnExpression;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Primary;

/**
 * Builds the JDBC DataSource from {@code DATABASE_URL}, accepting BOTH:
 * <ul>
 *   <li>{@code jdbc:postgresql://...} (native JDBC), and</li>
 *   <li>{@code postgresql://user:pass@host:port/db?...} (Prisma/NestJS and Neon style, same env var)</li>
 * </ul>
 * Query parameters such as {@code sslmode} are kept. Neon's {@code channel_binding} is mapped to
 * pgjdbc's {@code channelBinding}. The Prisma-only {@code schema} parameter is dropped, and
 * {@code stringtype=unspecified} is added so String-mapped enum columns work against native PG enums.
 */
@Configuration
@ConditionalOnExpression("'${DATABASE_URL:}' != ''")
public class DataSourceConfig {

  /** Resolved JDBC connection settings. */
  record Connection(String jdbcUrl, String user, String password) {}

  @Bean
  @Primary
  public DataSource dataSource(
      @Value("${DATABASE_URL:}") String databaseUrl,
      @Value("${DB_USER:kiro}") String dbUser,
      @Value("${DB_PASSWORD:kiro}") String dbPassword) {
    HikariDataSource ds = new HikariDataSource();
    Connection conn;
    if (databaseUrl != null && databaseUrl.startsWith("jdbc:")) {
      conn = new Connection(withParams(databaseUrl), dbUser, dbPassword);
    } else if (databaseUrl != null && databaseUrl.startsWith("postgresql://")) {
      try {
        conn = parsePostgresUrl(databaseUrl, dbUser, dbPassword);
      } catch (URISyntaxException e) {
        throw new IllegalStateException("Cannot parse DATABASE_URL: " + e.getMessage(), e);
      }
    } else {
      // Fall back to Boot's spring.datasource.* properties (tests, explicit JDBC config).
      conn = new Connection("jdbc:postgresql://localhost:5433/kiro?stringtype=unspecified", dbUser, dbPassword);
    }
    ds.setJdbcUrl(conn.jdbcUrl());
    ds.setUsername(conn.user());
    ds.setPassword(conn.password());
    ds.setMaximumPoolSize(10);
    return ds;
  }

  /** Converts {@code postgresql://user:pass@host:port/db?params} to a pgjdbc connection. */
  static Connection parsePostgresUrl(String url, String defaultUser, String defaultPassword) throws URISyntaxException {
    URI uri = new URI(url);
    String user = defaultUser;
    String pass = defaultPassword;
    String userInfo = uri.getUserInfo();
    if (userInfo != null && userInfo.contains(":")) {
      user = userInfo.substring(0, userInfo.indexOf(':'));
      pass = userInfo.substring(userInfo.indexOf(':') + 1);
    }
    String path = uri.getPath() == null || uri.getPath().isBlank() ? "/kiro" : uri.getPath();
    String jdbc = "jdbc:postgresql://" + uri.getHost() + ":" + (uri.getPort() == -1 ? 5432 : uri.getPort()) + path;
    if (uri.getRawQuery() != null) jdbc += "?" + uri.getRawQuery();
    return new Connection(withParams(jdbc), user, pass);
  }

  /** Drops Prisma-only params, renames Neon's channel_binding, and ensures stringtype=unspecified. */
  static String withParams(String url) {
    int q = url.indexOf('?');
    String base = q < 0 ? url : url.substring(0, q);
    List<String> params = new ArrayList<>();
    boolean hasStringType = false;
    if (q >= 0) {
      for (String pair : url.substring(q + 1).split("&")) {
        if (pair.isBlank() || pair.startsWith("schema=")) continue;
        if (pair.startsWith("channel_binding=")) pair = "channelBinding=" + pair.substring("channel_binding=".length());
        if (pair.startsWith("stringtype=")) hasStringType = true;
        params.add(pair);
      }
    }
    if (!hasStringType) params.add("stringtype=unspecified");
    return base + "?" + String.join("&", params);
  }
}
