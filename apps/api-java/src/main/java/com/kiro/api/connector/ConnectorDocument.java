package com.kiro.api.connector;

import java.util.List;
import java.util.Map;

public record ConnectorDocument(
    String externalId, String title, String content, List<Map<String, String>> acl) {}
