package com.kiro.api.config;

import java.time.Duration;
import java.net.http.HttpClient;
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
    // Uvicorn does not support h2c upgrades; the JDK HTTP/2 default drops POST
    // bodies during that upgrade, leaving FastAPI with an empty request body.
    var client = HttpClient.newBuilder()
        .version(HttpClient.Version.HTTP_1_1)
        .connectTimeout(Duration.ofSeconds(30))
        .build();
    var factory = new JdkClientHttpRequestFactory(client);
    factory.setReadTimeout(Duration.ofSeconds(30));
    return builder.requestFactory(factory).build();
  }
}
