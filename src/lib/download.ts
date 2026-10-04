import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { Readable } from "node:stream";
import { getDb, type Pack } from "./db";
import { archivePath } from "./storage";

export async function downloadArchive(pack: Pack | undefined) {
  if (!pack) return new Response("Release not found", { status: 404 });
  const filePath = archivePath(pack.stored_name);
  let size: number;
  try { size = (await stat(/* turbopackIgnore: true */ filePath)).size; }
  catch { return new Response("ZIP file unavailable", { status: 404 }); }
  getDb().prepare("UPDATE packs SET downloads = downloads + 1 WHERE id = ?").run(pack.id);
  const safeName = pack.original_name.replace(/[^\x20-\x7e]/g, "_").replace(/["\\]/g, "_");
  const stream = Readable.toWeb(createReadStream(/* turbopackIgnore: true */ filePath)) as ReadableStream<Uint8Array>;
  return new Response(stream, { headers: {
    "Content-Type": "application/zip", "Content-Length": String(size),
    "Content-Disposition": `attachment; filename="${safeName}"; filename*=UTF-8''${encodeURIComponent(pack.original_name)}`,
    "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff",
  } });
}
