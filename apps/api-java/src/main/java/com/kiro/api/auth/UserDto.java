package com.kiro.api.auth;

/** tenantName is the workspace's display name; it is set on the signed-in user's own record and null in user lists. */
public record UserDto(String id, String tenantId, String email, String name, String role, String tenantName) {}
