# crusty-proxy

MCP proxy server — security layer between OpenClaw and external APIs.
OpenClaw interacts with this proxy via the MCP protocol over an internal Docker network.
The proxy holds all API keys and enforces an operations allowlist.

**What this mitigates:** OpenClaw never sees credentials, which prevents secret exfiltration attacks (e.g. a compromised or manipulated agent leaking API keys). The allowlist limits which operations are available, reducing the blast radius of a misbehaving agent — but it does not prevent malicious use of the tools that are permitted. A compromised OpenClaw could still send emails, create calendar events, or complete tasks within the bounds of what the allowlist allows.

## Assumptions

- **Both OpenClaw and crusty-proxy run on the same host.** They communicate over an internal Docker network (`openclaw-internal`). No external networking, no TLS between them — the shared host is the trust boundary.
- **The host is a self-managed VPS** (Ubuntu 24 or similar). You have root access to create users and manage Docker.

## Architecture

```
VPS host
├── User: openclaw   → runs /opt/openclaw-src  (docker compose)
└── User: crusty     → runs /opt/mcp-proxy     (docker compose, owns config)

OpenClaw container
    │  MCP/SSE  ·  http://crusty-proxy:3000/sse
    │  (openclaw-internal Docker network — host-internal only)
    ▼
crusty-proxy container  (UID 2000, read-only rootfs)
    │  /etc/mcp-proxy/keys.json        (bind-mount, read-only)
    │  /etc/mcp-proxy/allowlist.json   (bind-mount, read-only)
    │
    ├──► Google Calendar API  (OAuth2)
    ├──► IMAP / SMTP
    ├──► Todoist MCP          (ai.todoist.net — official hosted MCP)
    ├──► Google Places API    (via goplaces CLI)
    └──► Gemini / Imagen API
```

## First-time setup on VPS

### 1. Create a dedicated system user

Run as root. This user owns the proxy files and runs its Docker Compose — completely separate from the user running OpenClaw.

```bash
groupadd --gid 2000 crusty
useradd --system --uid 2000 --gid 2000 --shell /usr/sbin/nologin --create-home --home-dir /opt/mcp-proxy crusty
# Allow crusty to manage Docker without sudo
usermod -aG docker crusty
```

> UID/GID 2000 must match the user inside the container. If either is already taken on your system, pick a free UID/GID and update `user:` in `docker-compose.yml` accordingly.

> **Why a separate user?** If OpenClaw is ever compromised, the attacker gains the OpenClaw user's privileges — not `crusty`'s. The config files in `/opt/mcp-proxy/config/` (including API keys) are owned by `crusty` and unreadable to the OpenClaw user.

### 2. Get the config files

The Docker image is published to GHCR — no build step needed on the VPS. Download the three files you need:

```bash
# As root:
mkdir -p /opt/mcp-proxy/config

BASE=https://raw.githubusercontent.com/stefanhoth/crusty-proxy/main
curl -fsSL $BASE/docker-compose.yml        -o /opt/mcp-proxy/docker-compose.yml
curl -fsSL $BASE/config/keys.example.json  -o /opt/mcp-proxy/config/keys.example.json
curl -fsSL $BASE/config/allowlist.json     -o /opt/mcp-proxy/config/allowlist.json

chown -R crusty:crusty /opt/mcp-proxy
```

### 3. Create the shared Docker network

```bash
docker network create openclaw-internal
```

### 4. Create and secure the keys file

Run as root (or your normal admin user). The `crusty` service account only needs **read** access — it should not be able to modify its own credentials.

```bash
cp /opt/mcp-proxy/config/keys.example.json /opt/mcp-proxy/config/keys.json
nano /opt/mcp-proxy/config/keys.json
chown root:crusty /opt/mcp-proxy/config/keys.json
chmod 640 /opt/mcp-proxy/config/keys.json
```

`root:crusty 640` means root can read/write, the `crusty` group (which the service process is in) can read, and nobody else can see the file. A compromised `crusty` process cannot overwrite or replace its own keys.

### 5. Start

```bash
sudo -u crusty docker compose -f /opt/mcp-proxy/docker-compose.yml up -d
sudo -u crusty docker compose -f /opt/mcp-proxy/docker-compose.yml logs -f
```

The image is pulled automatically from `ghcr.io/stefanhoth/crusty-proxy:latest`. To build from source instead, see the comment in `docker-compose.yml`.

### 6. Verify health

```bash
# Check container health status:
docker inspect crusty-proxy --format='{{.State.Health.Status}}'

# Or read the full health response:
docker exec crusty-proxy bun --eval \
  "fetch('http://localhost:3000/health').then(r=>r.json()).then(j=>console.log(JSON.stringify(j,null,2)))"
```

---

## Service credentials

### Google Workspace — Calendar & Gmail (via gws)

Calendar and Gmail are proxied through the [Google Workspace CLI](https://github.com/googleworkspace/cli) (`gws`), which handles OAuth2 and speaks MCP over stdio. Do this once on a machine with a browser, then copy the credentials to the VPS.

```bash
# On a machine with a browser (e.g. your laptop):
npm install -g @googleworkspace/cli
gws auth setup    # one-time: creates Cloud project, enables APIs, logs you in
                  # (or use gws auth login if you already have a project)
gws auth export --unmasked > gws-credentials.json
```

Copy `gws-credentials.json` to the VPS:

```bash
scp gws-credentials.json user@your-vps:/opt/mcp-proxy/config/gws-credentials.json
chown root:crusty /opt/mcp-proxy/config/gws-credentials.json
chmod 640 /opt/mcp-proxy/config/gws-credentials.json
```

Then enable gws in `allowlist.json` (set `"enabled": true` in the `gws` block) and restart.

### CalDAV calendar

Works with any CalDAV server: Fastmail, Nextcloud, Apple Calendar (iCloud), Radicale, Baikal, etc.

```json
"calendar": {
  "caldav_url": "https://caldav.fastmail.com/dav/",
  "username": "you@fastmail.com",
  "password": "YOUR_APP_PASSWORD",
  "calendar_url": "https://caldav.fastmail.com/dav/calendars/user/you@fastmail.com/YOUR_CALENDAR_ID/"
}
```

- `caldav_url`: The CalDAV server root. If `calendar_url` is omitted, the first discovered calendar is used.
- `calendar_url`: Optional direct URL to a specific calendar. Recommended for servers with multiple calendars.
- Use an **app password** where your provider supports it (Fastmail, iCloud, Nextcloud).

Common server URLs:
| Provider | `caldav_url` |
|----------|-------------|
| Fastmail | `https://caldav.fastmail.com/dav/` |
| iCloud | `https://caldav.icloud.com/` |
| Nextcloud | `https://your.nextcloud.host/remote.php/dav/` |
| Google Calendar | Use `gws_calendar` instead |

Enable in `allowlist.json` by setting `"calendar": { "enabled": true, ... }`.

### Google Places API

1. Enable "Places API (New)" in Google Cloud Console
2. Create an API key, restrict it to the Places API
3. Put the key into `keys.json` under `google_places.api_key`

### Gemini

1. Get an API key from Google AI Studio: https://aistudio.google.com/apikey
2. Put the key into `keys.json` under `gemini.api_key`

### Todoist (official hosted MCP)

Todoist provides an official MCP server at `https://ai.todoist.net/mcp`. Authentication is OAuth — do this once on a machine with a browser, then copy the token to the VPS.

```bash
# On a machine with a browser (e.g. your laptop):
npx mcporter auth https://ai.todoist.net/mcp
# Follow the browser OAuth flow, then find the token:
cat ~/.mcporter/*/token.json
```

Copy the `access_token` value into `keys.json` under `todoist.bearer_token`.

### Email (IMAP/SMTP)

Fill in your provider's IMAP and SMTP settings.
For Gmail: use an App Password and:
- IMAP: `imap.gmail.com:993`, `tls: true`
- SMTP: `smtp.gmail.com:587`, `secure: false` (STARTTLS)

---

## Connecting OpenClaw to the proxy

Both services must be on the same host. OpenClaw's Docker Compose needs to join the shared network.

**Add to `/opt/openclaw-src/docker-compose.yml`:**
```yaml
networks:
  default:
    name: openclaw-src_default
  openclaw-internal:
    external: true
```
And add `openclaw-internal` to the OpenClaw service's `networks:` list.

**Then register crusty-proxy with mcporter inside the OpenClaw container:**

```bash
# Run inside the OpenClaw container (or exec into it):
mcporter config add crusty-proxy http://crusty-proxy:3000/mcp
```

This writes an entry to mcporter's config file (`~/.mcporter/mcporter.json`):

```json
{
  "mcpServers": {
    "crusty-proxy": {
      "baseUrl": "http://crusty-proxy:3000/mcp"
    }
  }
}
```

`crusty-proxy` resolves via Docker DNS — no IP addresses, no ports exposed to the internet.

**Verify the connection:**

```bash
mcporter list crusty-proxy
```

---

## Modifying the allowlist

```bash
sudo -u crusty nano /opt/mcp-proxy/config/allowlist.json
sudo -u crusty docker compose -f /opt/mcp-proxy/docker-compose.yml restart mcp-proxy
```

The file is bind-mounted read-only inside the container. Set `"enabled": false` to disable a service entirely.

To discover which tool names the official Todoist MCP currently exposes:

```bash
npx mcporter list https://ai.todoist.net/mcp
```

---

## Available tools

| Tool | Service | Notes |
|------|---------|-------|
| `gws.calendar_calendarList_list` | gws / Google Calendar | |
| `gws.calendar_events_list` | gws / Google Calendar | |
| `gws.calendar_events_get` | gws / Google Calendar | |
| `gws.calendar_events_insert` | gws / Google Calendar | |
| `gws.calendar_events_patch` | gws / Google Calendar | |
| `gws.calendar_freebusy_query` | gws / Google Calendar | |
| `gws.gmail_users_getProfile` | gws / Gmail | |
| `gws.gmail_users_messages_list` | gws / Gmail | |
| `gws.gmail_users_messages_get` | gws / Gmail | |
| `gws.gmail_users_messages_send` | gws / Gmail | |
| `gws.gmail_users_messages_modify` | gws / Gmail | add/remove labels |
| `gws.gmail_users_drafts_list` | gws / Gmail | |
| `gws.gmail_users_drafts_get` | gws / Gmail | |
| `gws.gmail_users_drafts_create` | gws / Gmail | |
| `gws.gmail_users_labels_list` | gws / Gmail | |
| `calendar.list_events` | CalDAV | any CalDAV server |
| `calendar.get_event` | CalDAV | get by UID |
| `calendar.create_event` | CalDAV | |
| `email.list_messages` | IMAP | |
| `email.get_message` | IMAP | |
| `email.send_message` | SMTP | |
| `todoist.get_tasks` | Todoist MCP | upstream tool names may vary |
| `todoist.get_task` | Todoist MCP | |
| `todoist.create_task` | Todoist MCP | |
| `todoist.close_task` | Todoist MCP | |
| `todoist.get_projects` | Todoist MCP | |
| `places.search` | Google Places | |
| `places.get_details` | Google Places | |
| `places.nearby` | Google Places | |
| `places.autocomplete` | Google Places | |
| `places.resolve` | Google Places | |
| `gemini.generate_image` | Gemini 2.5 Flash | returns image content |
| `gemini.edit_image` | Gemini 2.5 Flash | returns image content |

Deliberately **not implemented**: delete calendar events, delete emails, delete Todoist tasks.

---

## Local development

```bash
bun install
cp config/keys.example.json config/keys.json
# fill in keys.json

export KEYS_PATH=./config/keys.json
export ALLOWLIST_PATH=./config/allowlist.json
bun run dev
```
