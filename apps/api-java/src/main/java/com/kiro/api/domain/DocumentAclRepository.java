package com.kiro.api.domain;

import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface DocumentAclRepository extends JpaRepository<DocumentAcl, String> {
  Optional<DocumentAcl> findFirstByDocumentIdAndPrincipalTypeAndPrincipalIdAndPermission(
      String documentId, String principalType, String principalId, String permission);

  void deleteByDocumentIdAndPrincipalTypeAndPrincipalId(
      String documentId, String principalType, String principalId);
}
