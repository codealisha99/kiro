package com.kiro.api.domain;

import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface AiResponseRepository extends JpaRepository<AiResponse, String> {
  List<AiResponse> findByRequestIdOrderByCreatedAtDesc(String requestId);
}
