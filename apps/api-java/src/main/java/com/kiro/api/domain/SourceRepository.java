package com.kiro.api.domain;

import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface SourceRepository extends JpaRepository<Source, String> {
  List<Source> findByTenantIdAndDeletedFalseOrderByCreatedAtAsc(String tenantId);

  Optional<Source> findFirstByIdAndTenantIdAndDeletedFalse(String id, String tenantId);

  Optional<Source> findFirstByTenantIdAndNameAndDeletedFalse(String tenantId, String name);

  long countByTenantIdAndDeletedFalse(String tenantId);
}
