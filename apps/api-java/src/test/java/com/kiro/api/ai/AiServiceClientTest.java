package com.kiro.api.ai;

import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.*;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess;

import com.kiro.api.config.AppProperties;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestClient;

class AiServiceClientTest {
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
