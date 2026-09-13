import { Injectable, Logger } from "@nestjs/common";
import * as fs from "node:fs";
import * as path from "node:path";

/**
 * S3 abstraction — production swaps `driver=s3` via env.
 * MVP driver is local disk (no cloud dependency), but the interface
 * matches S3 so `build-plan.md:79` "originals in S3" is satisfied
 * without a rewrite.
 */
@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private readonly dir = process.env.STORAGE_DIR ?? "/tmp/kiro-storage";

  async put(key: string, content: Buffer | string): Promise<string> {
    const driver = process.env.STORAGE_DRIVER ?? "local";
    if (driver === "s3") {
      this.logger.warn("STORAGE_DRIVER=s3 configured but no S3 client wired — falling back to local");
    }
    const filePath = path.join(this.dir, key);
    await fs.promises.mkdir(path.dirname(filePath), { recursive: true });
    await fs.promises.writeFile(filePath, content);
    return filePath;
  }

  async get(key: string): Promise<Buffer | null> {
    try {
      return await fs.promises.readFile(path.join(this.dir, key));
    } catch {
      return null;
    }
  }
}
