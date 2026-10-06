package com.kiro.api.retrieval;

import java.time.Instant;

public record RetrievedChunk(
    String chunkId,
    String documentId,
    String versionId,
    int version,
    String title,
    String sourceId,
    String sourceName,
    String classification,
    Instant updatedAt,
    String content,
    double score) {}
