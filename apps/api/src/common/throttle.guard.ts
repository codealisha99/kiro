import { CanActivate, ExecutionContext, Injectable, HttpException, HttpStatus } from "@nestjs/common";

interface Bucket {
  count: number;
  resetAt: number;
}

const WINDOW_MS = 60_000;
const MAX_REQUESTS = 30; // per IP per minute on sensitive endpoints

const buckets = new Map<string, Bucket>();

function keyFor(ctx: ExecutionContext): string {
  const req = ctx.switchToHttp().getRequest() as { ip?: string; user?: { id?: string } };
  return req.user?.id ?? req.ip ?? "anon";
}

@Injectable()
export class ThrottleGuard implements CanActivate {
  canActivate(ctx: ExecutionContext): boolean {
    const key = `${ctx.getClass().name}:${ctx.getHandler().name}:${keyFor(ctx)}`;
    const now = Date.now();
    let bucket = buckets.get(key);
    if (!bucket || now > bucket.resetAt) {
      bucket = { count: 0, resetAt: now + WINDOW_MS };
      buckets.set(key, bucket);
    }
    bucket.count += 1;
    if (bucket.count > MAX_REQUESTS) {
      throw new HttpException("Too many requests, try again later", HttpStatus.TOO_MANY_REQUESTS);
    }
    return true;
  }
}
