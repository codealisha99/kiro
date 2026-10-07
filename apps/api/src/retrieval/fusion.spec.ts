import { fuseRrf, topFused } from "./fusion";

describe("fuseRrf", () => {
  it("ranks items found in both lists above single-list hits", () => {
    const scores = fuseRrf([
      ["a", "b", "c"],
      ["c", "a", "d"],
    ]);
    const inBoth = scores.get("a")!;
    const singleOnlyB = scores.get("b")!;
    const singleOnlyD = scores.get("d")!;
    expect(inBoth).toBeGreaterThan(singleOnlyB);
    expect(inBoth).toBeGreaterThan(singleOnlyD);
    expect(singleOnlyB).toBeGreaterThan(singleOnlyD);
    expect(scores.get("a")).toBeGreaterThan(scores.get("c")!);
  });
});

describe("topFused", () => {
  it("returns the top k by score, preserving metadata", () => {
    const items = new Map([
      ["a", { name: "A" }],
      ["b", { name: "B" }],
      ["c", { name: "C" }],
    ]);
    const scores = fuseRrf([
      ["a", "b", "c"],
      ["c", "a"],
    ]);
    const top = topFused(items, scores, 2);
    expect(top.map((t) => t.name)).toEqual(["A", "C"]);
  });

  it("handles empty results", () => {
    expect(topFused(new Map(), new Map(), 5)).toEqual([]);
  });
});
