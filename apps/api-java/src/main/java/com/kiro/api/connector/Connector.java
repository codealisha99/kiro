package com.kiro.api.connector;

import java.util.List;
import java.util.Map;

interface Connector {
  String type();

  List<ConnectorDocument> fetch(String tenantId);

  Map<String, Object> health();
}
