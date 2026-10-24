import { BadRequestException, ValidationPipe } from "@nestjs/common";
import { IngestDocumentDto, UpdateDocumentDto } from "./ingestion.dto";

const pipe = new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true });
const metadata = { type: "body" as const, metatype: IngestDocumentDto };
const base = { title: "Policy", content: "Policy text" };

describe("IngestDocumentDto ACL validation", () => {
  it("accepts valid grants and optional ACLs", async () => {
    await expect(pipe.transform(base, metadata)).resolves.toMatchObject(base);
    const input = { ...base, acl: [{ principalType: "user", principalId: "u1", permission: "read" }] };
    await expect(pipe.transform(input, metadata)).resolves.toMatchObject(input);
  });

  it.each([
    "invalid", {}, [null], ["invalid"],
    [{ principalType: "other", principalId: "u1" }],
    [{ principalType: "user", principalId: "" }],
    [{ principalType: "user" }],
    [{ principalType: "user", principalId: "u1", permission: "owner" }],
    [{ principalType: "user", principalId: "u1", extra: true }],
  ])("rejects malformed ACL %j", async (acl) => {
    await expect(pipe.transform({ ...base, acl }, metadata)).rejects.toBeInstanceOf(BadRequestException);
  });
});


describe("UpdateDocumentDto validation", () => {
  const revisionMetadata = { type: "body" as const, metatype: UpdateDocumentDto };
  const revision = { title: "Policy", content: "Updated policy", expectedVersion: 1 };
  it("accepts a versioned revision", async () => {
    await expect(pipe.transform(revision, revisionMetadata)).resolves.toMatchObject(revision);
  });
  it.each([undefined, 0, -1, 1.5, "1"])("requires a positive integer version: %j", async (expectedVersion) => {
    await expect(pipe.transform({ ...revision, expectedVersion }, revisionMetadata)).rejects.toBeInstanceOf(BadRequestException);
  });
  it("rejects classification changes and oversized titles", async () => {
    await expect(pipe.transform({ ...revision, classification: "public" }, revisionMetadata)).rejects.toBeInstanceOf(BadRequestException);
    await expect(pipe.transform({ ...revision, title: "x".repeat(201) }, revisionMetadata)).rejects.toBeInstanceOf(BadRequestException);
  });
});
