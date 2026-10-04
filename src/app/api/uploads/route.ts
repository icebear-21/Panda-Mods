import Busboy from "busboy";
import { createHash, randomUUID } from "node:crypto";
import { createWriteStream } from "node:fs";
import { mkdir, rename, unlink } from "node:fs/promises";
import { Readable, Transform } from "node:stream";
import { pipeline } from "node:stream/promises";
import path from "node:path";
import { currentUser } from "@/lib/auth";
import { getDb, normalizeTitle, type Pack, type PackGroup } from "@/lib/db";
import { inspectArchive } from "@/lib/archive";
import { archivePath, MAX_UPLOAD_BYTES, uploadDirectory } from "@/lib/storage";
import { revalidatePath } from "next/cache";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

class UploadError extends Error { constructor(message: string, public status = 400) { super(message); } }

export async function POST(request: Request) {
  if ((await currentUser())?.role !== "admin") return Response.json({ error: "Admin login required." }, { status: 401 });
  // XHR always sends an Origin. Compare it to the public proxy host for CSRF protection.
  const origin = request.headers.get("origin");
  const host = request.headers.get("x-forwarded-host") || request.headers.get("host");
  if (!origin || new URL(origin).host !== host) return Response.json({ error: "Request origin was rejected." }, { status: 403 });
  const requestKey = request.headers.get("x-upload-key") || "";
  if (!/^[\w-]{20,100}$/.test(requestKey)) return Response.json({ error: "Missing upload identifier." }, { status: 400 });
  const db = getDb();
  const existingRequest = db.prepare("SELECT * FROM packs WHERE request_key = ?").get(requestKey) as Pack | undefined;
  if (existingRequest) return Response.json({ groupId: existingRequest.group_id, releaseId: existingRequest.id, duplicate: true });
  if (Number(request.headers.get("content-length") || 0) > MAX_UPLOAD_BYTES + 1024 * 1024) return Response.json({ error: "ZIP files must be 1 GB or smaller." }, { status: 413 });
  const tempPath = path.join(/* turbopackIgnore: true */ uploadDirectory(), `${randomUUID()}.part`);
  let destination: string | undefined;
  let committed = false;
  let writeTask: Promise<void> | undefined;
  try {
    await mkdir(/* turbopackIgnore: true */ uploadDirectory(), { recursive: true });
    const fields: Record<string, string> = {};
    let filename = "";
    let size = 0;
    let fileCount = 0;
    let parseError: UploadError | undefined;
    const hash = createHash("sha256");
    const parser = Busboy({ headers: Object.fromEntries(request.headers), limits: { fileSize: MAX_UPLOAD_BYTES, files: 1, fields: 8, fieldSize: 8000, parts: 9 } });
    parser.on("field", (name, value, info) => {
      if (info.valueTruncated) parseError = new UploadError("A text field is too long.");
      fields[name] = value.trim();
    });
    parser.on("filesLimit", () => { parseError = new UploadError("Upload one ZIP at a time."); });
    parser.on("fieldsLimit", () => { parseError = new UploadError("Too many form fields."); });
    parser.on("partsLimit", () => { parseError = new UploadError("Too many form parts."); });
    parser.on("file", (name, file, info) => {
      fileCount++;
      filename = path.basename(info.filename).slice(0, 180);
      if (name !== "file" || !/\.zip$/i.test(filename)) parseError = new UploadError("Choose a ZIP file.");
      file.on("limit", () => { parseError = new UploadError("ZIP files must be 1 GB or smaller.", 413); });
      parser.on("error", error => file.destroy(error instanceof Error ? error : new Error("Upload interrupted")));
      const measure = new Transform({ transform(chunk: Buffer, _encoding, callback) { size += chunk.length; hash.update(chunk); callback(null, chunk); } });
      writeTask = pipeline(file, measure, createWriteStream(/* turbopackIgnore: true */ tempPath, { flags: "wx" }), { signal: request.signal });
      // Observe immediately to avoid unhandled rejection while the request is still parsing.
      void writeTask.catch(() => { parseError = new UploadError("The upload was interrupted."); });
    });
    if (!request.body) throw new UploadError("No upload body was received.");
    await pipeline(Readable.fromWeb(request.body as import("node:stream/web").ReadableStream), parser, { signal: request.signal });
    await writeTask;
    if (parseError) throw parseError;
    if (fileCount !== 1 || size < 4) throw new UploadError("Choose a ZIP file.");

    const title = fields.title || "";
    const version = fields.version || "";
    const minecraft = fields.minecraftVersion || "";
    const loader = fields.loader || "";
    const description = fields.description || "";
    const changelog = fields.changelog || "";
    if (title.length < 3 || title.length > 80 || version.length < 1 || version.length > 40 ||
      minecraft.length < 3 || minecraft.length > 30 || description.length > 500 || changelog.length > 4000 ||
      !["Fabric", "Forge", "NeoForge", "Quilt", "Other"].includes(loader)) throw new UploadError("Check the pack name, release version, Minecraft version, and loader.");
    const mods = await inspectArchive(tempPath);
    const contentHash = hash.digest("hex");
    const id = randomUUID();
    destination = archivePath(`${id}.zip`);
    await rename(/* turbopackIgnore: true */ tempPath, destination);

    const result = db.transaction(() => {
      const retry = db.prepare("SELECT * FROM packs WHERE request_key = ?").get(requestKey) as Pack | undefined;
      if (retry) return { groupId: retry.group_id, releaseId: retry.id, duplicate: true };
      let group = fields.groupId ? db.prepare("SELECT * FROM pack_groups WHERE id = ?").get(fields.groupId) as PackGroup | undefined
        : db.prepare("SELECT * FROM pack_groups WHERE title_key = ?").get(normalizeTitle(title)) as PackGroup | undefined;
      if (fields.groupId && !group) throw new UploadError("That mod pack no longer exists.", 404);
      if (!group) {
        group = { id: randomUUID(), title, description, created_at: new Date().toISOString() };
        db.prepare("INSERT INTO pack_groups (id, title, title_key, description) VALUES (?, ?, ?, ?)").run(group.id, title, normalizeTitle(title), description);
      }
      const duplicate = db.prepare("SELECT * FROM packs WHERE group_id = ? AND content_hash = ?").get(group.id, contentHash) as Pack | undefined;
      if (duplicate) return { groupId: group.id, releaseId: duplicate.id, duplicate: true };
      if (db.prepare("SELECT id FROM packs WHERE group_id = ? AND release_version = ?").get(group.id, version)) throw new UploadError("This release version already exists. Choose a new version number.", 409);
      db.prepare(`INSERT INTO packs (id, title, description, minecraft_version, loader, original_name, stored_name, size_bytes,
        group_id, release_version, changelog, content_hash, request_key, mods_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
        .run(id, group.title, group.description, minecraft, loader, filename, `${id}.zip`, size, group.id, version, changelog, contentHash, requestKey, JSON.stringify(mods));
      return { groupId: group.id, releaseId: id, duplicate: false };
    })();
    committed = !result.duplicate;
    revalidatePath("/"); revalidatePath("/admin"); revalidatePath(`/packs/${result.groupId}`);
    return Response.json(result, { status: result.duplicate ? 200 : 201 });
  } catch (error) {
    const message = error instanceof UploadError ? error.message : error instanceof Error && /ZIP|archive/.test(error.message) ? error.message : "Upload failed. Please try again.";
    return Response.json({ error: message }, { status: error instanceof UploadError ? error.status : 400 });
  } finally {
    await writeTask?.catch(() => {});
    await unlink(/* turbopackIgnore: true */ tempPath).catch(() => {});
    if (destination && !committed) await unlink(/* turbopackIgnore: true */ destination).catch(() => {});
  }
}
