# ── goplaces binary ───────────────────────────────────────────────────────────
FROM golang:1.24-alpine AS goplaces-builder
RUN go install github.com/steipete/goplaces/cmd/goplaces@v0.3.0

# ── Node build stage ──────────────────────────────────────────────────────────
FROM node:24-alpine AS builder

WORKDIR /build

COPY package*.json ./
RUN npm ci --ignore-scripts

COPY tsconfig.json ./
COPY src/ ./src/

RUN npm run build

# ── Production stage ──────────────────────────────────────────────────────────
FROM node:24-alpine AS runtime

# Non-root, non-1000 user for the proxy process
RUN addgroup -g 2000 mcpproxy && \
    adduser -u 2000 -G mcpproxy -s /sbin/nologin -D mcpproxy

WORKDIR /app

# Install production deps only
COPY package*.json ./
RUN npm ci --omit=dev --ignore-scripts && \
    npm cache clean --force

# Copy compiled output
COPY --from=builder /build/dist ./dist

# goplaces binary (pre-built Go binary, no Go runtime needed at runtime)
COPY --from=goplaces-builder /go/bin/goplaces /usr/local/bin/goplaces

# Config dir — actual files are bind-mounted read-only at runtime
RUN mkdir -p /etc/mcp-proxy && \
    chown -R mcpproxy:mcpproxy /etc/mcp-proxy && \
    chown -R mcpproxy:mcpproxy /app

USER mcpproxy

EXPOSE 3000

# Healthcheck via the /health endpoint
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost:3000/health || exit 1

CMD ["node", "dist/index.js"]
