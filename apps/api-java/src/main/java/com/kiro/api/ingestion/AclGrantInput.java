package com.kiro.api.ingestion;

public record AclGrantInput(String principalType, String principalId, String permission) {}
