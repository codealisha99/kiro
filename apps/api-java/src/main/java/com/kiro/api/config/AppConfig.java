package com.kiro.api.config;

import java.time.Duration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.client.JdkClientHttpRequestFactory;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.client.RestClient;

@Configuration
public class AppConfig {

  @Bean
  public PasswordEncoder passwordEncoder() {
    return new BCryptPasswordEncoder(10);
  }

  @Bean
  public RestClient restClient(RestClient.Builder builder) {
    // 30s connect/read timeouts (mirrors AbortSignal.timeout(30_000) in NestJS).
    var factory = new JdkClientHttpRequestFactory();
    factory.setReadTimeout(Duration.ofSeconds(30));
    return builder.requestFactory(factory).build();
  }
}
