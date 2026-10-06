package com.kiro.api.auth;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

record RegisterRequest(
    @NotBlank @Size(min = 2) String tenantName,
    @NotBlank @Email String email,
    @NotBlank @Size(min = 8) String password,
    String name) {}

record LoginRequest(@NotBlank @Email String email, @NotBlank String password) {}

record Tokens(String accessToken, long expiresIn) {}

record AuthResponse(UserDto user, Tokens tokens) {}
