# Connecting MCP clients

crusty-proxy speaks standard MCP, so any MCP client can use it — an AI agent, an agentic workflow, a coding assistant, or a plain script using an MCP SDK. The proxy is not exposed to the host or the internet; clients reach it over the shared internal Docker network (default name: `openclaw-internal`).

## Endpoints

| Endpoint | Protocol | Typical client |
|----------|----------|----------------|
| `POST /mcp` | MCP Streamable HTTP | modern MCP clients (recommended) |
| `GET /sse` + `POST /messages` | MCP over SSE (legacy) | older clients, OpenClaw default |
| `GET /health` | JSON status | Docker healthcheck |
| `GET /health?check` | JSON + upstream pings | manual verification |

From a container on the same Docker network, the base URL is `http://crusty-proxy:3000` — the hostname resolves via Docker DNS, no IP addresses or published ports needed.

## Generic MCP client

Join the client's container to the shared network, then configure the server URL. For any client that takes a Streamable HTTP MCP server config:

```json
{
  "mcpServers": {
    "crusty-proxy": {
      "type": "http",
      "url": "http://crusty-proxy:3000/mcp"
    }
  }
}
```

To join the network, add to the client's `docker-compose.yml`:

```yaml
services:
  your-agent:
    networks:
      - default
      - openclaw-internal

networks:
  openclaw-internal:
    external: true
```

> Running the client directly on the host (not in Docker)? Either publish the proxy's port on `127.0.0.1` in `docker-compose.yml` (`ports: ["127.0.0.1:3000:3000"]`) or run the proxy with `bun run dev` locally — see [development.md](development.md). Do **not** publish the port on a public interface; the proxy has no authentication of its own.

### Verify with mcporter

`mcporter` (`npx mcporter`) is a handy CLI for poking at MCP servers:

```bash
mcporter config add crusty-proxy http://crusty-proxy:3000/mcp
mcporter list crusty-proxy    # lists the tools the proxy currently exposes
```

## OpenClaw

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

**Verify the connection:**

```bash
mcporter list crusty-proxy
```

### OpenClaw skill files

[docs/openclaw/](openclaw/) contains ready-made OpenClaw skill definitions for the exposed services (calendar, email, Todoist, places, image generation). Drop them into your OpenClaw skills directory to give the agent usage instructions for each tool set.
