# Local development

crusty-proxy runs on [Bun](https://bun.sh). No Docker required for local work.

## Run the proxy locally

```bash
bun install
cp config/keys.example.json config/keys.json
# fill in keys.json for the services you want to test

export KEYS_PATH=./config/keys.json
export ALLOWLIST_PATH=./config/allowlist.json
bun run dev        # watch mode
```

The server listens on port 3000 (override with `PORT`). Endpoints are listed in [clients.md](clients.md); a quick smoke test:

```bash
curl -s http://localhost:3000/health | python3 -m json.tool
```

## Tests and typechecking

```bash
bun test
bun run typecheck
```

## Building the Docker image

The published image comes from GHCR, but you can build locally:

```bash
docker build -t crusty-proxy .
```

Or in `docker-compose.yml`, comment out `image:` and uncomment the `build:` block.

## Source layout

See the [architecture doc](architecture.md#source-layout) for a map of `src/` — entry point, config loading, per-service modules, and the upstream MCP client.
