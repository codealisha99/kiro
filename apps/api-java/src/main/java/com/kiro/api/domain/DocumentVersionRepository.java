package com.kiro.api.domain;

import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface DocumentVersionRepository extends JpaRepository<DocumentVersion, String> {
  List<DocumentVersion> findByDocumentIdOrderByVersionDesc(String documentId);

  Optional<DocumentVersion> findFirstByDocumentIdOrderByVersionDesc(String documentId);
}
