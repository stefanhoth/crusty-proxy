# Security boundaries

## What the proxy protects

| Threat | Mitigation |
|--------|-----------|
| OpenClaw exfiltrates API keys | Keys exist only in the proxy container. OpenClaw never receives them — not in env vars, not in tool results, not in logs. |
| OpenClaw calls a destructive API (delete event, delete email) | Operations not in `allowlist.json` are never registered as MCP tools. Even if OpenClaw guesses the tool name, the proxy double-checks the allowlist at call time. |
| Attacker gains code execution in OpenClaw | Proxy is only reachable via the internal Docker network on port 3000. No other port is exposed. No other container on the host can reach it unless explicitly joined to `openclaw-internal`. |
| Config tampering from inside the proxy | Config files are bind-mounted read-only (`ro`). The container filesystem is read-only (`read_only: true`). The process runs as UID 2000 with no capabilities. |
| Privilege escalation inside the proxy | `no-new-privileges: true`, `cap_drop: ALL`, non-root UID (2000, not 1000). |
| Key leakage via Docker environment | Keys are in a JSON file, not environment variables. `docker inspect` on the proxy container shows no secrets. |

## What the proxy does NOT protect against

| Threat | Notes |
|--------|-------|
| Prompt injection leading OpenClaw to misuse allowed operations | The proxy enforces *which* operations are available, not *why* they're called. A manipulated OpenClaw could still create spam calendar events or send emails to wrong recipients. |
| Compromised proxy container image | If the image itself is malicious, all bets are off. Use the provided Dockerfile and build from source. |
| Network sniffing on `openclaw-internal` | Traffic between OpenClaw and the proxy is HTTP (not HTTPS) because it's internal. Any container on `openclaw-internal` can observe it. Keep the network membership minimal. |
| Stolen `config/keys.json` from the VPS host | Secure access to the VPS. The file should be `chmod 600` and owned by root or the deploying user. |
| Rate limit abuse / cost overruns | The proxy does not implement rate limiting. External API costs are bounded only by how much OpenClaw calls the tools. |

## Network isolation summary

```
Internet
   │
   │  (no direct path)
   ▼
VPS host
   ├── openclaw-src_default network
   │       └── OpenClaw container
   │               │
   │       openclaw-internal network (external, shared)
   │               │
   └── mcp-proxy stack
           └── crusty-proxy container  ← only reachable here
                   │
                   ├── Google Calendar API  (outbound HTTPS)
                   ├── IMAP/SMTP            (outbound)
                   ├── Todoist API          (outbound HTTPS)
                   ├── Google Places API    (outbound HTTPS)
                   └── Gemini API           (outbound HTTPS)
```

Port 3000 is `expose`d (not `ports:`), meaning it is **not** reachable from the VPS host or the internet — only from containers on the same Docker network.
