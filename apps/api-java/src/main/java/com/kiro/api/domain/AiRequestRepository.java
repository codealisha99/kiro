package com.kiro.api.domain;

import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface AiRequestRepository extends JpaRepository<AiRequest, String> {
  List<AiRequest> findByConversationIdOrderByCreatedAtAsc(String conversationId);

  Optional<AiRequest> findFirstByIdAndTenantIdAndUserId(String id, String tenantId, String userId);

  long countByTenantId(String tenantId);
}
