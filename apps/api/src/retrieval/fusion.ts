export function fuseRrf(lists: string[][]): Map<string, number> {
  const scores = new Map<string, number>();
  for (const list of lists) {
    list.forEach((id, rank) => {
      scores.set(id, (scores.get(id) ?? 0) + 1 / (rank + 61));
    });
  }
  return scores;
}

export function topFused<T>(items: Map<string, T>, scores: Map<string, number>, k: number): T[] {
  return [...scores.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, k)
    .map(([id]) => items.get(id))
    .filter((item): item is T => item !== undefined);
}
