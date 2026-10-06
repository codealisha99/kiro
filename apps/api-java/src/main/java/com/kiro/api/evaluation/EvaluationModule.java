package com.kiro.api.evaluation;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.kiro.api.rag.RagService;
import com.kiro.api.retrieval.RetrievalService;
import com.kiro.api.retrieval.RetrievedChunk;
import com.kiro.api.security.AuthenticatedPrincipal;
import java.io.InputStream;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.springframework.core.io.ClassPathResource;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.stereotype.Service;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@Service
class EvaluationService {

  private final RetrievalService retrieval;
  private final RagService rag;
  private final ObjectMapper mapper;

  EvaluationService(RetrievalService retrieval, RagService rag, ObjectMapper mapper) {
    this.retrieval = retrieval;
    this.rag = rag;
    this.mapper = mapper;
  }

  List<Map<String, Object>> loadGolden() {
    try (InputStream in = new ClassPathResource("evals/golden.json").getInputStream()) {
      return mapper.readValue(in, new TypeReference<>() {});
    } catch (Exception e) {
      throw new IllegalStateException("Cannot load evals/golden.json", e);
    }
  }

  @SuppressWarnings("unchecked")
  Map<String, Object> runRetrieval(AuthenticatedPrincipal user) {
    List<Map<String, Object>> results = new ArrayList<>();
    for (Map<String, Object> c : loadGolden()) {
      String q = String.valueOf(c.get("query"));
      List<RetrievedChunk> chunks = retrieval.search(user, q, 5);
      Set<String> retrieved = new LinkedHashSet<>();
      for (RetrievedChunk ch : chunks) retrieved.add(ch.title().toLowerCase());
      List<String> expected = (List<String>) c.getOrDefault("expectedDocuments", List.of());
      boolean hit;
      if (expected.isEmpty()) {
        hit = chunks.isEmpty();
      } else {
        hit = false;
        for (String exp : expected) {
          String first = exp.replace("-", " ").split(" ")[0];
          for (String t : retrieved) {
            if (t.contains(first)) {
              hit = true;
              break;
            }
          }
          if (hit) break;
        }
      }
      var r = new LinkedHashMap<String, Object>();
      r.put("id", c.get("id"));
      r.put("query", q);
      r.put("type", c.get("type"));
      r.put("retrieved", new ArrayList<>(retrieved));
      r.put("expected", expected);
      r.put("hit", hit);
      results.add(r);
    }
    long hits = results.stream().filter(r -> Boolean.TRUE.equals(r.get("hit"))).count();
    long withExpected = results.stream()
        .filter(r -> !((List<?>) r.get("expected")).isEmpty()).count();
    var out = new LinkedHashMap<String, Object>();
    out.put("total", results.size());
    out.put("hits", hits);
    out.put("hitRate", results.isEmpty() ? 0 : (double) hits / results.size());
    out.put("recallAt5", (double) hits / Math.max(1, withExpected));
    out.put("results", results);
    return out;
  }

  @SuppressWarnings("unchecked")
  Map<String, Object> runRag(AuthenticatedPrincipal user) {
    List<Map<String, Object>> results = new ArrayList<>();
    for (Map<String, Object> c : loadGolden()) {
      String q = String.valueOf(c.get("query"));
      Map<String, Object> res = rag.query(user, q, null);
      boolean expectUnknown = Boolean.TRUE.equals(c.get("expectUnknown"));
      String answer = String.valueOf(res.get("answer"));
      boolean answerOk;
      if (expectUnknown) {
        answerOk = "unknown".equals(res.get("status"));
      } else {
        answerOk = false;
        List<String> frags = (List<String>) c.getOrDefault("expectedAnswerContains", List.of());
        for (String frag : frags) {
          if (answer.toLowerCase().contains(frag.toLowerCase())) {
            answerOk = true;
            break;
          }
        }
      }
      List<String> titles = new ArrayList<>();
      for (Object s : (List<?>) res.get("sources")) {
        titles.add(String.valueOf(((Map<?, ?>) s).get("title")));
      }
      var r = new LinkedHashMap<String, Object>();
      r.put("id", c.get("id"));
      r.put("query", q);
      r.put("type", c.get("type"));
      r.put("retrieved", titles);
      r.put("expected", c.getOrDefault("expectedDocuments", List.of()));
      r.put("hit", answerOk);
      r.put("answerOk", answerOk);
      r.put("answer", answer.length() > 400 ? answer.substring(0, 400) : answer);
      r.put("status", res.get("status"));
      results.add(r);
    }
    long ok = results.stream().filter(r -> Boolean.TRUE.equals(r.get("answerOk"))).count();
    var out = new LinkedHashMap<String, Object>();
    out.put("total", results.size());
    out.put("ok", ok);
    out.put("accuracy", results.isEmpty() ? 0 : (double) ok / results.size());
    out.put("results", results);
    return out;
  }
}

@RestController
@RequestMapping("/evals")
class EvaluationController {

  private final EvaluationService evals;

  EvaluationController(EvaluationService evals) {
    this.evals = evals;
  }

  // Guarded: evals hit the LLM per case (cost) and are admin/ops tooling.
  @GetMapping("/retrieval")
  @PreAuthorize("hasAnyRole('MANAGER','ADMIN')")
  public Map<String, Object> retrieval(@AuthenticationPrincipal AuthenticatedPrincipal user) {
    return evals.runRetrieval(user);
  }

  @GetMapping("/rag")
  @PreAuthorize("hasAnyRole('MANAGER','ADMIN')")
  public Map<String, Object> rag(@AuthenticationPrincipal AuthenticatedPrincipal user) {
    return evals.runRag(user);
  }
}
