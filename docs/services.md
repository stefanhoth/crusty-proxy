# Services — credentials, allowlist, and available tools

Every service is opt-in: it needs credentials in `keys.json` **and** `"enabled": true` in `allowlist.json`. Paths below assume the [VPS deployment](deployment.md) layout (`/opt/mcp-proxy/config/`); adjust for your setup.

## Service credentials

### Google Workspace (via gws)

Google Workspace services (Calendar, Gmail, Drive, Docs, Sheets, Tasks, Chat) are proxied through the [Google Workspace CLI](https://github.com/googleworkspace/cli) (`gws`), which handles OAuth2 and speaks MCP over stdio.

**Which services are available depends on what you enable during `gws auth setup`** — the CLI lets you choose which Google APIs to enable in your Cloud project and which scopes to authorize. Only services you authorized there will work in the proxy, regardless of what is enabled in `allowlist.json`.

Do the auth setup once on a machine with a browser, then copy the credentials to the server:

```bash
# On a machine with a browser (e.g. your laptop):
npm install -g @googleworkspace/cli
gws auth setup    # one-time: creates Cloud project, enables APIs, logs you in
                  # (or use gws auth login if you already have a project)
gws auth export --unmasked > gws-credentials.json
```

Copy `gws-credentials.json` to the server:

```bash
scp gws-credentials.json user@your-server:/opt/mcp-proxy/config/gws-credentials.json
chown root:crusty /opt/mcp-proxy/config/gws-credentials.json
chmod 640 /opt/mcp-proxy/config/gws-credentials.json
```

Then enable the individual services you want in `allowlist.json` (e.g. `"gws_calendar": { "enabled": true, ... }`) and restart. Each `gws_*` block can be toggled independently — only enabled services are passed to the CLI process at startup.

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

Todoist provides an official MCP server at `https://ai.todoist.net/mcp`. Authentication is OAuth — do this once on a machine with a browser, then copy the token to the server.

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

## Modifying the allowlist

```bash
sudo -u crusty nano /opt/mcp-proxy/config/allowlist.json
sudo -u crusty docker compose -f /opt/mcp-proxy/docker-compose.yml restart mcp-proxy
```

The file is bind-mounted read-only inside the container. Set `"enabled": false` to disable a service entirely.

The allowlist is enforced twice: a disabled operation never appears in the tool list, and it is checked again at call time. Keep the allowlist as tight as your use case allows — it is the blast-radius limit for a misbehaving client.

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
| `todoist.find-tasks` | Todoist MCP | |
| `todoist.find-tasks-by-date` | Todoist MCP | |
| `todoist.find-completed-tasks` | Todoist MCP | |
| `todoist.add-tasks` | Todoist MCP | |
| `todoist.complete-tasks` | Todoist MCP | |
| `todoist.update-tasks` | Todoist MCP | |
| `todoist.find-projects` | Todoist MCP | |
| `todoist.add-projects` | Todoist MCP | |
| `todoist.update-projects` | Todoist MCP | |
| `todoist.project-management` | Todoist MCP | |
| `todoist.project-move` | Todoist MCP | |
| `todoist.find-sections` | Todoist MCP | |
| `todoist.add-sections` | Todoist MCP | |
| `todoist.update-sections` | Todoist MCP | |
| `todoist.find-comments` | Todoist MCP | |
| `todoist.add-comments` | Todoist MCP | |
| `todoist.update-comments` | Todoist MCP | |
| `todoist.find-activity` | Todoist MCP | |
| `todoist.get-overview` | Todoist MCP | |
| `todoist.fetch-object` | Todoist MCP | |
| `todoist.user-info` | Todoist MCP | |
| `todoist.find-project-collaborators` | Todoist MCP | |
| `todoist.manage-assignments` | Todoist MCP | |
| `todoist.list-workspaces` | Todoist MCP | |
| `todoist.search` | Todoist MCP | |
| `todoist.fetch` | Todoist MCP | |
| `places.search` | Google Places | |
| `places.get_details` | Google Places | |
| `places.nearby` | Google Places | |
| `places.autocomplete` | Google Places | |
| `places.resolve` | Google Places | |
| `gemini.generate_image` | Gemini 2.5 Flash | returns image content |
| `gemini.edit_image` | Gemini 2.5 Flash | returns image content |

Deliberately **not in allowlist**: delete calendar events, delete emails, `todoist.delete-object`.
