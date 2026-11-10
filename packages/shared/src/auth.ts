import type { RBACRole } from "./constants";

export interface RegisterRequest {
  tenantName: string;
  email: string;
  password: string;
  name?: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface AuthTokens {
  accessToken: string;
  expiresIn: number;
}

export interface UserDto {
  id: string;
  tenantId: string;
  email: string;
  name: string | null;
  role: RBACRole;
  /** Workspace display name; present on the signed-in user's own record. */
  tenantName?: string | null;
}

export interface AuthResponse {
  user: UserDto;
  tokens: AuthTokens;
}

export interface InviteUserRequest {
  email: string;
  password: string;
  name?: string;
  role?: RBACRole;
}
