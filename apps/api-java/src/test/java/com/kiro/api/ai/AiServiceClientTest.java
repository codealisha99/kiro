package com.kiro.api.ai;

import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.*;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess;

import com.kiro.api.config.AppProperties;
import com.kiro.api.config.AppConfig;
import com.sun.net.httpserver.HttpServer;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.atomic.AtomicReference;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestClient;

class AiServiceClientTest {
  @Test
  void realTransportSendsPostBodyWithoutAnH2cUpgrade() throws Exception {
    HttpServer server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
    AtomicReference<String> upgrade = new AtomicReference<>();
    AtomicReference<String> body = new AtomicReference<>();
    server.createContext("/embed", exchange -> {
      upgrade.set(exchange.getRequestHeaders().getFirst("Upgrade"));
      body.set(new String(exchange.getRequestBody().readAllBytes(), StandardCharsets.UTF_8));
      byte[] response = "{\"embeddings\":[[1.0]],\"model\":\"embed\",\"dimensions\":1,\"usage\":{}}".getBytes(StandardCharsets.UTF_8);
      exchange.getResponseHeaders().set("Content-Type", "application/json");
      exchange.sendResponseHeaders(200, response.length);
      exchange.getResponseBody().write(response);
      exchange.close();
    });
    server.start();
    try {
      AiServiceClient client = new AiServiceClient(new AppConfig().restClient(RestClient.builder()),
          new AppProperties(null, null, "http://127.0.0.1:" + server.getAddress().getPort(), null, null, 0, 0));
      assertEquals(1, client.embedTexts(List.of("refund policy")).dimensions());
      assertNull(upgrade.get(), "FastAPI must receive HTTP/1.1 without an h2c upgrade");
      assertEquals("refund policy", new com.fasterxml.jackson.databind.ObjectMapper()
          .readTree(body.get()).get("texts").get(0).asText());
    } finally {
      server.stop(0);
    }
  }

  @Test
  void sendsJsonToFastApiAndReadsSnakeCaseModelVersion() {
    RestClient.Builder builder = RestClient.builder();
    MockRestServiceServer server = MockRestServiceServer.bindTo(builder).build();
    AiServiceClient client = new AiServiceClient(builder.build(),
        new AppProperties(null, null, "http://ai:8000", null, null, 0, 0));
    server.expect(requestTo("http://ai:8000/embed"))
        .andExpect(content().contentType(MediaType.APPLICATION_JSON))
        .andExpect(content().json("{\"texts\":[\"refund policy\"]}"))
        .andRespond(withSuccess("{\"embeddings\":[[1.0]],\"model\":\"embed\",\"dimensions\":1,\"usage\":{}}", MediaType.APPLICATION_JSON));
    server.expect(requestTo("http://ai:8000/generate"))
        .andExpect(content().contentType(MediaType.APPLICATION_JSON))
        .andExpect(content().json("{\"prompt\":\"question\",\"system_prompt\":\"evidence only\",\"max_tokens\":100}"))
        .andRespond(withSuccess("{\"text\":\"answer\",\"model\":\"chat\",\"model_version\":\"v1\",\"usage\":{}}", MediaType.APPLICATION_JSON));
    assertEquals(1, client.embedTexts(List.of("refund policy")).dimensions());
    assertEquals("v1", client.generate("question", "evidence only", 100, null).modelVersion());
    server.verify();
  }
}
