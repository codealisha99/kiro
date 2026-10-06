package com.kiro.api.connector;

import java.util.List;
import java.util.Map;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

/** Google Drive connector — MVP stub (same contract as NestJS; production: googleapis + changes.list). */
@Component
class GoogleDriveConnector implements Connector {
  private static final Logger log = LoggerFactory.getLogger(GoogleDriveConnector.class);

  @Override
  public String type() {
    return "google_drive";
  }

  @Override
  public List<ConnectorDocument> fetch(String tenantId) {
    log.info("GoogleDrive.fetch tenant={} (stub — no external call)", tenantId);
    return List.of();
  }

  @Override
  public Map<String, Object> health() {
    return Map.of("status", "ok", "latencyMs", 1);
  }
}

/** Slack connector — MVP stub. */
@Component
class SlackConnector implements Connector {
  private static final Logger log = LoggerFactory.getLogger(SlackConnector.class);

  @Override
  public String type() {
    return "slack";
  }

  @Override
  public List<ConnectorDocument> fetch(String tenantId) {
    log.info("Slack.fetch tenant={} (stub — no external call)", tenantId);
    return List.of();
  }

  @Override
  public Map<String, Object> health() {
    return Map.of("status", "ok", "latencyMs", 1);
  }
}

/** CRM connector — MVP stub. */
@Component
class CrmConnector implements Connector {
  private static final Logger log = LoggerFactory.getLogger(CrmConnector.class);

  @Override
  public String type() {
    return "crm";
  }

  @Override
  public List<ConnectorDocument> fetch(String tenantId) {
    log.info("Crm.fetch tenant={} (stub — no external call)", tenantId);
    return List.of();
  }

  @Override
  public Map<String, Object> health() {
    return Map.of("status", "ok", "latencyMs", 1);
  }
}
