/**
 * Simple perf harness: measures p50/p95 latency for brain queries.
 * Usage: pnpm --filter @kiro/api ts-node scripts/perf.ts (requires running API + auth token in env)
 */
const API = process.env.API_URL ?? "http://localhost:3001";
const TOKEN = process.env.KIRO_TOKEN ?? "";

async function query(q: string) {
  const t0 = Date.now();
  const res = await fetch(`${API}/brain/query`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${TOKEN}` },
    body: JSON.stringify({ query: q }),
  });
  const ms = Date.now() - t0;
  if (!res.ok) throw new Error(`query failed ${res.status}`);
  return ms;
}

async function main() {
  if (!TOKEN) {
    console.log("Set KIRO_TOKEN env to run perf harness");
    process.exit(0);
  }
  const queries = ["What is our refund policy?", "What happened with Client Helios?", "Summarize supplier policy"] as const;
  const samples: number[] = [];
  const N = 20;
  for (let i = 0; i < N; i++) {
    for (const q of queries) samples.push(await query(q));
  }
  samples.sort((a, b) => a - b);
  const p50 = samples[Math.floor(samples.length * 0.5)];
  const p95 = samples[Math.floor(samples.length * 0.95)];
  const p99 = samples[Math.floor(samples.length * 0.99)];
  console.log(`n=${samples.length} p50=${p50}ms p95=${p95}ms p99=${p99}ms`);
  if (p95 > 5000) console.warn("P95 exceeds 5s SLO");
}

main().catch((e) => { console.error(e); process.exit(1); });
