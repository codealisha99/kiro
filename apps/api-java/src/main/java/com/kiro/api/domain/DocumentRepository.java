package com.kiro.api.domain;

import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

public interface DocumentRepository extends JpaRepository<Document, String> {
  Optional<Document> findFirstByIdAndTenantIdAndDeletedFalse(String id, String tenantId);

  Optional<Document> findFirstByTenantIdAndSourceIdAndExternalId(
      String tenantId, String sourceId, String externalId);

  long countByTenantIdAndDeletedFalse(String tenantId);

  // Same visibility rule as retrieval SQL: owner, PUBLIC/INTERNAL, or explicit USER/ROLE grant.
  // GROUP grants are intentionally NOT honored (fail-closed; see README).
  @Query(
      "select d from Document d where d.tenantId = :tenantId and d.deleted = false and ("
          + "d.ownerId = :userId or d.classification in ('PUBLIC','INTERNAL') or "
          + "exists (select 1 from DocumentAcl a where a.documentId = d.id and a.principalType = 'USER' and a.principalId = :userId) or "
          + "exists (select 1 from DocumentAcl a where a.documentId = d.id and a.principalType = 'ROLE' and a.principalId = :role)) "
          + "order by d.updatedAt desc")
  List<Document> findVisible(String tenantId, String userId, String role);

  @Query(
      "select d from Document d where d.tenantId = :tenantId and d.deleted = false and d.id = :id and ("
          + "d.ownerId = :userId or d.classification in ('PUBLIC','INTERNAL') or "
          + "exists (select 1 from DocumentAcl a where a.documentId = d.id and a.principalType = 'USER' and a.principalId = :userId) or "
          + "exists (select 1 from DocumentAcl a where a.documentId = d.id and a.principalType = 'ROLE' and a.principalId = :role))")
  Optional<Document> findVisibleById(String tenantId, String id, String userId, String role);
}
