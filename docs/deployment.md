# Deployment

The Docker image is published to GHCR — no build step needed, no repo clone required. This page covers a straightforward Docker Compose setup.

> **Running an autonomous AI agent on the same host?** Consider the [hardened deployment](deployment-hardened.md) instead: a dedicated system user and file permissions that keep the proxy's credentials unreadable even if the agent's user is compromised. This page's setup still isolates credentials from the *client process* — the hardened guide additionally isolates them from the client's *host user*.

## 1. Get the files

```bash
mkdir -p mcp-proxy/config && cd mcp-proxy

BASE=https://raw.githubusercontent.com/stefanhoth/crusty-proxy/main
curl -fsSL $BASE/docker-compose.yml        -o docker-compose.yml
curl -fsSL $BASE/config/keys.example.json  -o config/keys.example.json
curl -fsSL $BASE/config/allowlist.json     -o config/allowlist.json
```

## 2. Configure

```bash
cp config/keys.example.json config/keys.json
chmod 600 config/keys.json
```

- Fill in `config/keys.json` with credentials for the services you want — [services.md](services.md) walks through each one.
- Enable those services in `config/allowlist.json` (`"enabled": true`) and keep the operations list as tight as your use case allows.

## 3. Start

```bash
docker network create openclaw-internal   # shared network the proxy and your MCP client join
docker compose up -d
docker compose logs -f
```

The image is pulled automatically from `ghcr.io/stefanhoth/crusty-proxy:latest`. To build from source instead, see the comment in `docker-compose.yml`.

## 4. Verify

```bash
# Container health status:
docker inspect crusty-proxy --format='{{.State.Health.Status}}'

# Full health response:
docker exec crusty-proxy bun --eval \
  "fetch('http://localhost:3000/health').then(r=>r.json()).then(j=>console.log(JSON.stringify(j,null,2)))"
```

Then connect your MCP client — see [clients.md](clients.md).

## Good to know

- **The proxy has no authentication of its own.** It is designed to be reachable only over the internal Docker network (`expose`, no published ports). Never publish its port on a public interface.
- **The network name is just a default.** `openclaw-internal` is historical — rename it in `docker-compose.yml` and create the network under your name instead.
- **Clients running directly on the host** (not in Docker) can't reach the internal network. Publish the port on loopback in `docker-compose.yml` (`ports: ["127.0.0.1:3000:3000"]`) instead.
- **Protect `keys.json`.** It holds all your API credentials; `chmod 600` at minimum. The container only needs read access — the file is bind-mounted read-only.
- **Container hardening is already in the compose file:** non-root user (UID 2000), read-only root filesystem, all capabilities dropped, `no-new-privileges`. You don't need to add anything for that.
- **Allowlist changes** require a restart: `docker compose restart mcp-proxy`. See [services.md](services.md#modifying-the-allowlist).
