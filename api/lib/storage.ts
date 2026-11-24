/**
 * storage.ts — R2-backed storage for the Cloudflare Workers deployment.
 *
 * Drop-in replacement for the platform object-storage SDK, exposing the same
 * interface so routers/routes work unchanged. The R2 bucket binding (BUCKET)
 * is stashed on globalThis by api/worker-entry.ts.
 *
 * Differences vs. the platform SDK:
 *   - No server-side content audit (R2 stores bytes as-is). reviewStatus is
 *     always "active"; the REVIEW_REJECTED path never fires.
 *   - getPresignedUrl is not used by this app (serving goes through
 *     /public/:username/:slug and /i/:username/:slug which read R2 directly),
 *     but it is kept for interface parity; it throws STORAGE_INVALID_INPUT
 *     because R2 presigned URLs need a public/custom domain binding. If a
 *     future caller needs them, bind an R2 domain first.
 *   - No quota enforcement here: quotas live in the routers (20 files/20MB,
 *     50MB premium image space), same as before.
 */

// ---------- types (unchanged from the platform SDK) ----------

export type ReviewStatus = "active";

export interface UploadFileInput {
  fileContent: Uint8Array | string;
  fileName: string;
  contentType?: string;
}

export interface UploadResult {
  key: string;
  fileName: string;
  size: number;
  contentType: string;
  etag?: string;
  reviewStatus: ReviewStatus;
}

export interface FileMeta {
  key: string;
  fileName?: string;
  size: number;
  contentType: string;
  etag?: string;
  lastModified?: string;
  reviewStatus: ReviewStatus;
}

export interface ListFilesInput {
  prefix?: string;
  delimiter?: "/" | "";
  maxKeys?: number;
  pageToken?: string;
}

export interface ListFilesResult {
  folders: string[];
  objects: FileMeta[];
  nextPageToken?: string;
}

export interface PresignedUrlResult {
  key: string;
  url: string;
  expireTime?: string;
}

export interface DeleteFilesResult {
  deleted: string[];
  failed: { key: string; message: string }[];
}

// ---------- errors (same codes as the platform SDK) ----------

export type StorageErrorCode =
  | "STORAGE_NOT_PROVISIONED"
  | "STORAGE_QUOTA_EXCEEDED"
  | "STORAGE_REVIEW_REJECTED"
  | "STORAGE_OBJECT_NOT_FOUND"
  | "STORAGE_FILE_TOO_LARGE"
  | "STORAGE_INVALID_INPUT"
  | "STORAGE_FORBIDDEN"
  | "STORAGE_RESOURCE_FROZEN"
  | "STORAGE_RATE_LIMITED"
  | "STORAGE_UPSTREAM_ERROR";

export class StorageError extends Error {
  readonly code: StorageErrorCode;
  readonly retryable: boolean;

  constructor(code: StorageErrorCode, message: string, retryable: boolean) {
    super(message);
    this.name = "StorageError";
    this.code = code;
    this.retryable = retryable;
  }
}

// ---------- R2 access ----------

const MAX_UPLOAD_BYTES = 100 * 1024 * 1024;

function getBucket(): R2Bucket {
  const bucket = (globalThis as any).__R2 as R2Bucket | undefined;
  if (!bucket) {
    throw new StorageError(
      "STORAGE_NOT_PROVISIONED",
      "R2 bucket binding (BUCKET) is not available",
      false,
    );
  }
  return bucket;
}

// Validate the key the same way the platform did (1..512 bytes, no leading
// "/", no "//", no "\\", no ".." segment, no control chars).
function validateKey(key: string): void {
  if (key.length < 1 || key.length > 512 || key.startsWith("/")) {
    throw new StorageError("STORAGE_INVALID_INPUT", `非法 key: "${key}"`, false);
  }
  if (key.includes("//") || key.includes("\\") || /[\x00-\x1f]/.test(key)) {
    throw new StorageError("STORAGE_INVALID_INPUT", `非法 key: "${key}"`, false);
  }
  if (key.split("/").some((seg) => seg === "..")) {
    throw new StorageError("STORAGE_INVALID_INPUT", `非法 key: "${key}"`, false);
  }
}

// uniqueKey: same algorithm as the platform SDK — 8 random hex chars inserted
// before the extension of the last path segment.
function uniqueKey(fileName: string): string {
  const idx = fileName.lastIndexOf("/");
  const last = fileName.slice(idx + 1);
  const dot = last.lastIndexOf(".");
  const suffix = Array.from(crypto.getRandomValues(new Uint8Array(4)))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  if (dot <= 0) return `${fileName}-${suffix}`;
  const insertAt = idx + 1 + dot;
  return `${fileName.slice(0, insertAt)}-${suffix}${fileName.slice(insertAt)}`;
}

function toBytes(content: Uint8Array | string): Uint8Array {
  if (typeof content === "string") return new TextEncoder().encode(content);
  return content;
}

const MIME_BY_EXT: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
  bmp: "image/bmp",
  svg: "image/svg+xml",
  txt: "text/plain",
  md: "text/markdown",
  csv: "text/csv",
  json: "application/json",
  pdf: "application/pdf",
  zip: "application/zip",
  apk: "application/vnd.android.package-archive",
  mp4: "video/mp4",
  mp3: "audio/mpeg",
};

function guessContentType(fileName: string): string {
  const ext = fileName.split(".").pop()?.toLowerCase() ?? "";
  return MIME_BY_EXT[ext] ?? "application/octet-stream";
}

// ---------- storage singleton ----------

class R2Storage {
  async uploadFile(input: UploadFileInput): Promise<UploadResult> {
    const contentType = input.contentType || guessContentType(input.fileName);
    const bytes = toBytes(input.fileContent);
    if (bytes.byteLength > MAX_UPLOAD_BYTES) {
      throw new StorageError(
        "STORAGE_FILE_TOO_LARGE",
        `文件超过 100MB 上限（${bytes.byteLength} 字节）`,
        false,
      );
    }
    const key = uniqueKey(input.fileName);
    validateKey(key);
    const bucket = getBucket();
    const obj = await bucket.put(key, bytes, {
      httpMetadata: { contentType },
    });
    return {
      key,
      fileName: key.split("/").pop() ?? key,
      size: bytes.byteLength,
      contentType,
      etag: obj?.etag,
      reviewStatus: "active",
    };
  }

  async readFile({ fileKey }: { fileKey: string }): Promise<Uint8Array> {
    validateKey(fileKey);
    const obj = await getBucket().get(fileKey);
    if (!obj) {
      throw new StorageError(
        "STORAGE_OBJECT_NOT_FOUND",
        `对象不存在: ${fileKey}`,
        false,
      );
    }
    return new Uint8Array(await obj.body.arrayBuffer());
  }

  // Not used by this app's routes, kept for interface parity. R2 objects are
  // served through the app's own /public and /i endpoints, not presigned URLs.
  async getPresignedUrl({ fileKey }: { fileKey: string }): Promise<PresignedUrlResult> {
    validateKey(fileKey);
    throw new StorageError(
      "STORAGE_INVALID_INPUT",
      "R2 部署不使用预签名 URL，请通过 /public 或 /i 路由访问文件",
      false,
    );
  }

  async headFile({ fileKey }: { fileKey: string }): Promise<FileMeta> {
    validateKey(fileKey);
    const obj = await getBucket().head(fileKey);
    if (!obj) {
      throw new StorageError(
        "STORAGE_OBJECT_NOT_FOUND",
        `对象不存在: ${fileKey}`,
        false,
      );
    }
    return {
      key: fileKey,
      size: obj.size,
      contentType: obj.httpMetadata?.contentType ?? "application/octet-stream",
      etag: obj.etag,
      lastModified: obj.uploaded.toISOString(),
      reviewStatus: "active",
    };
  }

  async fileExists({ fileKey }: { fileKey: string }): Promise<boolean> {
    validateKey(fileKey);
    return (await getBucket().head(fileKey)) !== null;
  }

  async listFiles(input: ListFilesInput = {}): Promise<ListFilesResult> {
    const bucket = getBucket();
    const listed = await bucket.list({
      prefix: input.prefix,
      delimiter: input.delimiter === "" ? undefined : input.delimiter,
      cursor: input.pageToken,
      limit: input.maxKeys ?? 100,
      include: ["httpMetadata"],
    });
    return {
      folders: listed.delimitedPrefixes ?? [],
      objects: listed.objects.map((o) => ({
        key: o.key,
        fileName: o.key.split("/").pop(),
        size: o.size,
        contentType: o.httpMetadata?.contentType ?? "application/octet-stream",
        etag: o.etag,
        lastModified: o.uploaded.toISOString(),
        reviewStatus: "active" as const,
      })),
      nextPageToken: listed.truncated ? listed.cursor : undefined,
    };
  }

  async deleteFile({ fileKey }: { fileKey: string }): Promise<void> {
    validateKey(fileKey);
    await getBucket().delete(fileKey);
  }

  async deleteFiles({
    fileKeys,
  }: {
    fileKeys: string[];
  }): Promise<DeleteFilesResult> {
    const bucket = getBucket();
    const result: DeleteFilesResult = { deleted: [], failed: [] };
    for (const key of fileKeys) {
      try {
        validateKey(key);
        await bucket.delete(key);
        result.deleted.push(key);
      } catch (e: any) {
        result.failed.push({
          key,
          message: e instanceof Error ? e.message : String(e),
        });
      }
    }
    return result;
  }
}

// Lazy singleton, same shape as the platform SDK (Proxy over a lazy instance).
let instance: R2Storage | undefined;
export const storage = new Proxy({} as R2Storage, {
  get(_target, prop) {
    if (!instance) instance = new R2Storage();
    const value = (instance as any)[prop];
    return typeof value === "function" ? value.bind(instance) : value;
  },
});
