import { CanActivate, ExecutionContext, Injectable, HttpException, HttpStatus } from "@nestjs/common";

interface Bucket {
  count: number;
  resetAt: number;
}

const WINDOW_MS = 60_000;
const MAX_REQUESTS = 30;

function keyFor(ctx: ExecutionContext): string {
  const req = ctx.switchToHttp().getRequest() as { ip?: string; user?: { id?: string } };
  return req.user?.id ?? req.ip ?? "anon";
}

@Injectable()
export class ThrottleGuard implements CanActivate {
  private readonly buckets = new Map<string, Bucket>();
  private nextCleanupAt = 0;

  canActivate(ctx: ExecutionContext): boolean {
    const key = `${ctx.getClass().name}:${ctx.getHandler().name}:${keyFor(ctx)}`;
    const now = Date.now();
    if (now >= this.nextCleanupAt) {
      for (const [bucketKey, bucket] of this.buckets) {
        if (now >= bucket.resetAt) this.buckets.delete(bucketKey);
      }
      this.nextCleanupAt = now + WINDOW_MS;
    }
    let bucket = this.buckets.get(key);
    if (!bucket || now >= bucket.resetAt) {
      bucket = { count: 0, resetAt: now + WINDOW_MS };
      this.buckets.set(key, bucket);
    }
    bucket.count += 1;
    if (bucket.count > MAX_REQUESTS) {
      throw new HttpException("Too many requests, try again later", HttpStatus.TOO_MANY_REQUESTS);
    }
    return true;
  }
}
