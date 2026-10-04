# Caddy setup

The root `Caddyfile` serves `mods.paarthshaunik.gay` over HTTPS and proxies to Panda-Mods on `127.0.0.1:3000`. Caddy and Next.js must run on the same host for this configuration.

## DNS and network

1. Create an **A** record named `mods` in the `paarthshaunik.gay` DNS zone, pointing to your hosting server's public IPv4 address. Add an AAAA record only if the server also has working public IPv6.
2. Allow inbound TCP ports **80** and **443** in the server firewall and hosting provider firewall. UDP 443 is optional for HTTP/3. If hosting behind a router, forward TCP 80 and 443 to the Caddy host.
3. Keep port **3000** private. Caddy connects to Next.js locally.

Caddy obtains and renews the certificate and redirects HTTP to HTTPS automatically once DNS and external connectivity are correct. Its certificate storage must persist across restarts.

## Start Panda-Mods

In the project directory, configure `.env.local` using `.env.example`, including a unique admin password and:

```dotenv
NEXT_PUBLIC_SITE_URL=https://mods.paarthshaunik.gay
```

Then run:

```sh
npm ci
npm run build
npm start -- --hostname 127.0.0.1 --port 3000
```

Use a process manager or operating system service to keep Next.js running after logout and reboot. Keep the database and uploaded ZIP directories on persistent storage.

## Configure Caddy

Install Caddy using the [official installation instructions](https://caddyserver.com/docs/install) for the hosting operating system.

For a Linux package installation, add the site block from the root `Caddyfile` to `/etc/caddy/Caddyfile`. Preserve existing site blocks if the server hosts other websites. Then:

```sh
sudo caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile
sudo systemctl reload caddy
sudo systemctl status caddy --no-pager
```

For a foreground run on Windows or Linux, run these commands from the project directory after installing Caddy:

```sh
caddy validate --config Caddyfile --adapter caddyfile
caddy run --config Caddyfile --adapter caddyfile
```

Keep the terminal open for a foreground run. Use an operating system service for unattended hosting; see [Keep Caddy Running](https://caddyserver.com/docs/running).

## Uploads and downloads

This configuration streams request bodies to the app without adding a proxy body size limit. Panda-Mods enforces its own 1 GB file limit. Caddy forwards the public Host and X-Forwarded-Host headers, which the app uses for upload origin checks. Any additional CDN or proxy in front of Caddy must also accept uploads this large.

Public download routes pass through unchanged and work with `wget` and `curl`.

## Check and troubleshoot

Visit `https://mods.paarthshaunik.gay` and check login, a pack upload, and a public ZIP download.

- **502:** verify Next.js is running on `127.0.0.1:3000` on the Caddy host.
- **Certificate errors:** check A/AAAA records and external access to TCP 80/443.
- **Upload 413:** check any CDN or additional proxy's upload limit, and the app's 1 GB file limit.
- **Linux Caddy logs:** `sudo journalctl -u caddy -n 100 --no-pager`.

References: [automatic HTTPS](https://caddyserver.com/docs/automatic-https), [reverse proxy defaults](https://caddyserver.com/docs/caddyfile/directives/reverse_proxy).
