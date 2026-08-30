import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { RBACRole } from "@kiro/shared";
import type { AuthenticatedUser } from "../../auth/jwt-payload.interface";
import { ROLES_KEY } from "../decorators/roles.decorator";

/** Enforces @Roles() metadata against the authenticated principal. */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<RBACRole[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required || required.length === 0) {
      return true;
    }
    const user = context.switchToHttp().getRequest()
      .user as AuthenticatedUser;
    if (!user) {
      throw new ForbiddenException("Authentication required");
    }
    // ADMIN implicitly satisfies every role requirement.
    if (user.role === "admin") {
      return true;
    }
    if (!required.includes(user.role)) {
      throw new ForbiddenException(
        `Requires role(s): ${required.join(", ")}`,
      );
    }
    return true;
  }
}
