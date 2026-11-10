// Pure scale, tick, and formatting math for the chart kit. No DOM access, so it is unit-tested directly.
export type Domain = readonly [number, number];

export type Scale = ((value: number) => number) & {
  invert: (pixel: number) => number;
};

// Maps a data domain onto a pixel range. A degenerate domain maps to the range midpoint.
export function linearScale(domain: Domain, range: Domain): Scale {
  const [d0, d1] = domain;
  const [r0, r1] = range;
  const span = d1 - d0;
  const scale = ((value: number) =>
    span === 0 ? (r0 + r1) / 2 : r0 + ((value - d0) / span) * (r1 - r0)) as Scale;
  scale.invert = (pixel: number) =>
    r1 === r0 ? d0 : d0 + ((pixel - r0) / (r1 - r0)) * span;
  return scale;
}

// Round step sizes of 1, 2, or 5 times a power of ten, aiming for about `count` intervals.
export function niceStep(span: number, count: number): number {
  const raw = Math.abs(span) / Math.max(1, count);
  if (raw === 0 || !Number.isFinite(raw)) return 1;
  const magnitude = 10 ** Math.floor(Math.log10(raw));
  const normalized = raw / magnitude;
  const nice = normalized < 1.5 ? 1 : normalized < 3 ? 2 : normalized < 7 ? 5 : 10;
  return nice * magnitude;
}

export function niceTicks(min: number, max: number, count = 5): number[] {
  if (!Number.isFinite(min) || !Number.isFinite(max)) return [];
  if (min === max) return [min];
  const low = Math.min(min, max);
  const high = Math.max(min, max);
  const step = niceStep(high - low, count);
  const first = Math.floor(low / step) * step;
  const last = Math.ceil(high / step) * step;
  const ticks: number[] = [];
  // Round to the step precision so floating-point drift never leaks into labels.
  const precision = Math.max(0, -Math.floor(Math.log10(step)) + 2);
  for (let value = first; value <= last + step / 2; value += step) {
    ticks.push(Number(value.toFixed(precision)));
  }
  return ticks;
}

// Domain that includes every value (and zero when requested), padded to nice tick edges.
export function niceDomain(values: readonly number[], options: { includeZero?: boolean; count?: number } = {}): Domain {
  const finite = values.filter((value) => Number.isFinite(value));
  if (finite.length === 0) return [0, 1];
  let min = Math.min(...finite);
  let max = Math.max(...finite);
  if (options.includeZero) {
    min = Math.min(min, 0);
    max = Math.max(max, 0);
  }
  if (min === max) {
    // A flat series still needs a range. Never invent negatives for non-negative data (all-zero counts).
    min = min >= 0 ? Math.max(0, min - 1) : min - 1;
    max += 1;
  }
  const ticks = niceTicks(min, max, options.count ?? 4);
  return [ticks[0] ?? min, ticks[ticks.length - 1] ?? max];
}

// Index of the sorted value closest to the target (binary search).
export function nearestIndex(sorted: readonly number[], target: number): number {
  if (sorted.length === 0) return -1;
  let low = 0;
  let high = sorted.length - 1;
  while (low < high) {
    const mid = (low + high) >> 1;
    if (sorted[mid] < target) low = mid + 1;
    else high = mid;
  }
  const before = low > 0 ? low - 1 : low;
  return Math.abs(sorted[before] - target) <= Math.abs(sorted[low] - target) ? before : low;
}

// Cumulative [start, end] offsets for stacking non-negative values from zero.
export function stackOffsets(values: readonly number[]): { start: number; end: number }[] {
  let total = 0;
  return values.map((value) => {
    const safe = Number.isFinite(value) && value > 0 ? value : 0;
    const start = total;
    total += safe;
    return { start, end: total };
  });
}

export function clamp(value: number, low: number, high: number): number {
  return Math.min(high, Math.max(low, value));
}

const compact = new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 });
const plain = new Intl.NumberFormat("en", { maximumFractionDigits: 1 });
const percent = new Intl.NumberFormat("en", { style: "percent", maximumFractionDigits: 0 });

// Axis and stat values: 1,284 becomes 1.3K. Used for ticks and headline numbers.
export function formatCompact(value: number): string {
  return Number.isFinite(value) ? compact.format(value) : "No data";
}

export function formatNumber(value: number): string {
  return Number.isFinite(value) ? plain.format(value) : "No data";
}

// Ratios in [0, 1]; use formatNumber for values already in percent units.
export function formatPercent(ratio: number | null): string {
  return ratio === null || !Number.isFinite(ratio) ? "No data" : percent.format(ratio);
}

// Signed change with a true minus sign, for deltas.
export function formatDelta(value: number, suffix = ""): string {
  if (!Number.isFinite(value)) return "No change";
  const sign = value > 0 ? "+" : value < 0 ? "−" : "";
  return `${sign}${formatNumber(Math.abs(value))}${suffix}`;
}

/**
 * X tick positions for time axes: up to `count` evenly spaced instants snapped to the nearest data
 * point, dropping any tick closer than `minGapPx` to the previous one so labels never collide.
 */
export function timeTickIndexes(sorted: readonly number[], toPx: (value: number) => number, count = 5, minGapPx = 64): number[] {
  if (sorted.length === 0) return [];
  const first = sorted[0];
  const last = sorted[sorted.length - 1];
  const steps = Math.max(1, count - 1);
  const candidates = sorted.length === 1 ? [0] : Array.from({ length: count }, (_, i) => nearestIndex(sorted, first + ((last - first) * i) / steps));
  const picked: number[] = [];
  for (const index of candidates) {
    const prev = picked[picked.length - 1];
    if (prev !== undefined && (index === prev || toPx(sorted[index]) - toPx(sorted[prev]) < minGapPx)) continue;
    picked.push(index);
  }
  return picked;
}
