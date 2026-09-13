import { Injectable } from "@nestjs/common";

interface TimedBucket {
  count: number;
  sumMs: number;
  errors: number;
}

@Injectable()
export class MetricsService {
  private counters = new Map<string, number>();
  private buckets = new Map<string, TimedBucket>();

  incr(key: string, by = 1) {
    this.counters.set(key, (this.counters.get(key) ?? 0) + by);
  }

  observeLatency(key: string, ms: number, isError = false) {
    const b = this.buckets.get(key) ?? { count: 0, sumMs: 0, errors: 0 };
    b.count += 1;
    b.sumMs += ms;
    if (isError) b.errors += 1;
    this.buckets.set(key, b);
  }

  snapshot() {
    const counters: Record<string, number> = {};
    for (const [k, v] of this.counters) counters[k] = v;
    const latencies: Record<string, { count: number; avgMs: number; errors: number }> = {};
    for (const [k, v] of this.buckets) {
      latencies[k] = { count: v.count, avgMs: v.count ? Math.round(v.sumMs / v.count) : 0, errors: v.errors };
    }
    return { counters, latencies, uptimeSeconds: Math.round(process.uptime()) };
  }
}
