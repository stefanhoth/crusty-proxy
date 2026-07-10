# crusty-proxy — Architecture

## System overview

```mermaid
graph TD
    subgraph VPS["VPS host"]
        subgraph net["Docker network: openclaw-internal"]
            OC["MCP client\n(e.g. OpenClaw)"]
            CP["crusty-proxy\n:3000"]
        end
        OC -->|"MCP/SSE or HTTP\nhttp://crusty-proxy:3000"| CP
    end

    CP -->|"CalDAV (HTTPS)"| CAL["CalDAV server\n(Fastmail / iCloud / …)"]
    CP -->|"IMAP / SMTP"| MAIL["Mail server"]
    CP -->|"HTTPS"| TOD["Todoist hosted MCP\nai.todoist.net/mcp"]
    CP -->|"goplaces subprocess"| PLC["Google Places API"]
    CP -->|"gws subprocess"| GWS["Google Workspace API\n(Calendar, Gmail, Drive, …)"]
    CP -->|"HTTPS"| GEM["Gemini / Imagen API"]
```

The MCP client (an AI agent such as OpenClaw, or any other MCP-speaking workload) never touches external APIs or credentials directly. crusty-proxy is the only egress point.

---

## Request flow

```mermaid
sequenceDiagram
    participant OC as MCP client
    participant CP as crusty-proxy
    participant AL as Allowlist check
    participant SVC as Backend service

    OC->>CP: MCP tool call (tool name + args)
    CP->>AL: isOperationAllowed(service, op)?
    alt not allowed
        AL-->>CP: denied
        CP-->>OC: Error: Operation not allowed
    else allowed
        AL-->>CP: ok
        CP->>SVC: API call / subprocess
        SVC-->>CP: result
        CP-->>OC: MCP tool result
    end
```

The allowlist is checked twice: once when building the tool list (tool won't appear if disabled), and again at call time.

---

## Integration patterns

Three different patterns are used depending on the service:

```mermaid
graph LR
    CP["crusty-proxy"]

    subgraph "Pattern A — direct API"
        CAL["CalDAV\n(tsdav)"]
        MAIL["IMAP / SMTP\n(imapflow / nodemailer)"]
        PLC["Google Places\n(goplaces subprocess)"]
        GEM["Gemini\n(REST)"]
    end

    subgraph "Pattern B — upstream MCP"
        TOD["Todoist\nai.todoist.net/mcp\n(StreamableHTTP)"]
    end

    subgraph "Pattern C — gws CLI bridge"
        GWS["gws subprocess\n(stdio, one per call)\ngws_calendar / gws_gmail\ngws_drive / gws_docs / …"]
    end

    CP --> CAL
    CP --> MAIL
    CP --> PLC
    CP --> GEM
    CP --> TOD
    CP --> GWS
```

| Pattern | How it works | Services |
|---------|-------------|----------|
| A — direct API | In-process TypeScript, credentials from `keys.json` | CalDAV, IMAP/SMTP, Places, Gemini |
| B — upstream MCP | Proxy forwards tool call to official hosted MCP server | Todoist |
| C — gws CLI bridge | Spawns a short-lived `gws` subprocess per call, credentials from bind-mounted file | All Google Workspace services |

---

## Security model

```mermaid
graph TD
    subgraph host["Host filesystem (owned by user crusty)"]
        K["/opt/mcp-proxy/config/keys.json\nroot:crusty 640"]
        A["/opt/mcp-proxy/config/allowlist.json"]
        G["/opt/mcp-proxy/config/gws-credentials.json\nroot:crusty 640"]
    end

    subgraph container["crusty-proxy container\nUID 2000 · read-only rootfs · cap_drop ALL"]
        CP["crusty-proxy process"]
        AL["Allowlist\n(in memory)"]
    end

    K -->|"bind-mount read-only"| CP
    A -->|"bind-mount read-only"| CP
    G -->|"bind-mount read-only"| CP

    CP --> AL
    AL -->|"tool only registered\nif enabled"| TOOLS["Tool list"]
    AL -->|"checked again\nat call time"| DISPATCH["Tool dispatch"]
```

What this enforces:
- **The MCP client has no credentials** — it can only call tools the proxy exposes
- **The proxy cannot modify its own config** — bind-mounts are read-only
- **Deleted operations stay gone** — allowlist is re-read at startup, not cached per-call

What this does *not* prevent: a compromised client using the tools that are permitted (sending email, creating events, etc.).

---

## Source layout

```mermaid
graph TD
    IDX["src/index.ts\nExpress app · MCP server factory\ntool dispatch · health endpoint"]

    IDX --> CFG["src/config.ts\nloads keys.json + allowlist.json\nisOperationAllowed()"]
    IDX --> TYP["src/types.ts\nZod schemas · ToolResult"]

    IDX --> CAL["src/services/calendar.ts\nCalDAV via tsdav"]
    IDX --> IMAP["src/services/imap.ts\nIMAPFlow"]
    IDX --> SMTP["src/services/smtp.ts\nnodemailer"]
    IDX --> TOD["src/services/todoist.ts\nUpstreamMCPClient factory"]
    IDX --> PLC["src/services/places.ts\ngoplaces subprocess"]
    IDX --> GEM["src/services/gemini.ts\nGemini REST"]
    IDX --> GWS["src/services/gws.ts\nGwsServiceBridge\none bridge per gws_* service"]

    TOD --> UPH["src/upstream/http.ts\nStreamableHTTPClientTransport\ngeneric upstream client"]
    UPH --> UPT["src/upstream/types.ts\nUpstreamClient interface"]
```

---

## Transport endpoints

| Endpoint | Protocol | Used by |
|----------|----------|---------|
| `GET /sse` | MCP over SSE (legacy) | OpenClaw default |
| `POST /messages` | SSE message channel | OpenClaw default |
| `POST /mcp` | MCP Streamable HTTP | mcporter, modern clients |
| `GET /health` | JSON status | Docker healthcheck |
| `GET /health?check` | JSON + upstream pings | Manual verification |
