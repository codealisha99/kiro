package com.kiro.api.integration;

import static org.junit.jupiter.api.Assertions.*;
import java.nio.charset.StandardCharsets;
import java.util.Base64;
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import org.junit.jupiter.api.Test;

class XeroWebhookServiceTest {
  @Test void verifiesExactRawPayloadAndRejectsMissingOrModifiedSignatures() throws Exception {
    byte[] body = "{ \"events\": [] }".getBytes(StandardCharsets.UTF_8);
    String signature = sign(body, "synthetic-signing-key");
    assertTrue(XeroWebhookService.validSignature(body, signature, "synthetic-signing-key"));
    assertFalse(XeroWebhookService.validSignature(body, signature, "different-key"));
    assertFalse(XeroWebhookService.validSignature(body, null, "synthetic-signing-key"));
    assertFalse(XeroWebhookService.validSignature((" " + new String(body, StandardCharsets.UTF_8)).getBytes(StandardCharsets.UTF_8), signature, "synthetic-signing-key"));
  }

  static String sign(byte[] body, String key) throws Exception {
    Mac mac = Mac.getInstance("HmacSHA256");
    mac.init(new SecretKeySpec(key.getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
    return Base64.getEncoder().encodeToString(mac.doFinal(body));
  }
}
