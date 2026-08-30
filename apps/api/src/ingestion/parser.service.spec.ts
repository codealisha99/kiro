import { BadRequestException } from "@nestjs/common";
import { ParserService } from "./parser.service";

function file(name: string, mime: string, text: string) {
  return { originalname: name, mimetype: mime, buffer: Buffer.from(text) };
}

describe("ParserService", () => {
  const parser = new ParserService();

  it("reads a markdown file and derives a title from the filename", async () => {
    const parsed = await parser.parse(file("refund-policy.md", "text/markdown", "# Refunds\n\n30 days."));
    expect(parsed.title).toBe("refund-policy");
    expect(parsed.content).toContain("30 days");
    expect(parsed.filename).toBe("refund-policy.md");
  });

  it("honors an explicit title hint", async () => {
    const parsed = await parser.parse(
      file("notes.txt", "text/plain", "body"),
      "Customer refund policy",
    );
    expect(parsed.title).toBe("Customer refund policy");
  });

  it("turns a CSV into readable prose", async () => {
    const parsed = await parser.parse(
      file("vendors.csv", "text/csv", "name,city\nApex Seals,Cleveland\nHelios,Milwaukee"),
    );
    expect(parsed.content).toContain("Spreadsheet columns: name, city");
    expect(parsed.content).toContain("name: Apex Seals");
    expect(parsed.content).toContain("city: Milwaukee");
  });

  it("rejects an empty file", async () => {
    await expect(
      parser.parse(file("empty.txt", "text/plain", "   \n")),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("rejects unsupported binaries", async () => {
    await expect(
      parser.parse({
        originalname: "photo.png",
        mimetype: "image/png",
        buffer: Buffer.from([1, 2, 3, 4]),
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
