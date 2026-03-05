# crusty-proxy

MCP proxy server — security layer between OpenClaw and external APIs.
OpenClaw interacts with this proxy via the MCP protocol over an internal Docker network.
The proxy holds all API keys and enforces an operations allowlist. OpenClaw never sees credentials.

## Architecture

```
OpenClaw container
    │  MCP/SSE over openclaw-internal Docker network
    ▼
crusty-proxy container  (UID 2000, read-only rootfs)
    │  /etc/mcp-proxy/keys.json        (bind-mount, read-only)
    │  /etc/mcp-proxy/allowlist.json   (bind-mount, read-only)
    │
    ├──► Google Calendar API (OAuth2)
    ├──► IMAP / SMTP
    ├──► Todoist REST API
    ├──► Google Places API
    └──► Gemini / Imagen API
```

## First-time setup on VPS

### 1. Create the shared Docker network

```bash
docker network create openclaw-internal
```

### 2. Copy and fill in secrets

```bash
cd /opt/mcp-proxy
cp config/keys.example.json config/keys.json
chmod 600 config/keys.json
nano config/keys.json   # fill in your credentials
```

### 3. Build and start

```bash
docker compose up -d --build
docker compose logs -f
```

### 4. Verify health

```bash
# From the VPS host:
docker exec crusty-proxy wget -qO- http://localhost:3000/health

# Or from inside the openclaw-internal network:
docker run --rm --network openclaw-internal alpine \
  wget -qO- http://crusty-proxy:3000/health
```

---

## Service credentials

### Google Calendar (OAuth2)

You need a Google Cloud project with the Calendar API enabled and an OAuth2 client.

```
OAuth Playground: https://developers.google.com/oauthplayground
Scope: https://www.googleapis.com/auth/calendar
```

1. Create OAuth2 credentials (type: Desktop app) in Google Cloud Console
2. Authorize via OAuth Playground, get `refresh_token`
3. Put `client_id`, `client_secret`, `refresh_token` into `keys.json`

### Google Places API

1. Enable "Places API (New)" in Google Cloud Console
2. Create an API key, restrict it to the Places API
3. Put the key into `keys.json` under `google_places.api_key`

### Gemini / Imagen

1. Get an API key from Google AI Studio: https://aistudio.google.com/apikey
2. Imagen 3 requires billing enabled on your Google Cloud project
3. Put the key into `keys.json` under `gemini.api_key`

### Todoist

1. Go to https://app.todoist.com/app/settings/integrations/developer
2. Copy your personal API token
3. Put it into `keys.json` under `todoist.api_token`

### Email (IMAP/SMTP)

Fill in your provider's IMAP and SMTP settings.
For Gmail: use an App Password and:
- IMAP: `imap.gmail.com:993`, `tls: true`
- SMTP: `smtp.gmail.com:587`, `secure: false` (STARTTLS)

---

## Connecting OpenClaw to the proxy

In OpenClaw's MCP server configuration add:

```json
{
  "mcpServers": {
    "crusty-proxy": {
      "url": "http://crusty-proxy:3000/sse",
      "transport": "sse"
    }
  }
}
```

**Notes:**
- `crusty-proxy` resolves via Docker DNS because both containers share `openclaw-internal`
- No API key or auth needed — the internal network is the trust boundary
- OpenClaw must be joined to `openclaw-internal` (see below)

**Joining OpenClaw to the shared network** — add to `/opt/openclaw-src/docker-compose.yml`:
```yaml
networks:
  default:
    name: openclaw-src_default
  openclaw-internal:
    external: true
```
And add `openclaw-internal` to the OpenClaw service's `networks:` list.

---

## Modifying the allowlist

Edit `config/allowlist.json` on the host, then:

```bash
docker compose restart mcp-proxy
```

The file is read-only inside the container. Set `"enabled": false` to disable a service completely.

---

## Available tools

| Tool | Service | Notes |
|------|---------|-------|
| `calendar_list_events` | Google Calendar | |
| `calendar_get_event` | Google Calendar | |
| `calendar_create_event` | Google Calendar | |
| `email_list_messages` | IMAP | |
| `email_get_message` | IMAP | |
| `email_send_message` | SMTP | |
| `todoist_list_tasks` | Todoist | |
| `todoist_get_task` | Todoist | |
| `todoist_create_task` | Todoist | |
| `todoist_complete_task` | Todoist | |
| `places_search` | Google Places | |
| `places_get_details` | Google Places | |
| `gemini_generate_image` | Imagen 3 | returns image content |
| `gemini_edit_image` | Gemini 2.0 Flash | returns image content |

Deliberately **not implemented**: delete calendar events, delete emails, delete Todoist tasks.

---

## Local development

```bash
npm install
cp config/keys.example.json config/keys.json
# fill in keys.json

export KEYS_PATH=./config/keys.json
export ALLOWLIST_PATH=./config/allowlist.json
npm run dev
```
