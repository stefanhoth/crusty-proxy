# ── goplaces binary ───────────────────────────────────────────────────────────
FROM golang:1.26-alpine AS goplaces-builder
RUN go install github.com/steipete/goplaces/cmd/goplaces@v0.3.0

# ── Production stage ──────────────────────────────────────────────────────────
FROM oven/bun:1-alpine AS runtime

# Non-root, non-1000 user for the proxy process
RUN addgroup -g 2000 mcpproxy && \
    adduser -u 2000 -G mcpproxy -s /sbin/nologin -D mcpproxy

WORKDIR /app

# Install production deps only
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile --production

# Source — Bun runs TypeScript directly, no build step needed
COPY src/ ./src/

# goplaces binary (pre-built Go binary, no Go runtime needed at runtime)
COPY --from=goplaces-builder /go/bin/goplaces /usr/local/bin/goplaces

# Config dir — actual files are bind-mounted read-only at runtime
RUN mkdir -p /etc/mcp-proxy && \
    chown -R mcpproxy:mcpproxy /etc/mcp-proxy && \
    chown -R mcpproxy:mcpproxy /app

USER mcpproxy

EXPOSE 3000

# Healthcheck via the /health endpoint (bun has native fetch — no wget needed)
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD bun --eval "const r=await fetch('http://localhost:3000/health');process.exit(r.ok?0:1)"

CMD ["bun", "src/index.ts"]
