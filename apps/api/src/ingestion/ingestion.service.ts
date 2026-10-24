import { visibleDocumentsWhere } from "../common/document-visibility";
import {
  BadRequestException,
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

  async getEmbedStatus(user: AuthenticatedUser) {
    const rows = await this.prisma.$queryRaw<
      Array<{ total: bigint; embedded: bigint }>
    >`
      SELECT
        COUNT(*)::bigint AS total,
        COUNT(dc.embedding)::bigint AS embedded
      FROM document_chunks dc
      JOIN document_versions dv ON dv.id = dc."documentVersionId"
      JOIN documents d ON d.id = dv."documentId"
      WHERE d."tenantId" = ${user.tenantId}
        AND d.deleted = false
    `;
    const totalChunks = Number(rows[0]?.total ?? 0);
    const embeddedChunks = Number(rows[0]?.embedded ?? 0);
    const pendingChunks = Math.max(0, totalChunks - embeddedChunks);
    return {
      totalChunks,
      embeddedChunks,
      pendingChunks,
      ready: pendingChunks === 0,
    };
  }

  async getDocument(user: AuthenticatedUser, id: string, requestedVersion?: number) {
    const doc = await this.prisma.document.findFirst({
      where: { ...this.visibleWhere(user), id },
      include: {
        versions: { orderBy: { version: "desc" } },
      },
    });
    if (!doc) {
      throw new NotFoundException("Document not found");
    }

    const latest = requestedVersion === undefined
      ? doc.versions[0]
      : doc.versions.find((version) => version.version === requestedVersion);
    if (requestedVersion !== undefined && !latest) throw new NotFoundException("Document version not found");
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

    const canManage = await this.canDeleteDocument(user, doc);
    return {
      id: doc.id,
      sourceId: doc.sourceId,
      title: doc.title,
      classification: doc.classification.toLowerCase(),
      status: doc.status.toLowerCase(),
      updatedAt: doc.updatedAt,
      versionCount: doc.versions.length,
      canDelete: canManage,
      canEdit: canManage,
      selectedVersion: latest?.version ?? null,
      versionCreatedAt: latest?.createdAt ?? null,
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

  async updateDocument(user: AuthenticatedUser, id: string,
    body: { title: string; content: string; expectedVersion: number }) {
    if (!body.title.trim() || body.title.length > 200 || !body.content.trim() || body.content.length > 400_000) {
      throw new BadRequestException("Use a title of up to 200 characters and document text of up to 400,000 characters.");
    }
    const revisionId = await this.prisma.$transaction(async (tx) => {
      // Lock the document before checking the version to serialize competing editors.
      await tx.$queryRaw`SELECT id FROM documents WHERE id = ${id} AND "tenantId" = ${user.tenantId} AND deleted = false FOR UPDATE`;
      const doc = await tx.document.findFirst({ where: { id, tenantId: user.tenantId, deleted: false } });
      if (!doc) throw new NotFoundException("Document not found");
      if (doc.ownerId !== user.id && user.role !== "admin") {
        const grant = await tx.documentACL.findFirst({ where: {
          documentId: id, principalType: PrincipalType.USER, principalId: user.id, permission: Permission.ADMIN,
        } });
        if (!grant) throw new NotFoundException("Document not found");
      }
      const previous = await tx.documentVersion.findFirst({ where: { documentId: id }, orderBy: { version: "desc" } });
      if (!previous || previous.version !== body.expectedVersion) {
        throw new ConflictException("A newer version was saved. Your changes have not been applied. Open the current version before editing again.");
      }
      const title = body.title.trim();
      const content = body.content.trim();
      const contentHash = createHash("sha256").update(content).digest("hex");
      if (title === doc.title && contentHash === previous.contentHash) return null;
      const raw = this.chunker.chunk(content);
      if (!raw.length) throw new BadRequestException("Document produced no searchable text");
      const revision = await tx.documentVersion.create({ data: {
        documentId: id, version: previous.version + 1, contentHash, content, approvalStatus: "APPROVED",
      } });
      await tx.documentChunk.createMany({ data: raw.map((chunk) => ({
        documentVersionId: revision.id, content: chunk.content, metadata: { index: chunk.index, source: "edit" },
      })) });
      await tx.document.update({ where: { id }, data: { title, updatedAt: new Date() } });
      return revision.id;
    });
    // A saved revision is still usable by keyword search if queueing is unavailable.
    if (revisionId) await this.queue.enqueueEmbedVersion(revisionId).catch(() => undefined);
    return this.getDocument(user, id);
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

  private async canDeleteDocument(user: AuthenticatedUser, doc: { id: string; ownerId: string }) {
    if (doc.ownerId === user.id || user.role === "admin") return true;
    return !!(await this.prisma.documentACL.findFirst({
      where: { documentId: doc.id, principalType: PrincipalType.USER, principalId: user.id, permission: Permission.ADMIN },
    }));
  }

  async deleteDocument(user: AuthenticatedUser, id: string) {
    const doc = await this.prisma.document.findFirst({
      where: { tenantId: user.tenantId, id, deleted: false },
    });
    if (!doc) throw new NotFoundException("Document not found");
    if (!(await this.canDeleteDocument(user, doc))) throw new NotFoundException("Document not found");
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

    const existing = await this.prisma.document.findUnique({
      where: { tenantId_sourceId_externalId: { tenantId: user.tenantId, sourceId: source.id, externalId } },
    });
    if (existing && existing.ownerId !== user.id && user.role !== "admin") {
      throw new ConflictException("This content belongs to an existing document. Ask its owner or an administrator to update it.");
    }
    // Creating separately keeps a concurrent duplicate from updating an unchecked owner.
    const document = existing
      ? await this.prisma.document.update({
          where: { id: existing.id },
          data: { updatedAt: new Date(), title: input.title, deleted: false, classification },
        })
      : await this.prisma.document.create({
          data: { tenantId: user.tenantId, sourceId: source.id, externalId,
            title: input.title, ownerId: user.id, classification },
        }).catch((error: unknown) => {
          if ((error as { code?: string })?.code === "P2002") {
            throw new ConflictException("A matching document was just added. Refresh your library before trying again.");
          }
          throw error;
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

  visibleWhere(user: AuthenticatedUser) {
    return visibleDocumentsWhere(user);
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
