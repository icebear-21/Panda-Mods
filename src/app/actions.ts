"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createSession, currentUser, destroySession, verifyPassword } from "@/lib/auth";
import { getDb, hashPassword, normalizeTitle } from "@/lib/db";
import { deleteRelease } from "@/lib/delete-release";

function value(form: FormData, key: string) {
  return String(form.get(key) ?? "").trim();
}

export async function loginAction(form: FormData) {
  const email = value(form, "email").toLowerCase();
  const password = String(form.get("password") ?? "");
  const user = getDb().prepare("SELECT id, password_hash, role FROM users WHERE email = ?")
    .get(email) as { id: string; password_hash: string; role: string } | undefined;
  if (!user || !verifyPassword(password, user.password_hash)) redirect("/login?error=invalid");
  await createSession(user.id);
  redirect(user.role === "admin" ? "/admin" : "/");
}

export async function registerAction(form: FormData) {
  const displayName = value(form, "displayName");
  const email = value(form, "email").toLowerCase();
  const password = String(form.get("password") ?? "");
  if (displayName.length < 2 || displayName.length > 50 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || password.length < 12) {
    redirect("/register?error=invalid");
  }
  const db = getDb();
  const existing = db.prepare("SELECT id FROM users WHERE email = ?").get(email);
  if (existing) redirect("/register?error=exists");
  const id = randomUUID();
  db.prepare("INSERT INTO users (id, email, display_name, password_hash, role) VALUES (?, ?, ?, ?, 'member')")
    .run(id, email, displayName, hashPassword(password));
  await createSession(id);
  redirect("/");
}

export async function logoutAction() {
  await destroySession();
  redirect("/");
}

export async function updatePackAction(form: FormData) {
  const user = await currentUser();
  if (user?.role !== "admin") redirect("/login");
  const id = value(form, "groupId");
  const title = value(form, "title");
  const description = value(form, "description");
  if (title.length < 3 || title.length > 80 || description.length > 500) redirect(`/admin?pack=${id}&error=details`);
  const db = getDb();
  const duplicate = db.prepare("SELECT id FROM pack_groups WHERE title_key = ? AND id != ?").get(normalizeTitle(title), id);
  if (duplicate) redirect(`/admin?pack=${id}&error=name`);
  db.prepare("UPDATE pack_groups SET title = ?, title_key = ?, description = ? WHERE id = ?").run(title, normalizeTitle(title), description, id);
  revalidatePath("/"); revalidatePath("/admin"); revalidatePath(`/packs/${id}`);
  redirect(`/admin?pack=${id}&saved=1`);
}

export async function deleteReleaseAction(_state: { error: string }, form: FormData) {
  if ((await currentUser())?.role !== "admin") return { error: "Admin login required to delete releases." };
  const releaseId = value(form, "releaseId");
  const groupId = value(form, "groupId");
  let result;
  try {
    result = deleteRelease(releaseId, groupId);
  } catch {
    return { error: "Could not remove the ZIP from storage. Check file permissions and try again. The release was kept." };
  }
  if (!result) return { error: "This release no longer exists. Refresh the page." };
  revalidatePath("/");
  revalidatePath("/admin");
  revalidatePath(`/packs/${result.groupId}`);
  revalidatePath(`/downloads/${result.groupId}/latest`);
  revalidatePath(`/api/packs/${releaseId}/download`);
  redirect(result.packRemoved ? "/admin?deleted=pack" : `/admin?pack=${result.groupId}&deleted=version`);
}
