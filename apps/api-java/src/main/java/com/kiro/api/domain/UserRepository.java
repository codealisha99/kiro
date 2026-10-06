package com.kiro.api.domain;

import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface UserRepository extends JpaRepository<User, String> {
  List<User> findByEmail(String email);

  Optional<User> findByTenantIdAndEmail(String tenantId, String email);

  List<User> findByTenantIdOrderByCreatedAtAsc(String tenantId);
}
