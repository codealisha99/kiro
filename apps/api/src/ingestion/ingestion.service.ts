import {
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  Permission,
  PrincipalType,
  SourceType,
} from "@prisma/client";
import type { AuthenticatedUser } from "../auth/jwt-payload.interface";
import { PrismaService } from "../prisma/prisma.service";
import { createHash } from "node:crypto";
import { ChunkerService } from "./chunker.service";
import { IngestQueueService } from "./ingestion.queue";
import { ParserService } from "./parser.service";
import { DEMO_DOCUMENTS, DEMO_SOURCE_NAME } from "./demo-corpus";
import { UsersService } from "../users/users.service";
import { StorageService } from "../storage/storage.service";

type ClassificationName = "PUBLIC" | "INTERNAL" | "CONFIDENTIAL" | "RESTRICTED";

export interface IngestAclInput {
  principalType: string;
  principalId: string;
  permission?: string;
}

export interface ManualIngestInput {
  title: string;
  content: string;
  classification?: string;
  acl?: IngestAclInput[];
  filename?: string;
  sourceName?: string;
  externalId?: string;
}

/** Business logic for the knowledge layer: sources + documents + ingestion. */
@Injectable()
export class IngestionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly chunker: ChunkerService,
    private readonly queue: IngestQueueService,
    private readonly parser: ParserService,
    private readonly users: UsersService,
    private readonly storage: StorageService,
  ) {}

  // ---- Sources ----

  async listSources(user: AuthenticatedUser) {
    const sources = await this.prisma.source.findMany({
      where: { tenantId: user.tenantId, deleted: false },
      orderBy: { createdAt: "asc" },
      include: { _count: { select: { documents: { where: { deleted: false } } } } },
    });
    return sources.map((s) => ({
      id: s.id,
      tenantId: s.tenantId,
      type: s.type.toLowerCase() as
        | "google_drive"
        | "slack"
        | "crm"
        | "manual",
      name: s.name,
      status: s.status.toLowerCase() as
        | "connected"
        | "disconnected"
        | "error"
        | "syncing",
      lastSyncAt: s.lastSyncAt,
      createdAt: s.createdAt,
      documentCount: s._count.documents,
    }));
  }

  async createSource(user: AuthenticatedUser, type: string, name: string) {
    const normalized = type.toUpperCase() as SourceType;
    if (!Object.values(SourceType).includes(normalized)) {
      throw new ConflictException(`Unknown source type: ${type}`);
    }
    return this.prisma.source.create({
      data: {
        tenantId: user.tenantId,
        type: normalized,
        name,
        status: "CONNECTED",
      },
    });
  }

  async deleteSource(user: AuthenticatedUser, id: string) {
    const source = await this.prisma.source.findFirst({
      where: { id, tenantId: user.tenantId, deleted: false },
    });
    if (!source) {
      throw new NotFoundException("Source not found");
    }
    await this.prisma.source.update({
      where: { id },
      data: { deleted: true, status: "DISCONNECTED" },
    });
    return { ok: true };
  }

  // ---- Documents ----

  async listDocuments(user: AuthenticatedUser) {
    const docs = await this.prisma.document.findMany({
      where: this.visibleWhere(user),
      orderBy: { updatedAt: "desc" },
      include: { _count: { select: { versions: true } } },
    });
    return docs.map((d) => ({
      id: d.id,
      sourceId: d.sourceId,
      title: d.title,
      classification: d.classification.toLowerCase(),
      status: d.status.toLowerCase(),
      updatedAt: d.updatedAt,
      versionCount: d._count.versions,
    }));
  }

  async getDocument(user: AuthenticatedUser, id: string) {
    const doc = await this.prisma.document.findFirst({
      where: { ...this.visibleWhere(user), id },
      include: {
        versions: { orderBy: { version: "desc" } },
      },
    });
    if (!doc) {
      throw new NotFoundException("Document not found");
    }

    const latest = doc.versions[0];
    const chunks = latest
      ? await this.prisma.documentChunk.findMany({
          where: { documentVersionId: latest.id },
        })
      : [];

    const ordered = [...chunks].sort((a, b) => {
      const ai = Number((a.metadata as { index?: number } | null)?.index ?? 0);
      const bi = Number((b.metadata as { index?: number } | null)?.index ?? 0);
      return ai - bi;
    });

    return {
      id: doc.id,
      sourceId: doc.sourceId,
      title: doc.title,
      classification: doc.classification.toLowerCase(),
      status: doc.status.toLowerCase(),
      updatedAt: doc.updatedAt,
      versionCount: doc.versions.length,
      content: latest?.content ?? ordered.map((c) => c.content).join("\n\n"),
      filename: latest?.filename ?? null,
      chunks: ordered.map((c) => ({
        id: c.id,
        index: Number((c.metadata as { index?: number } | null)?.index ?? 0),
        content: c.content,
      })),
      versions: doc.versions.map((v) => ({
        id: v.id,
        version: v.version,
        contentHash: v.contentHash,
        filename: v.filename,
        createdAt: v.createdAt,
      })),
    };
  }

  async listVersions(user: AuthenticatedUser, id: string) {
    const doc = await this.prisma.document.findFirst({
      where: { ...this.visibleWhere(user), id },
      select: { id: true },
    });
    if (!doc) throw new NotFoundException("Document not found");
    const versions = await this.prisma.documentVersion.findMany({
      where: { documentId: id },
      orderBy: { version: "desc" },
    });
    return versions.map((v) => ({
      id: v.id,
      documentId: v.documentId,
      version: v.version,
      contentHash: v.contentHash,
      filename: v.filename,
      approvalStatus: v.approvalStatus.toLowerCase(),
      createdAt: v.createdAt,
    }));
  }

  async deleteDocument(user: AuthenticatedUser, id: string) {
    const doc = await this.prisma.document.findFirst({
      where: { tenantId: user.tenantId, id, deleted: false },
    });
    if (!doc) throw new NotFoundException("Document not found");
    // Only owner or admin/manager with explicit access can delete. Simplified: owner or ADMIN role.
    if (doc.ownerId !== user.id && user.role !== "admin") {
      // Check ACL admin permission
      const acl = await this.prisma.documentACL.findFirst({
        where: { documentId: id, principalType: PrincipalType.USER, principalId: user.id, permission: Permission.ADMIN },
      });
      if (!acl) throw new NotFoundException("Document not found");
    }
    await this.prisma.document.update({ where: { id }, data: { deleted: true } });
    return { ok: true };
  }

  async revokeAccess(
    user: AuthenticatedUser,
    documentId: string,
    principalType: string,
    principalId: string,
  ) {
    const doc = await this.prisma.document.findFirst({
      where: { tenantId: user.tenantId, id: documentId, deleted: false },
    });
    if (!doc) throw new NotFoundException("Document not found");
    if (doc.ownerId !== user.id && user.role !== "admin") {
      throw new NotFoundException("Document not found");
    }
    await this.prisma.documentACL.deleteMany({
      where: { documentId, principalType: this.normalizePrincipalType(principalType), principalId },
    });
    return { ok: true };
  }

  /**
   * Manual ingest: idempotent document upsert keyed on (tenant, source, external id).
   * Documents + chunks are created synchronously so records are queryable;
   * embeddings land asynchronously via the BullMQ worker queue.
   */
  async ingestManualDocument(user: AuthenticatedUser, input: ManualIngestInput) {
    if (!input.title.trim()) {
      throw new ConflictException("title is required");
    }
    if (!input.content.trim()) {
      throw new ConflictException("content is required");
    }

    const classification = this.normalizeClassification(input.classification);
    const source = await this.ensureNamedSource(
      user.tenantId,
      input.sourceName ?? "Manual ingest",
    );
    const contentHash = createHash("sha256").update(input.content).digest("hex");
    const externalId =
      input.externalId ??
      `manual:${contentHash.slice(0, 16)}`;

    const document = await this.prisma.document.upsert({
      where: {
        tenantId_sourceId_externalId: {
          tenantId: user.tenantId,
          sourceId: source.id,
          externalId,
        },
      },
      create: {
        tenantId: user.tenantId,
        sourceId: source.id,
        externalId,
        title: input.title,
        ownerId: user.id,
        classification,
      },
      update: {
        updatedAt: new Date(),
        title: input.title,
        deleted: false,
        classification,
      },
    });

    const latestVersion = await this.prisma.documentVersion.findFirst({
      where: { documentId: document.id },
      orderBy: { version: "desc" },
    });

    if (latestVersion?.contentHash === contentHash) {
      return {
        id: document.id,
        title: document.title,
        sourceId: document.sourceId,
        classification: document.classification.toLowerCase(),
        version: latestVersion.version,
        created: false,
        contentChanged: false,
      };
    }

    const nextVersion = (latestVersion?.version ?? 0) + 1;
    // Persist original to S3/local storage (fire-and-forget, non-blocking on error)
    const storageKey = `${user.tenantId}/${document.id}/v${nextVersion}/${input.filename ?? "document.txt"}`;
    await this.storage.put(storageKey, input.content).catch(() => undefined);
    const version = await this.prisma.documentVersion.create({
      data: {
        documentId: document.id,
        version: nextVersion,
        contentHash,
        content: input.content,
        filename: input.filename ?? null,
        approvalStatus: "APPROVED",
      },
    });

    const raw = this.chunker.chunk(input.content);
    if (raw.length === 0) {
      throw new ConflictException("Document produced no searchable text");
    }
    await this.prisma.documentChunk.createMany({
      data: raw.map((c) => ({
        documentVersionId: version.id,
        content: c.content,
        metadata: { index: c.index, source: input.filename ? "upload" : "manual" },
      })),
    });

    const acl =
      input.acl?.length
        ? input.acl
        : classification === "CONFIDENTIAL"
          ? [
              { principalType: "role", principalId: "MANAGER", permission: "read" },
              { principalType: "role", principalId: "ADMIN", permission: "read" },
            ]
          : [];
    if (acl.length) {
      await this.prisma.documentACL.createMany({
        data: acl.map((entry) => ({
          documentId: document.id,
          principalType: this.normalizePrincipalType(entry.principalType),
          principalId: entry.principalId,
          permission: this.normalizePermission(entry.permission),
        })),
        skipDuplicates: true,
      });
    }

    await this.queue.enqueueEmbedVersion(version.id);

    return {
      id: document.id,
      title: document.title,
      sourceId: document.sourceId,
      classification: document.classification.toLowerCase(),
      version: nextVersion,
      created: latestVersion === null,
      contentChanged: true,
    };
  }

  async ingestUploadedFile(
    user: AuthenticatedUser,
    file: { originalname: string; mimetype: string; buffer: Buffer },
    extras: { title?: string; classification?: string },
  ) {
    const parsed = await this.parser.parse(file, extras.title);
    return this.ingestManualDocument(user, {
      title: parsed.title,
      content: parsed.content,
      classification: extras.classification,
      filename: parsed.filename,
    });
  }

  async seedDemo(user: AuthenticatedUser) {
    const existing = await this.prisma.source.findFirst({
      where: {
        tenantId: user.tenantId,
        name: DEMO_SOURCE_NAME,
        deleted: false,
      },
    });

    let created = 0;
    for (const doc of DEMO_DOCUMENTS) {
      const result = await this.ingestManualDocument(user, {
        title: doc.title,
        content: doc.content,
        classification: doc.classification,
        acl: doc.acl,
        sourceName: DEMO_SOURCE_NAME,
        externalId: `demo:${doc.externalKey}`,
        filename: `${doc.externalKey}.md`,
      });
      if (result.created || result.contentChanged) {
        created += 1;
      }
    }

    const viewer = await this.users.ensureDemoViewer(user);

    return {
      seeded: created > 0 || !existing,
      documentCount: DEMO_DOCUMENTS.length,
      sourceName: DEMO_SOURCE_NAME,
      viewer,
    };
  }

  // ---- Internals ----

  /**
   * Same visibility rule as retrieval: PUBLIC/INTERNAL for the tenant,
   * confidential/restricted only for owner or explicit ACL.
   */
  visibleWhere(user: AuthenticatedUser) {
    const roleKey = user.role.toUpperCase();
    return {
      tenantId: user.tenantId,
      deleted: false,
      OR: [
        { ownerId: user.id },
        { classification: { in: ["PUBLIC", "INTERNAL"] as ClassificationName[] } },
        {
          acl: {
            some: {
              principalType: PrincipalType.USER,
              principalId: user.id,
              permission: { in: [Permission.READ, Permission.WRITE, Permission.ADMIN] },
            },
          },
        },
        {
          acl: {
            some: {
              principalType: PrincipalType.ROLE,
              principalId: roleKey,
              permission: { in: [Permission.READ, Permission.WRITE, Permission.ADMIN] },
            },
          },
        },
      ],
    };
  }

  private async ensureNamedSource(tenantId: string, name: string) {
    const existing = await this.prisma.source.findFirst({
      where: { tenantId, name, deleted: false },
    });
    if (existing) {
      return existing;
    }
    return this.prisma.source.create({
      data: {
        tenantId,
        type: SourceType.MANUAL,
        name,
        status: "CONNECTED",
      },
    });
  }

  private normalizeClassification(raw?: string): ClassificationName {
    const upper = raw?.toUpperCase();
    if (
      upper === "PUBLIC" ||
      upper === "CONFIDENTIAL" ||
      upper === "RESTRICTED"
    ) {
      return upper;
    }
    return "INTERNAL";
  }

  private normalizePrincipalType(raw: string): PrincipalType {
    const value = raw.toUpperCase();
    if (value === "USER") return PrincipalType.USER;
    if (value === "GROUP") return PrincipalType.GROUP;
    return PrincipalType.ROLE;
  }

  private normalizePermission(raw?: string): Permission {
    const value = raw?.toUpperCase();
    if (value === "WRITE") return Permission.WRITE;
    if (value === "ADMIN") return Permission.ADMIN;
    return Permission.READ;
  }
}
