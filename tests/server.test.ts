import { describe, it, expect, afterAll } from "bun:test";
import { join } from "path";
import type { Subprocess } from "bun";

// Integration test: spawn the real server with empty test configs and verify
// that all modules load under Bun, Express starts, and the health endpoint
// responds correctly.

const FIXTURES = join(import.meta.dir, "fixtures");
const PORT = 3099;

let server: Subprocess<"ignore", "pipe", "pipe"> | null = null;

async function startServer(): Promise<void> {
  server = Bun.spawn(["bun", "src/index.ts"], {
    cwd: join(import.meta.dir, ".."),
    env: {
      ...process.env,
      KEYS_PATH: join(FIXTURES, "keys.test.json"),
      ALLOWLIST_PATH: join(FIXTURES, "allowlist.test.json"),
      PORT: String(PORT),
    },
    stdin: "ignore",
    stdout: "pipe",
    stderr: "pipe",
  });

  // Poll until the server is ready (max 5 s)
  const deadline = Date.now() + 5_000;
  while (Date.now() < deadline) {
    await Bun.sleep(100);
    try {
      const r = await fetch(`http://localhost:${PORT}/health`);
      if (r.ok) return;
    } catch {
      // not ready yet
    }
  }
  throw new Error("Server did not start within 5 s");
}

afterAll(() => {
  server?.kill();
});

describe("server integration", () => {
  it("starts with empty config and responds to /health", async () => {
    await startServer();

    const res = await fetch(`http://localhost:${PORT}/health`);
    expect(res.status).toBe(200);

    const body = (await res.json()) as Record<string, unknown>;
    expect(body.status).toBe("ok");
    expect(body.services).toEqual({
      google_calendar: false,
      email: false,
      todoist: false,
      google_places: false,
      gemini: false,
      gws: false,
    });
    expect(body.tools).toBe(0);
  });

  it("returns SSE headers on GET /sse", async () => {
    const controller = new AbortController();
    const res = await fetch(`http://localhost:${PORT}/sse`, {
      signal: controller.signal,
    });
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/event-stream");
    controller.abort();
  });
});
