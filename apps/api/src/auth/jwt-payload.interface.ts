import type { RBACRole } from "@kiro/shared";

export interface JwtPayload {
  sub: string;
  email: string;
  tenantId: string;
  role: RBACRole;
}

export interface AuthenticatedUser {
  id: string;
  email: string;
  tenantId: string;
  role: RBACRole;
}
