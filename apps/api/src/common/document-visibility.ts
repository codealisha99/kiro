import { Permission, PrincipalType } from "@prisma/client";
import type { AuthenticatedUser } from "../auth/jwt-payload.interface";

type ClassificationName = "PUBLIC" | "INTERNAL" | "CONFIDENTIAL" | "RESTRICTED";

// Keep document reading and saved evidence under the same current access rules.
export function visibleDocumentsWhere(user: AuthenticatedUser) {
    const roleKey = user.role.toUpperCase();
    return {
      tenantId: user.tenantId,
      deleted: false,
      OR: [
        { ownerId: user.id },
        { classification: { in: ["PUBLIC", "INTERNAL"] as ClassificationName[] } },
        {
          acl: {
            some: {
              principalType: PrincipalType.USER,
              principalId: user.id,
              permission: { in: [Permission.READ, Permission.WRITE, Permission.ADMIN] },
            },
          },
        },
        {
          acl: {
            some: {
              principalType: PrincipalType.ROLE,
              principalId: roleKey,
              permission: { in: [Permission.READ, Permission.WRITE, Permission.ADMIN] },
            },
          },
        },
      ],
    };
}
