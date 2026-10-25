package com.kiro.api.integration;

import static org.junit.jupiter.api.Assertions.assertThrows;
import org.junit.jupiter.api.Test;

class ProviderWebhookRetentionServiceTest {
  @Test void rejectsDisabledOrUnboundedRetentionWindows() {
    assertThrows(IllegalArgumentException.class, () -> new ProviderWebhookRetentionService(null, 0, null));
    assertThrows(IllegalArgumentException.class, () -> new ProviderWebhookRetentionService(null, 3_651, null));
  }
}
