import { ForbiddenException } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { RolesGuard } from "./roles.guard";

function makeContext(role: string | undefined, required: string[] | undefined) {
  const handler = () => undefined;
  const meta = required ? { roles: required } : undefined;
  const reflector = {
    getAllAndOverride: jest.fn().mockReturnValue(meta?.roles),
  } as unknown as Reflector;

  const ctx = {
    getHandler: () => handler,
    getClass: () => class {},
    switchToHttp: () => ({
      getRequest: () => ({ user: role ? { role } : undefined }),
    }),
  } as any;

  return new RolesGuard(reflector).canActivate(ctx);
}

describe("RolesGuard", () => {
  it("allows when no roles are required", () => {
    expect(makeContext(undefined, undefined)).toBe(true);
  });

  it("allows a matching role", () => {
    expect(makeContext("manager", ["manager"])).toBe(true);
  });

  it("allows any role for admin", () => {
    expect(makeContext("admin", ["employee"])).toBe(true);
  });

  it("blocks a non-matching role", () => {
    expect(() => makeContext("employee", ["manager"])).toThrow(ForbiddenException);
  });

  it("blocks unauthenticated requests", () => {
    expect(() => makeContext(undefined, ["manager"])).toThrow(ForbiddenException);
  });
});
