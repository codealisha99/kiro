import { Controller, Get, Header } from "@nestjs/common";
import { MetricsService } from "./metrics.service";

@Controller("metrics")
export class MetricsController {
  constructor(private readonly metrics: MetricsService) {}

  @Get()
  metricsSnapshot() {
    return this.metrics.snapshot();
  }

  @Get("prometheus")
  @Header("Content-Type", "text/plain; version=0.0.4")
  prometheus(): string {
    const snap = this.metrics.snapshot();
    const lines: string[] = [];
    for (const [k, v] of Object.entries(snap.counters)) {
      const name = `kiro_${k.replace(/\./g, "_")}_total`;
      lines.push(`# TYPE ${name} counter`);
      lines.push(`${name} ${v}`);
    }
    for (const [k, v] of Object.entries(snap.latencies)) {
      const base = `kiro_${k.replace(/\./g, "_")}`;
      lines.push(`# TYPE ${base}_count counter`);
      lines.push(`${base}_count ${v.count}`);
      lines.push(`# TYPE ${base}_avg_ms gauge`);
      lines.push(`${base}_avg_ms ${v.avgMs}`);
      lines.push(`# TYPE ${base}_errors_total counter`);
      lines.push(`${base}_errors_total ${v.errors}`);
    }
    lines.push(`# TYPE kiro_uptime_seconds gauge`);
    lines.push(`kiro_uptime_seconds ${snap.uptimeSeconds}`);
    return lines.join("\n") + "\n";
  }
}
