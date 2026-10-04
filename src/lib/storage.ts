import path from "node:path";
export { MAX_UPLOAD_BYTES } from "./upload-limits";
export function uploadDirectory() {
  return path.resolve(/* turbopackIgnore: true */ process.env.UPLOAD_DIR || "./uploads");
}
export function archivePath(name: string) {
  if (!/^[\w-]+\.zip$/.test(name)) throw new Error("Invalid stored filename");
  return path.join(/* turbopackIgnore: true */ uploadDirectory(), name);
}
