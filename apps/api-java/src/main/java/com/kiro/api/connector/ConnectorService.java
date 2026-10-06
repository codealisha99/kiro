package com.kiro.api.connector;

import com.kiro.api.ingestion.AclGrantInput;
import com.kiro.api.ingestion.IngestionService;
import com.kiro.api.security.AuthenticatedPrincipal;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

@Service
public class ConnectorService {

  private final List<Connector> connectors;
  private final com.kiro.api.domain.SourceRepository sources;
  private final IngestionService ingestion;

  public ConnectorService(
      List<Connector> connectors,
      com.kiro.api.domain.SourceRepository sources,
      IngestionService ingestion) {
    this.connectors = connectors;
    this.sources = sources;
    this.ingestion = ingestion;
  }

  public Map<String, Object> sync(String tenantId, String sourceId, AuthenticatedPrincipal user) {
    var source = sources.findFirstByIdAndTenantIdAndDeletedFalse(sourceId, tenantId)
        .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Source not found"));
    Connector connector = connectors.stream()
        .filter(c -> c.type().equalsIgnoreCase(source.getType()))
        .findFirst()
        .orElse(null);
    if (connector == null) return Map.of("synced", 0);
    int synced = 0;
    for (ConnectorDocument d : connector.fetch(tenantId)) {
      List<AclGrantInput> acl = new ArrayList<>();
      if (d.acl() != null) {
        for (Map<String, String> g : d.acl()) {
          acl.add(new AclGrantInput(g.get("principalType"), g.get("principalId"), g.get("permission")));
        }
      }
      ingestion.ingestManualDocument(user, d.title(), d.content(), null, acl,
          null, source.getName(), source.getType() + ":" + d.externalId());
      synced++;
    }
    source.setStatus("CONNECTED");
    source.setLastSyncAt(Instant.now());
    sources.save(source);
    return Map.of("synced", synced);
  }
}
