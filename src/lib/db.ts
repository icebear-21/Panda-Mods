import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { randomBytes, randomUUID, scryptSync } from "node:crypto";

export type User = { id: string; email: string; display_name: string; role: "admin" | "member" };
export type Pack = {
  id: string; title: string; description: string; minecraft_version: string; loader: string;
  original_name: string; stored_name: string; size_bytes: number; downloads: number;
  created_at: string; group_id: string; release_version: string; changelog: string;
  content_hash: string; request_key: string; mods_json: string;
};
export type PackGroup = { id: string; title: string; description: string; created_at: string };
export type PackSummary = PackGroup & { latest: Pack; version_count: number; downloads: number };
let database: Database.Database | undefined;

export function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  return salt + ":" + scryptSync(password, salt, 64).toString("hex");
}
export function getDb() {
  if (database) return database;
  const databasePath = path.resolve(/* turbopackIgnore: true */ process.env.DATABASE_PATH || "./data/panda-mods.sqlite");
  mkdirSync(/* turbopackIgnore: true */ path.dirname(databasePath), { recursive: true });
  const db = new Database(databasePath);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  db.pragma("busy_timeout = 5000");
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY, email TEXT NOT NULL UNIQUE, display_name TEXT NOT NULL,
      password_hash TEXT NOT NULL, role TEXT NOT NULL CHECK(role IN ('admin', 'member')),
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS sessions (
      token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      expires_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS pack_groups (
      id TEXT PRIMARY KEY, title TEXT NOT NULL, title_key TEXT NOT NULL UNIQUE,
      description TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS packs (
      id TEXT PRIMARY KEY, group_id TEXT NOT NULL REFERENCES pack_groups(id),
      title TEXT NOT NULL, description TEXT NOT NULL, release_version TEXT NOT NULL,
      minecraft_version TEXT NOT NULL, loader TEXT NOT NULL, changelog TEXT NOT NULL DEFAULT '',
      original_name TEXT NOT NULL, stored_name TEXT NOT NULL UNIQUE, size_bytes INTEGER NOT NULL,
      downloads INTEGER NOT NULL DEFAULT 0, content_hash TEXT NOT NULL, request_key TEXT NOT NULL UNIQUE,
      mods_json TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(group_id, release_version), UNIQUE(group_id, content_hash)
    );
    CREATE INDEX IF NOT EXISTS sessions_expiry_idx ON sessions(expires_at);
    CREATE INDEX IF NOT EXISTS packs_group_idx ON packs(group_id, created_at DESC);
  `);
  const adminEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const adminPassword = process.env.ADMIN_PASSWORD;
  if (adminEmail && adminPassword && adminPassword.length >= 12) {
    const adminCount = db.prepare("SELECT COUNT(*) AS count FROM users WHERE role = 'admin'").get() as { count: number };
    if (adminCount.count === 0) db.prepare("INSERT OR IGNORE INTO users (id, email, display_name, password_hash, role) VALUES (?, ?, ?, ?, 'admin')")
      .run(randomUUID(), adminEmail, "Panda-Mods Admin", hashPassword(adminPassword));
  }
  database = db;
  return db;
}
export function normalizeTitle(title: string) { return title.trim().replace(/\s+/g, " ").toLowerCase(); }
export function getGroup(id: string) { return getDb().prepare("SELECT * FROM pack_groups WHERE id = ?").get(id) as PackGroup | undefined; }
export function listVersions(groupId: string) { return getDb().prepare("SELECT * FROM packs WHERE group_id = ? ORDER BY created_at DESC, rowid DESC").all(groupId) as Pack[]; }
export function getPack(id: string) { return getDb().prepare("SELECT * FROM packs WHERE id = ?").get(id) as Pack | undefined; }
export function listPacks(): PackSummary[] {
  const groups = getDb().prepare("SELECT * FROM pack_groups ORDER BY created_at DESC, rowid DESC").all() as PackGroup[];
  return groups.flatMap(group => {
    const versions = listVersions(group.id);
    return versions.length ? [{ ...group, latest: versions[0], version_count: versions.length, downloads: versions.reduce((n, v) => n + v.downloads, 0) }] : [];
  });
}

