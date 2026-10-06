package com.kiro.api.domain;

import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

public interface FeedbackRepository extends JpaRepository<Feedback, String> {
  @Query(
      "select f.helpful as helpful, count(f) as cnt from Feedback f where f.tenantId = :tenantId group by f.helpful")
  List<FeedbackCount> countByHelpful(String tenantId);

  interface FeedbackCount {
    Boolean getHelpful();

    long getCnt();
  }
}
