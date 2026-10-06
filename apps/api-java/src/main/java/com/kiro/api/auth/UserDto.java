package com.kiro.api.auth;

public record UserDto(String id, String tenantId, String email, String name, String role) {}
