# Panda-Mods

Minecraft Java mod pack library built with Next.js, shadcn/ui, and SQLite. Anyone can inspect the included JAR files, choose a release, and download its original ZIP without signing in. Only admins can publish or edit pack details.

## Run locally

1. Install Node.js 20.9 or newer.
2. Run `npm install`.
3. Copy `.env.example` to `.env.local`, then set `ADMIN_EMAIL` and a unique `ADMIN_PASSWORD` of at least 12 characters.
4. Run `npm run dev` and visit `http://127.0.0.1:3000`.

The configured admin is created when the database has no admin. Changing the environment password does not reset an existing account. Registrations create regular member accounts.

## Publish packs and updates

Log in, open **Manage packs**, and select **Create a new pack** or an existing pack. Enter a release version (for example, `1.0.0`), Minecraft version, loader, and optional release notes. Choose or drop a ZIP and publish it.

Uploads stream to disk with a 1 GB file limit. The progress bar measures bytes uploaded; after 100%, the interface shows archive inspection and publishing until the server confirms completion. Repeated submissions are blocked, retries use an idempotency key, identical ZIPs are detected by SHA-256, and each release version must be unique within its pack.

Existing releases remain available after publishing an update. Select a pack in Manage packs to edit its name and description. Clicking a library card opens the pack's mods, versions, release notes, and download links.

The mod list comes from the ZIP directory: it lists JAR filenames, paths, and uncompressed sizes. JAR files are never extracted or executed by the app.

## Public links

Every pack page has Copy URL buttons:

- `/downloads/<pack-id>/latest` always returns the newest published release.
- `/api/packs/<release-id>/download` always returns that specific release.

Both URLs return ZIP bytes directly without cookies or a login redirect. For example:

```sh
wget -O pack.zip 'https://mods.paarthshaunik.gay/downloads/<pack-id>/latest'
curl -fL -o pack.zip 'https://mods.paarthshaunik.gay/api/packs/<release-id>/download'
```

Replace the placeholders with the actual URL copied from the pack page. Local preview links work against your running local server; the domain needs deployment and DNS before it works publicly.

## Deployment

Use a persistent Node.js host with writable `DATABASE_PATH` and `UPLOAD_DIR` directories. Set `NEXT_PUBLIC_SITE_URL=https://mods.paarthshaunik.gay`, build with `npm run build`, and run `npm start`. Back up both storage directories together.

If using a reverse proxy, allow upload request bodies of at least 1 GB plus multipart overhead (for example, Nginx `client_max_body_size 1100m;`) and allow sufficient upload/request time. Forward the public host using `Host` or `X-Forwarded-Host`; uploads validate the request origin.

ZIPs are checked for a valid archive directory and excessive entry counts. This does not scan mods for malware; use trusted admin accounts.

## Verification

- `npm run build`
- `npm run lint`
- `npm run test:uploads` after a build. The test uses isolated storage under `.qa-runtime`, port 3100, and an installed Chrome browser. Set `CHROME_PATH` if Chrome is elsewhere.

The upload test covers a 110 MB ZIP, repeated submissions, concurrent retries, duplicate content and version checks, public downloads, mod inspection, pack edits, and mobile layouts.

Generated local logo and favicon prompts are recorded in [docs/asset-prompts.md](docs/asset-prompts.md).

