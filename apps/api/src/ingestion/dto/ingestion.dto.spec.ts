import { BadRequestException, ValidationPipe } from "@nestjs/common";
import { IngestDocumentDto } from "./ingestion.dto";

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
