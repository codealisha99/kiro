package com.kiro.api.ai;

import com.kiro.api.config.AppProperties;
import java.util.List;
import java.util.Map;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;
import org.springframework.web.server.ResponseStatusException;

/**
 * Thin HTTP client for the Python AI service (embeddings + generation).
 * The NestJS backend stays provider-agnostic — the AI service owns the gateway.
 * NOTE: /gateway is fetched with GET (the FastAPI route only defines GET;
 * the old NestJS client wrongly POSTed — fixed here).
 */
@Service
public class AiServiceClient {

  private static final Logger log = LoggerFactory.getLogger(AiServiceClient.class);

  private final RestClient http;
  private final String baseUrl;

  public AiServiceClient(RestClient http, AppProperties props) {
    this.http = http;
    this.baseUrl = props.aiServiceUrl().replaceAll("/+$", "");
  }

  public record EmbedResult(List<List<Double>> embeddings, String model, int dimensions) {}

  public record GenerateResult(String text, String model, String modelVersion, Map<String, Object> usage) {}

  public EmbedResult embedTexts(List<String> texts) {
    try {
      var body = http.post()
          .uri(baseUrl + "/embed")
          .body(Map.of("texts", texts))
          .retrieve()
          .onStatus(s -> s.is5xxServerError() || s.is4xxClientError(),
              (req, res) -> {
                throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE,
                    "AI service error (" + res.getStatusCode().value() + ")");
              })
          .body(EmbedResponse.class);
      if (body == null) throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, "Empty AI response");
      return new EmbedResult(body.embeddings(), body.model(), body.dimensions());
    } catch (ResponseStatusException e) {
      throw e;
    } catch (Exception e) {
      log.warn("AI embed unreachable at {}/embed: {}", baseUrl, e.toString());
      throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE,
          "AI service unreachable at " + baseUrl + "/embed");
    }
  }

  public GenerateResult generate(String prompt, String systemPrompt, Integer maxTokens, Double temperature) {
    var payload = new java.util.HashMap<String, Object>();
    payload.put("prompt", prompt);
    if (systemPrompt != null) payload.put("system_prompt", systemPrompt);
    if (maxTokens != null) payload.put("max_tokens", maxTokens);
    if (temperature != null) payload.put("temperature", temperature);
    try {
      var body = http.post()
          .uri(baseUrl + "/generate")
          .body(payload)
          .retrieve()
          .onStatus(s -> s.is5xxServerError() || s.is4xxClientError(),
              (req, res) -> {
                throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE,
                    "AI service error (" + res.getStatusCode().value() + ")");
              })
          .body(GenerateResponse.class);
      if (body == null) throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, "Empty AI response");
      return new GenerateResult(body.text(), body.model(), body.model_version(), body.usage());
    } catch (ResponseStatusException e) {
      throw e;
    } catch (Exception e) {
      log.warn("AI generate unreachable at {}/generate: {}", baseUrl, e.toString());
      throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE,
          "AI service unreachable at " + baseUrl + "/generate");
    }
  }

  /** Liveness probe for /health — uses GET, matching the FastAPI contract. */
  public void status() {
    http.get().uri(baseUrl + "/gateway").retrieve().toBodilessEntity();
  }

  public record EmbedResponse(
      List<List<Double>> embeddings, String model, int dimensions, Map<String, Object> usage) {}

  public record GenerateResponse(
      String text, String model, String model_version, Map<String, Object> usage) {}
}
