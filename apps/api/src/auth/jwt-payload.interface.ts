import type { RBACRole } from "@kiro/shared";

/** Shape embedded in the signed JWT. */
export interface JwtPayload {
  sub: string; // user id
  email: string;
  tenantId: string;
  role: RBACRole;
}

/** Authenticated principal attached to the request via the JwtStrategy. */
export interface AuthenticatedUser {
  id: string;
  email: string;
  tenantId: string;
  role: RBACRole;
}
