package com.kiro.api.domain;

import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ConversationRepository extends JpaRepository<Conversation, String> {
  List<Conversation> findByTenantIdAndUserIdOrderByUpdatedAtDesc(String tenantId, String userId);

  Optional<Conversation> findFirstByIdAndTenantIdAndUserId(
      String id, String tenantId, String userId);
}
