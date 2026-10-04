import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { createWriteStream } from "node:fs";
import { access, mkdir, open, readFile, readdir, rename, rm, rmdir, unlink } from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";
import { pipeline } from "node:stream/promises";
import { chromium } from "playwright-core";
import yazl from "yazl";
import Database from "better-sqlite3";

const root = path.resolve(".qa-runtime", randomUUID());
const dbPath = path.join(root, "test.sqlite");
const uploads = path.join(root, "uploads");
const base = "http://127.0.0.1:3100";
await mkdir(root, { recursive: true });
const largePath = path.join(root, "large.zip");
const smallPath = path.join(root, "update.zip");
const thirdPath = path.join(root, "conflict.zip");
const padding = path.join(root, "padding.bin");
const handle = await open(padding, "w");
await handle.truncate(110 * 1024 * 1024); await handle.close();
async function makeZip(filename, large = false) {
  const zip = new yazl.ZipFile();
  zip.addBuffer(Buffer.from("fixture mod " + filename), "mods/example-mod-1.0.jar");
  if (large) zip.addFile(padding, "padding.bin", { compress: false });
  else zip.addBuffer(Buffer.from("another fixture"), "mods/second-mod-2.0.jar");
  zip.end();
  await pipeline(zip.outputStream, createWriteStream(filename));
}
await makeZip(largePath, true); await makeZip(smallPath); await makeZip(thirdPath);
let log = "";
const server = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "-H", "127.0.0.1", "-p", "3100"], {
  env: { ...process.env, ADMIN_EMAIL: "admin@qa.test", ADMIN_PASSWORD: "qa-password-for-tests-123", DATABASE_PATH: dbPath, UPLOAD_DIR: uploads },
  windowsHide: true, stdio: ["ignore", "pipe", "pipe"],
});
server.stdout.on("data", data => { log = (log + data).slice(-5000); });
server.stderr.on("data", data => { log = (log + data).slice(-5000); });
let browser;
let db;
try {
  for (let attempt = 0; attempt < 100; attempt++) {
    if (server.exitCode !== null) throw new Error(log);
    try { if ((await fetch(base)).ok) break; } catch {}
    await new Promise(resolve => setTimeout(resolve, 200));
  }
  browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe", headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const page = await context.newPage();
  await page.goto(base + "/login");
  await page.getByLabel("Email address").fill("admin@qa.test");
  await page.getByLabel("Password", { exact: true }).fill("qa-password-for-tests-123");
  await page.getByRole("button", { name: "Log in", exact: true }).click();
  await page.waitForURL(base + "/admin");
  await page.getByLabel("Pack name", { exact: true }).fill("QA Adventure");
  await page.getByLabel("Description", { exact: true }).fill("A Minecraft testing adventure.");
  await page.getByLabel("Release version", { exact: true }).fill("1.0.0");
  await page.getByLabel("Minecraft version", { exact: true }).fill("1.21.1");
  await page.getByLabel("Release notes").fill("First release.");
  await page.getByLabel("Mod pack ZIP").setInputFiles(largePath);
  let requests = 0;
  page.on("request", req => { if (req.url() === base + "/api/uploads" && req.method() === "POST") requests++; });
  await page.evaluate(() => {
    window.progressSeen = false;
    const observer = new MutationObserver(() => { if (document.querySelector('[role="progressbar"]')) window.progressSeen = true; });
    observer.observe(document.body, { childList: true, subtree: true });
    const form = document.querySelector('form:has(input[name="version"])');
    form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
  });
  await page.getByText("Release published. Players can download it now.", { exact: false }).waitFor({ timeout: 90000 });
  assert.equal(requests, 1, "rapid submissions must produce only one HTTP upload");
  assert.ok(await page.evaluate(() => window.progressSeen), "upload progress must be shown");
  db = new Database(dbPath);
  const first = db.prepare("SELECT * FROM packs").get();
  assert.ok(first.size_bytes > 101 * 1024 * 1024, "fixture must exceed the old server-action limit");
  const groupId = first.group_id;
  const cookieHeader = (await context.cookies()).map(cookie => cookie.name + "=" + cookie.value).join("; ");
  async function upload(version, key = randomUUID(), group = groupId, bytes) {
    bytes ||= await readFile(smallPath);
    return context.request.post(base + "/api/uploads", { headers: { Origin: base, Cookie: cookieHeader, "X-Upload-Key": key }, multipart: {
      groupId: group, title: "QA Adventure", version, minecraftVersion: "1.21.1", loader: "Fabric", description: "A Minecraft testing adventure.", changelog: "More mods!",
      file: { name: "update.zip", mimeType: "application/zip", buffer: bytes },
    } });
  }
  // Concurrent retries must converge on the same release, including after a lost response.
  const key = randomUUID();
  const results = await Promise.all([upload("2.0.0", key), upload("2.0.0", key)]);
  const responses = await Promise.all(results.map(result => result.json()));
  assert.ok(results.every(result => result.ok()), JSON.stringify(responses));
  assert.equal(responses[0].releaseId, responses[1].releaseId);
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM packs").get().n, 2);
  assert.equal((await readdir(uploads)).filter(name => name.endsWith(".zip")).length, 2, "duplicate files must be removed from storage");
  assert.equal((await readdir(uploads)).filter(name => name.endsWith(".part")).length, 0, "failed uploads must not leave partial files");
  const duplicate = await upload("3.0.0");
  assert.equal((await duplicate.json()).duplicate, true, "same ZIP under a new key must not create another release");
  const conflict = await upload("2.0.0", randomUUID(), groupId, await readFile(thirdPath));
  assert.equal(conflict.status(), 409, "a different ZIP must not replace an existing release version");
  const invalid = await upload("4.0.0", randomUUID(), groupId, Buffer.from("this is not a zip"));
  assert.equal(invalid.status(), 400);
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM packs").get().n, 2);

  await page.goto(base + "/packs/" + groupId);
  await page.getByText("second-mod-2.0.jar", { exact: true }).waitFor();
  await page.getByRole("tab", { name: /Versions/ }).click();
  await page.getByRole("link", { name: "1.0.0", exact: true }).click();
  await page.getByText("example-mod-1.0.jar", { exact: true }).waitFor();
  assert.equal(await page.getByText("second-mod-2.0.jar", { exact: true }).count(), 0);
  await page.getByRole("tab", { name: "Release notes" }).click();
  await page.getByText("First release.", { exact: true }).waitFor();
  const latestResponse = await fetch(base + "/downloads/" + groupId + "/latest");
  assert.equal(latestResponse.status, 200);
  assert.match(latestResponse.headers.get("content-disposition"), /update.zip/);
  assert.deepEqual(Buffer.from(await latestResponse.arrayBuffer()), await readFile(smallPath));
  const versionResponse = await fetch(base + "/api/packs/" + first.id + "/download");
  assert.equal(versionResponse.status, 200);
  const receivedHash = createHash("sha256");
  for await (const chunk of versionResponse.body) receivedHash.update(chunk);
  assert.equal(receivedHash.digest("hex"), first.content_hash, "version-specific link must return the original bytes without a session");

  await page.goto(base + "/admin?pack=" + groupId);
  await page.getByLabel("Name", { exact: true }).fill("Updated Adventure");
  await page.getByRole("button", { name: "Save details" }).click();
  await page.getByText("Pack details saved.").waitFor();
  assert.equal(db.prepare("SELECT title FROM pack_groups WHERE id = ?").get(groupId).title, "Updated Adventure");
  await page.goto(base);
  await page.getByRole("heading", { name: "Updated Adventure" }).waitFor();
  assert.equal(await page.locator(".pack-card").count(), 1, "versions must share one library card");
  await page.screenshot({ path: path.join(root, "dashboard.png"), fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  for (const route of ["/", "/admin", "/packs/" + groupId, "/login", "/register"]) {
    await page.goto(base + route);
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), "Mobile overflow on " + route);
  }
  await page.goto(base + "/packs/" + groupId);
  await page.screenshot({ path: path.join(root, "detail-mobile.png"), fullPage: true });

  // Verify destructive actions only touch isolated fixtures, including storage failures.
  const second = db.prepare("SELECT * FROM packs WHERE id != ?").get(first.id);
  const secondZip = path.join(uploads, second.stored_name);
  await page.goto(base + "/admin?pack=" + groupId);
  await page.getByRole("button", { name: "Delete version 2.0.0", exact: true }).click();
  const dialog = page.getByRole("alertdialog");
  await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM packs").get().n, 2, "cancel must keep releases");
  await access(secondZip);

  // A directory at the ZIP path simulates a filesystem refusal on every platform.
  await rename(secondZip, secondZip + ".backup");
  await mkdir(secondZip);
  await page.getByRole("button", { name: "Delete version 2.0.0", exact: true }).click();
  const actionRequest = page.waitForRequest(req => req.method() === "POST" && !!req.headers()["next-action"]);
  await dialog.getByRole("button", { name: "Delete permanently", exact: true }).click();
  const deletionRequest = await actionRequest;
  await dialog.getByRole("alert").filter({ hasText: "The release was kept." }).waitFor();
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM packs").get().n, 2, "filesystem failure must keep the database record");
  await rmdir(secondZip);
  await rename(secondZip + ".backup", secondZip);
  const actionHeaders = { Origin: base, "Next-Action": deletionRequest.headers()["next-action"], "Content-Type": deletionRequest.headers()["content-type"] };
  const actionBody = deletionRequest.postDataBuffer();
  const anonymousDelete = await fetch(base + "/admin?pack=" + groupId, { method: "POST", headers: actionHeaders, body: actionBody });
  assert.match(await anonymousDelete.text(), /Admin login required to delete releases/);
  assert.ok(db.prepare("SELECT id FROM packs WHERE id = ?").get(second.id), "anonymous action replay must not delete a release");
  await access(secondZip);
  await dialog.getByRole("button", { name: "Delete permanently", exact: true }).click();
  await page.getByText("Release and ZIP deleted from storage.", { exact: true }).waitFor();
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM packs").get().n, 1);
  await assert.rejects(access(secondZip), { code: "ENOENT" });
  assert.equal((await fetch(base + "/api/packs/" + second.id + "/download")).status, 404);
  const fallback = await fetch(base + "/downloads/" + groupId + "/latest");
  assert.equal(fallback.status, 200);
  assert.equal(Number(fallback.headers.get("content-length")), first.size_bytes);
  await fallback.body.cancel();
  await page.goto(base + "/packs/" + groupId);
  assert.equal(await page.getByRole("link", { name: "2.0.0", exact: true }).count(), 0);
  await page.goto(base + "/admin?pack=" + groupId);
  await page.getByRole("button", { name: "Delete version 1.0.0", exact: true }).click();
  await dialog.getByText(/This is the last release/).waitFor();
  await dialog.getByRole("button", { name: "Delete permanently", exact: true }).click();
  await page.getByText("Last release and ZIP deleted. The pack was removed from the library.").waitFor();
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM packs").get().n, 0);
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM pack_groups").get().n, 0);
  await assert.rejects(access(path.join(uploads, first.stored_name)), { code: "ENOENT" });
  assert.equal((await fetch(base + "/packs/" + groupId)).status, 404);
  assert.equal((await fetch(base + "/downloads/" + groupId + "/latest")).status, 404);

  // The same pack name/version can be published again after deletion.
  const recreated = await upload("1.0.0", randomUUID(), "");
  assert.equal(recreated.status(), 201);
  const recreatedData = await recreated.json();
  const recreatedRelease = db.prepare("SELECT * FROM packs WHERE id = ?").get(recreatedData.releaseId);
  await page.goto(base + "/admin?pack=" + recreatedData.groupId);
  // Missing ZIPs can still be removed from the database.
  await unlink(path.join(uploads, recreatedRelease.stored_name));
  await page.getByRole("button", { name: "Delete version 1.0.0", exact: true }).click();
  await dialog.getByRole("button", { name: "Delete permanently", exact: true }).click();
  await page.getByText("Last release and ZIP deleted. The pack was removed from the library.").waitFor();
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM packs").get().n, 0);
  assert.equal((await readdir(uploads)).length, 0, "deletion must leave no ZIP or temporary files");

  // Keep a release for the member authorization replay below.
  const protectedUpload = await upload("1.0.0", randomUUID(), "");
  assert.equal(protectedUpload.status(), 201);
  const protectedData = await protectedUpload.json();
  await page.goto(base + "/admin?pack=" + protectedData.groupId);
  await page.getByRole("button", { name: "Delete version 1.0.0", exact: true }).click();
  await page.screenshot({ path: path.join(root, "delete-mobile.png"), fullPage: true });
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), "Delete dialog must fit mobile");
  await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
  const publicContext = await browser.newContext();
  assert.equal((await publicContext.request.post(base + "/api/uploads", { headers: { Origin: base, "X-Upload-Key": randomUUID() } })).status(), 401);
  await publicContext.close();
  assert.equal((await context.request.post(base + "/api/uploads", { headers: { Origin: "https://wrong-origin.test", Cookie: cookieHeader, "X-Upload-Key": randomUUID() } })).status(), 403);
  await page.getByRole("button", { name: "Log out" }).click();
  await page.goto(base + "/register");
  await page.getByLabel("Display name").fill("Member");
  await page.getByLabel("Email address").fill("member@qa.test");
  await page.getByLabel("Password", { exact: true }).fill("member-password-for-tests");
  await page.getByRole("button", { name: "Create account", exact: true }).click();
  await page.waitForURL(base + "/");
  await page.goto(base + "/admin");
  await page.waitForURL(base + "/login");
  // Replay a real server action as a member, targeting an existing release.
  const memberCookies = (await context.cookies()).map(cookie => cookie.name + "=" + cookie.value).join("; ");
  const memberBody = Buffer.from(actionBody.toString().replaceAll(second.id, protectedData.releaseId).replaceAll(groupId, protectedData.groupId));
  const memberDelete = await fetch(base + "/admin", { method: "POST", headers: { ...actionHeaders, Cookie: memberCookies }, body: memberBody });
  assert.match(await memberDelete.text(), /Admin login required to delete releases/);
  assert.ok(db.prepare("SELECT id FROM packs WHERE id = ?").get(protectedData.releaseId), "member action replay must not delete a release");
  await access(path.join(uploads, protectedData.releaseId + ".zip"));
  console.log("PASS: uploads, duplicate protection, mod inspection, public downloads, mobile layout, confirmed release/ZIP deletion, cancellation, latest fallback, last-release cleanup, storage failures, missing files, re-upload, and anonymous/member deletion denial.");
  console.log("QA screenshot directory: " + root);
} catch (error) {
  console.error(log);
  throw error;
} finally {
  db?.close();
  await browser?.close();
  server.kill();
  // Keep screenshots for review; fixtures and test storage can be removed after the run.
  await rm(padding, { force: true });
}
