import { SetMetadata } from "@nestjs/common";
import type { RBACRole } from "@company/shared";

export const ROLES_KEY = "roles";

/** Restrict a handler (or controller) to the given roles. */
export const Roles = (...roles: RBACRole[]) => SetMetadata(ROLES_KEY, roles);
