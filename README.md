# crusty-proxy

A self-hosted **MCP proxy server** that sits between an AI agent and external APIs as a security layer. The proxy holds all API keys and enforces an operations allowlist — the agent connecting to it never sees a credential.

crusty-proxy was originally built to give [OpenClaw](https://openclaw.ai) safe access to personal services, but it speaks standard MCP (Streamable HTTP and SSE) and works with **any MCP client**: agentic workflows, coding agents like Claude Code, schedulers, or home-grown automations.

## Why

Handing an AI agent your API keys is risky: a compromised or manipulated agent can exfiltrate them. crusty-proxy removes that risk class entirely:

- **Credential isolation** — the agent only sees MCP tools. Keys live in a config file the agent's process can't read, mounted read-only into the proxy container.
- **Operations allowlist** — every tool is gated by `allowlist.json`, checked both when the tool list is built and again at call time. Destructive operations (delete email, delete calendar event, …) can simply be left out.
- **Hardened runtime** — the container runs as a non-root user with a read-only root filesystem, all capabilities dropped, and no ports exposed beyond an internal Docker network.

What this does **not** prevent: malicious use of the tools that *are* permitted. A compromised agent could still send emails or create events within the bounds of the allowlist — keep the allowlist tight.

## How it works

```
MCP client (AI agent, workflow, …)
    │  MCP over Streamable HTTP or SSE
    │  http://crusty-proxy:3000/mcp
    ▼
crusty-proxy container  (non-root, read-only rootfs)
    │  keys.json       (bind-mount, read-only)
    │  allowlist.json  (bind-mount, read-only)
    │
    ├──► Google Workspace  (Calendar, Gmail, … via gws CLI)
    ├──► CalDAV            (Fastmail, iCloud, Nextcloud, …)
    ├──► IMAP / SMTP
    ├──► Todoist           (official hosted MCP)
    ├──► Google Places API
    └──► Gemini / Imagen   (image generation)
```

See [docs/architecture.md](docs/architecture.md) for the full picture, including the three integration patterns (direct API, upstream MCP passthrough, CLI bridge).

## Quick start

The Docker image is published to GHCR — no build step needed.

```bash
mkdir -p mcp-proxy/config && cd mcp-proxy

BASE=https://raw.githubusercontent.com/stefanhoth/crusty-proxy/main
curl -fsSL $BASE/docker-compose.yml        -o docker-compose.yml
curl -fsSL $BASE/config/keys.example.json  -o config/keys.example.json
curl -fsSL $BASE/config/allowlist.json     -o config/allowlist.json

cp config/keys.example.json config/keys.json
# Fill in credentials for the services you want (see docs/services.md),
# enable them in config/allowlist.json, then:

docker network create openclaw-internal   # shared network the proxy and your agent join
docker compose up -d
```

Point your MCP client at `http://crusty-proxy:3000/mcp` (from a container on the same network). For a production setup with a dedicated system user, locked-down file permissions, and health checks, follow [docs/deployment.md](docs/deployment.md).

## Documentation

| Doc | Contents |
|-----|----------|
| [docs/deployment.md](docs/deployment.md) | Hardened first-time setup on a VPS: system user, file permissions, Docker network, health checks |
| [docs/services.md](docs/services.md) | Per-service credential setup, the operations allowlist, and the full list of available tools |
| [docs/clients.md](docs/clients.md) | Connecting MCP clients — generic clients, mcporter, and OpenClaw specifically |
| [docs/architecture.md](docs/architecture.md) | System overview, request flow, integration patterns, security model, source layout |
| [docs/development.md](docs/development.md) | Running the proxy locally, tests, typechecking |
| [docs/openclaw/](docs/openclaw/) | Ready-made OpenClaw skill files for the exposed services |

## Supported services

| Service | Backed by | Notes |
|---------|-----------|-------|
| Google Workspace (Calendar, Gmail, Drive, …) | [gws CLI](https://github.com/googleworkspace/cli) | OAuth2; each service toggled independently |
| Calendar (CalDAV) | tsdav | Fastmail, iCloud, Nextcloud, Radicale, … |
| Email | IMAP / SMTP | any provider |
| Todoist | official hosted MCP (`ai.todoist.net`) | tool schemas stay current automatically |
| Places search | Google Places API (New) via goplaces | read-only |
| Image generation & editing | Gemini / Imagen | returns MCP image content |

## License

See [LICENSE](LICENSE). Security policy: [SECURITY.md](SECURITY.md).
