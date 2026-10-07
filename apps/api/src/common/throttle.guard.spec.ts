import { ExecutionContext, HttpException } from "@nestjs/common";
import { ThrottleGuard } from "./throttle.guard";

class TestController {}
function query() {}
function upload() {}

function context(id = "user", handler = query): ExecutionContext {
  return {
    getClass: () => TestController,
    getHandler: () => handler,
    switchToHttp: () => ({ getRequest: () => ({ user: { id } }) }),
  } as unknown as ExecutionContext;
}

describe("ThrottleGuard", () => {
  let guard: ThrottleGuard;
  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(0);
    guard = new ThrottleGuard();
  });
  afterEach(() => jest.useRealTimers());

  function fill(ctx = context()) {
    for (let i = 0; i < 30; i++) expect(guard.canActivate(ctx)).toBe(true);
  }

  it("allows 30 requests and rejects the next with 429", () => {
    fill();
    try {
      guard.canActivate(context());
      throw new Error("Expected throttling");
    } catch (error) {
      expect(error).toBeInstanceOf(HttpException);
      expect((error as HttpException).getStatus()).toBe(429);
    }
  });

  it("resets at the exact window boundary", () => {
    fill();
    jest.setSystemTime(60_000);
    expect(guard.canActivate(context())).toBe(true);
  });

  it("keeps separate limits per user and endpoint", () => {
    fill();
    expect(guard.canActivate(context("other"))).toBe(true);
    expect(guard.canActivate(context("user", upload))).toBe(true);
  });

  it("removes expired users during periodic cleanup", () => {
    guard.canActivate(context("old"));
    jest.setSystemTime(60_000);
    guard.canActivate(context("new"));
    // Inspect retained state to catch memory growth from one-time visitors.
    const buckets = (guard as unknown as { buckets: Map<string, unknown> }).buckets;
    expect(buckets.size).toBe(1);
    expect([...buckets.keys()][0]).toContain("new");
  });
});
