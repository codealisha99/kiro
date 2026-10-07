import { SetMetadata } from "@nestjs/common";
import type { RBACRole } from "@kiro/shared";

export const ROLES_KEY = "roles";

export const Roles = (...roles: RBACRole[]) => SetMetadata(ROLES_KEY, roles);
