package com.kiro.api.domain;

import java.util.List;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

public interface AuditLogRepository extends JpaRepository<AuditLog, String> {
  List<AuditLog> findByTenantIdOrderByCreatedAtDesc(String tenantId, Pageable pageable);

  List<AuditLog> findTop10ByTenantIdAndActionOrderByCreatedAtDesc(String tenantId, String action);
}
