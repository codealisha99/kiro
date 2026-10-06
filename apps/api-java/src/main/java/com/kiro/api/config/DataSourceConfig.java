package com.kiro.api.config;

import com.zaxxer.hikari.HikariDataSource;
import java.net.URI;
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
 *   <li>{@code postgresql://user:pass@host:port/db?...} (Prisma/NestJS style, same env var)</li>
 * </ul>
 * so the Java backend is a drop-in replacement without env changes. The Prisma-only
 * {@code ?schema=} parameter is stripped; {@code stringtype=unspecified} is appended so
 * String-mapped enum columns work against native PG enums.
 */
@Configuration
@ConditionalOnExpression("'${DATABASE_URL:}' != ''")
public class DataSourceConfig {

  @Bean
  @Primary
  public DataSource dataSource(
      @Value("${DATABASE_URL:}") String databaseUrl,
      @Value("${DB_USER:kiro}") String dbUser,
      @Value("${DB_PASSWORD:kiro}") String dbPassword) {
    HikariDataSource ds = new HikariDataSource();
    if (databaseUrl != null && databaseUrl.startsWith("jdbc:")) {
      ds.setJdbcUrl(appendParam(databaseUrl, "stringtype", "unspecified"));
      ds.setUsername(dbUser);
      ds.setPassword(dbPassword);
    } else if (databaseUrl != null && databaseUrl.startsWith("postgresql://")) {
      try {
        URI uri = new URI(databaseUrl);
        String userInfo = uri.getUserInfo();
        String user = dbUser;
        String pass = dbPassword;
        if (userInfo != null && userInfo.contains(":")) {
          user = userInfo.substring(0, userInfo.indexOf(':'));
          pass = userInfo.substring(userInfo.indexOf(':') + 1);
        }
        String path = uri.getPath() == null || uri.getPath().isBlank() ? "/kiro" : uri.getPath();
        String jdbc = "jdbc:postgresql://" + uri.getHost() + ":" + (uri.getPort() == -1 ? 5432 : uri.getPort())
            + path;
        jdbc = appendParam(jdbc, "stringtype", "unspecified");
        ds.setJdbcUrl(jdbc);
        ds.setUsername(user);
        ds.setPassword(pass);
      } catch (Exception e) {
        throw new IllegalStateException("Cannot parse DATABASE_URL: " + e.getMessage(), e);
      }
    } else {
      // Fall back to Boot's spring.datasource.* properties (tests, explicit JDBC config).
      ds.setJdbcUrl("jdbc:postgresql://localhost:5433/kiro?stringtype=unspecified");
      ds.setUsername(dbUser);
      ds.setPassword(dbPassword);
    }
    ds.setMaximumPoolSize(10);
    return ds;
  }

  private static String appendParam(String url, String key, String value) {
    // strip Prisma-only params that pgjdbc would choke on
    String cleaned = url.replaceAll("[?&]schema=[^&]*", "");
    cleaned = cleaned.replaceAll("\\?$", "");
    return cleaned + (cleaned.contains("?") ? "&" : "?") + key + "=" + value;
  }
}
