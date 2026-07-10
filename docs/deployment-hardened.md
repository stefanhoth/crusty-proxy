# Hardened deployment — maximum isolation on a VPS

This is the setup crusty-proxy was originally built for: an autonomous AI agent (e.g. OpenClaw) and the proxy running side by side on the same self-managed host, isolated from each other as strictly as possible — a dedicated system user, locked-down file permissions, and an internal Docker network as the only path between them.

Use this guide when the MCP client on the host is long-running and autonomous, so a compromise of the client must not be able to reach the proxy's credentials. For a quicker, less ceremonial setup, see [deployment.md](deployment.md).

## Assumptions

- **The proxy and its MCP client run on the same host.** They communicate over an internal Docker network (`openclaw-internal` by default — rename it in `docker-compose.yml` if you like). No external networking, no TLS between them — the shared host is the trust boundary.
- **The host is a self-managed VPS** (Ubuntu 24 or similar). You have root access to create users and manage Docker.

## 1. Create a dedicated system user

Run as root. This user owns the proxy files and runs its Docker Compose — completely separate from the user running your agent.

```bash
groupadd --gid 2000 crusty
useradd --system --uid 2000 --gid 2000 --shell /usr/sbin/nologin --create-home --home-dir /opt/mcp-proxy crusty
# Allow crusty to manage Docker without sudo
usermod -aG docker crusty
```

> UID/GID 2000 must match the user inside the container. If either is already taken on your system, pick a free UID/GID and update `user:` in `docker-compose.yml` accordingly.

> **Why a separate user?** If the agent is ever compromised, the attacker gains the agent user's privileges — not `crusty`'s. The config files in `/opt/mcp-proxy/config/` (including API keys) are owned by `crusty` and unreadable to the agent's user.

## 2. Get the config files

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

## 3. Create the shared Docker network

```bash
docker network create openclaw-internal
```

This is the network both the proxy and your MCP client's container join. The name is just the default from `docker-compose.yml` — if you rename it there, create the network under that name instead.

## 4. Create and secure the keys file

Run as root (or your normal admin user). The `crusty` service account only needs **read** access — it should not be able to modify its own credentials.

```bash
cp /opt/mcp-proxy/config/keys.example.json /opt/mcp-proxy/config/keys.json
nano /opt/mcp-proxy/config/keys.json
chown root:crusty /opt/mcp-proxy/config/keys.json
chmod 640 /opt/mcp-proxy/config/keys.json
```

`root:crusty 640` means root can read/write, the `crusty` group (which the service process is in) can read, and nobody else can see the file. A compromised `crusty` process cannot overwrite or replace its own keys.

Which credentials go into `keys.json` — and how to obtain them per service — is covered in [services.md](services.md).

## 5. Start

```bash
sudo -u crusty docker compose -f /opt/mcp-proxy/docker-compose.yml up -d
sudo -u crusty docker compose -f /opt/mcp-proxy/docker-compose.yml logs -f
```

The image is pulled automatically from `ghcr.io/stefanhoth/crusty-proxy:latest`. To build from source instead, see the comment in `docker-compose.yml`.

## 6. Verify health

```bash
# Check container health status:
docker inspect crusty-proxy --format='{{.State.Health.Status}}'

# Or read the full health response:
docker exec crusty-proxy bun --eval \
  "fetch('http://localhost:3000/health').then(r=>r.json()).then(j=>console.log(JSON.stringify(j,null,2)))"
```

## Next steps

- Configure service credentials and the allowlist: [services.md](services.md)
- Connect your MCP client to the proxy: [clients.md](clients.md)
