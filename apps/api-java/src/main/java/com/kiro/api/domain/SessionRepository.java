package com.kiro.api.domain;

import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface SessionRepository extends JpaRepository<Session, String> {
  Optional<Session> findByToken(String token);

  void deleteByToken(String token);

  void deleteByUserId(String userId);
}
