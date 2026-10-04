import { unlinkSync } from "node:fs";
import { getDb, type Pack } from "./db";
import { archivePath } from "./storage";

export function deleteRelease(releaseId: string, groupId: string) {
  const db = getDb();
  // Hold the write lock while checking the release and removing its file.
  // A filesystem failure rolls back the database changes so deletion can be retried.
  return db.transaction(() => {
    const release = db.prepare("SELECT * FROM packs WHERE id = ? AND group_id = ?")
      .get(releaseId, groupId) as Pack | undefined;
    if (!release) return undefined;
    const filePath = archivePath(release.stored_name);
    db.prepare("DELETE FROM packs WHERE id = ?").run(release.id);
    const remaining = db.prepare("SELECT id FROM packs WHERE group_id = ? LIMIT 1").get(release.group_id);
    if (!remaining) db.prepare("DELETE FROM pack_groups WHERE id = ?").run(release.group_id);
    try {
      unlinkSync(/* turbopackIgnore: true */ filePath);
    } catch (error) {
      // A ZIP already removed outside the app should not prevent clearing its record.
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
    return { groupId: release.group_id, packRemoved: !remaining };
  }).immediate();
}
