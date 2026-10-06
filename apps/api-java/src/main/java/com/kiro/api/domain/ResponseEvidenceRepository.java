package com.kiro.api.domain;

import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ResponseEvidenceRepository extends JpaRepository<ResponseEvidence, String> {
  List<ResponseEvidence> findByResponseId(String responseId);
}
