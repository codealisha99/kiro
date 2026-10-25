package com.kiro.api.integration;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.OffsetDateTime;
import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.util.Base64;
import java.util.UUID;
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.web.server.ResponseStatusException;

/** Verifies and durably queues Xero notifications. The webhook payload is never logged or retained wholesale. */
@Service
public class XeroWebhookService {
  static final int MAX_BODY_BYTES = 1_000_000;
  private static final int MAX_EVENTS = 500;
  private final JdbcTemplate db;
  private final ObjectMapper json;
  private final String signingKey;
  private final TransactionTemplate tx;

  public XeroWebhookService(JdbcTemplate db, ObjectMapper json,
      @Value("${XERO_WEBHOOK_SIGNING_KEY:}") String signingKey, PlatformTransactionManager manager) {
    this.db = db;
    this.json = json;
    this.signingKey = signingKey;
    this.tx = new TransactionTemplate(manager);
  }

  public void receive(byte[] body, String signature) {
    if (signingKey == null || signingKey.isBlank())
      throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, "Xero webhook verification is not configured");
    if (body == null || body.length == 0 || body.length > MAX_BODY_BYTES)
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid Xero webhook payload");
    if (!validSignature(body, signature, signingKey))
      throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Invalid webhook signature");

    final JsonNode root;
    try { root = json.readTree(body); }
    catch (Exception e) { throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid Xero webhook payload"); }
    JsonNode events = root.path("events");
    long first = root.path("firstEventSequence").asLong(-1);
    long last = root.path("lastEventSequence").asLong(-1);
    if (!events.isArray() || events.size() > MAX_EVENTS || first < 0 || last < 0
        || (events.isEmpty() && (first != 0 || last != 0))
        || (!events.isEmpty() && (first > Long.MAX_VALUE - MAX_EVENTS || last < first || last - first != events.size() - 1L)))
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid Xero webhook payload");

    // Xero's signed empty payload is its intent-to-receive handshake.
    if (events.isEmpty()) return;
    tx.executeWithoutResult(status -> {
      for (int i = 0; i < events.size(); i++) persistEvent(events.get(i), first + i);
    });
  }

  private void persistEvent(JsonNode event, long sequence) {
    String providerTenant = text(event, "tenantId", 100);
    String resourceId = text(event, "resourceId", 200);
    String category = text(event, "eventCategory", 40).toUpperCase(java.util.Locale.ROOT);
    String type = text(event, "eventType", 40).toUpperCase(java.util.Locale.ROOT);
    if (!category.matches("[A-Z_]+") || !type.matches("[A-Z_]+"))
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid Xero webhook payload");
    if (!"INVOICE".equals(category)) return;
    OffsetDateTime occurredAt = null;
    String date = event.path("eventDateUtc").asText(null);
    if (date != null && !date.isBlank()) try { occurredAt = OffsetDateTime.parse(date); }
    catch (Exception noOffset) {
      try { occurredAt = LocalDateTime.parse(date).atOffset(ZoneOffset.UTC); }
      catch (Exception invalidDate) { throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid Xero webhook payload"); }
    }

    var connections = db.queryForList("""
      SELECT c.id,c.tenant_id FROM provider_connections c
      JOIN provider_oauth_tenants t ON t.tenant_id=c.tenant_id AND t.connection_id=c.id
      WHERE c.provider='xero' AND t.xero_tenant_id=?
        AND c.encrypted_token IS NOT NULL AND c.status IN ('PENDING','READY','SYNCING','RETRY')
      """, providerTenant);
    for (var connection : connections) {
      String id = (String) connection.get("id"), tenant = (String) connection.get("tenant_id");
      int inserted = db.update("""
        INSERT INTO provider_webhook_events(id,tenant_id,connection_id,provider,event_sequence,resource_id,event_category,event_type,event_date_utc)
        VALUES (?,?,?,'xero',?,?,?,?,?::timestamptz) ON CONFLICT(connection_id,event_sequence) DO NOTHING
        """, UUID.randomUUID().toString(), tenant, id, sequence, resourceId, category, type, occurredAt);
      if (inserted == 1) db.update("UPDATE provider_connections SET sync_requested=true,next_sync_at=now() WHERE tenant_id=? AND id=?", tenant, id);
    }
  }

  private static String text(JsonNode node, String field, int max) {
    JsonNode value = node.path(field);
    String result = value.isTextual() ? value.asText() : "";
    if (result.isBlank() || result.length() > max) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid Xero webhook payload");
    return result;
  }

  static boolean validSignature(byte[] body, String signature, String key) {
    if (signature == null || signature.isBlank()) return false;
    try {
      Mac mac = Mac.getInstance("HmacSHA256");
      mac.init(new SecretKeySpec(key.getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
      byte[] expected = Base64.getDecoder().decode(signature);
      return MessageDigest.isEqual(mac.doFinal(body), expected);
    } catch (Exception e) { return false; }
  }
}
