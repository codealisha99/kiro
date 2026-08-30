import { ChunkerService } from "./chunker.service";

function chunk(text: string, size = 1000, overlap = 200) {
  return new ChunkerService(size, overlap).chunk(text);
}

describe("ChunkerService", () => {
  it("returns an empty list for blank input", () => {
    expect(chunk("")).toEqual([]);
    expect(chunk("   \n  ")).toEqual([]);
  });

  it("keeps a small document as a single chunk", () => {
    const original = "The quick brown fox jumps over the lazy dog.";
    const parts = chunk(original);
    expect(parts.length).toBe(1);
    expect(parts[0].content).toContain("lazy dog");
  });

  it("splits a long document into ordered chunks", () => {
    const text = Array.from({ length: 200 }, (_, i) => `Paragraph ${i} of the document.`).join(
      "\n\n",
    );
    const parts = chunk(text);

    expect(parts.length).toBeGreaterThan(1);
    expect(parts[0].index).toBe(0);
    for (let i = 1; i < parts.length; i++) {
      expect(parts[i].index).toBe(i);
    }
  });

  it("adds overlap from the previous chunk boundary", () => {
    const text = Array.from({ length: 150 }, (_, i) => `Sentence ${i} here.`).join("\n\n");
    const parts = chunk(text, 200, 40);

    expect(parts.length).toBeGreaterThan(1);
    const withOverlap = parts[1].content.split("\n")[0];
    expect(withOverlap.length).toBeGreaterThan(0);
    expect(withOverlap.length).toBeLessThanOrEqual(40);
  });

  it("splits oversized single paragraphs", () => {
    const huge = "word ".repeat(5000);
    const parts = chunk(huge, 500, 0);
    expect(parts.length).toBeGreaterThan(5);
    expect(parts.every((p) => p.content.length <= 500)).toBe(true);
  });
});