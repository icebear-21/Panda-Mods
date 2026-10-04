import yauzl from "yauzl";
import { archivePath } from "./storage";
import { getDb, type Pack } from "./db";

export type ModFile = { name: string; path: string; size: number };

// Read the ZIP directory only; never extract or execute uploaded JAR files.
export function inspectArchive(filePath: string): Promise<ModFile[]> {
  return new Promise((resolve, reject) => {
    yauzl.open(filePath, { lazyEntries: true, autoClose: true, validateEntrySizes: true }, (error, zip) => {
      if (error || !zip) return reject(new Error("Choose a valid ZIP archive."));
      const mods: ModFile[] = [];
      let count = 0;
      zip.on("error", () => reject(new Error("The ZIP directory could not be read.")));
      zip.on("entry", (entry: yauzl.Entry) => {
        if (++count > 20000) { zip.close(); reject(new Error("This archive contains too many entries (maximum 20,000).")); return; }
        if (/\.jar$/i.test(entry.fileName)) {
          if (entry.isEncrypted()) { zip.close(); reject(new Error("Encrypted mod files are not supported.")); return; }
          mods.push({ name: entry.fileName.split("/").pop()!, path: entry.fileName, size: entry.uncompressedSize });
        }
        zip.readEntry();
      });
      zip.on("end", () => resolve(mods.sort((a, b) => a.name.localeCompare(b.name))));
      zip.readEntry();
    });
  });
}

export async function releaseMods(pack: Pack): Promise<{ mods: ModFile[]; error?: string }> {
  if (pack.mods_json) return { mods: JSON.parse(pack.mods_json) };
  try {
    const mods = await inspectArchive(archivePath(pack.stored_name));
    getDb().prepare("UPDATE packs SET mods_json = ? WHERE id = ?").run(JSON.stringify(mods), pack.id);
    return { mods };
  } catch { return { mods: [], error: "The archive is unavailable or cannot be inspected. Its download link is preserved." }; }
}
