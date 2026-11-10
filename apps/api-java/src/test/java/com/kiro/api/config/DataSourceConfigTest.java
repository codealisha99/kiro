package com.kiro.api.config;

import static org.junit.jupiter.api.Assertions.*;

import java.net.URISyntaxException;
import org.junit.jupiter.api.Test;

class DataSourceConfigTest {

  @Test
  void neonUrlKeepsSslModeAndMapsChannelBinding() throws URISyntaxException {
    var c = DataSourceConfig.parsePostgresUrl(
        "postgresql://alice:s3cret@ep-cool-1.us-east-2.aws.neon.tech/neondb?sslmode=require&channel_binding=require&schema=public",
        "kiro", "kiro");
    assertEquals("jdbc:postgresql://ep-cool-1.us-east-2.aws.neon.tech:5432/neondb?sslmode=require&channelBinding=require&stringtype=unspecified",
        c.jdbcUrl());
    assertEquals("alice", c.user());
    assertEquals("s3cret", c.password());
  }

  @Test
  void urlWithoutQueryGetsOnlyStringType() throws URISyntaxException {
    var c = DataSourceConfig.parsePostgresUrl("postgresql://kiro:kiro@localhost:5433/kiro", "x", "y");
    assertEquals("jdbc:postgresql://localhost:5433/kiro?stringtype=unspecified", c.jdbcUrl());
  }

  @Test
  void defaultsApplyWhenUrlHasNoCredentials() throws URISyntaxException {
    var c = DataSourceConfig.parsePostgresUrl("postgresql://db.internal/app?sslmode=require", "kiro", "pw");
    assertEquals("jdbc:postgresql://db.internal:5432/app?sslmode=require&stringtype=unspecified", c.jdbcUrl());
    assertEquals("kiro", c.user());
    assertEquals("pw", c.password());
  }

  @Test
  void jdbcUrlStripsPrismaSchemaAndKeepsOtherParams() {
    assertEquals("jdbc:postgresql://h:5432/d?sslmode=require&stringtype=unspecified",
        DataSourceConfig.withParams("jdbc:postgresql://h:5432/d?schema=public&sslmode=require"));
    assertEquals("jdbc:postgresql://h:5432/d?stringtype=unspecified", DataSourceConfig.withParams("jdbc:postgresql://h:5432/d?schema=public"));
  }
}
