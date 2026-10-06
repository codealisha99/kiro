package com.kiro.api.domain;

import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface DocumentChunkRepository extends JpaRepository<DocumentChunk, String> {
  List<DocumentChunk> findByDocumentVersionId(String versionId);

  List<DocumentChunk> findByIdIn(List<String> ids);
}
