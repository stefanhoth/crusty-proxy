import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { writeFileSync, mkdirSync, rmSync } from "fs";
import { join } from "path";
import { isOperationAllowed, loadKeys, loadAllowlist } from "../src/config.js";
import type { Allowlist } from "../src/types.js";

// ── isOperationAllowed ──────────────────────────────────────────────────────

describe("isOperationAllowed", () => {
  const al: Allowlist = {
    services: {
      google_calendar: { enabled: true, allowed_operations: ["list_events", "get_event"] },
      email: { enabled: false, allowed_operations: ["list_messages", "send_message"] },
    },
  };

  it("allows an operation in the allowlist for an enabled service", () => {
    expect(isOperationAllowed(al, "google_calendar", "list_events")).toBe(true);
  });

  it("blocks an operation not in the allowlist", () => {
    expect(isOperationAllowed(al, "google_calendar", "delete_event")).toBe(false);
  });

  it("blocks all operations for a disabled service", () => {
    expect(isOperationAllowed(al, "email", "list_messages")).toBe(false);
    expect(isOperationAllowed(al, "email", "send_message")).toBe(false);
  });

  it("blocks operations for an unconfigured service", () => {
    expect(isOperationAllowed(al, "gemini", "generate_image")).toBe(false);
  });
});

// ── loadKeys / loadAllowlist ─────────────────────────────────────────────────

describe("loadKeys", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = join(import.meta.dir, "__tmp_config_test__");
    mkdirSync(tmpDir, { recursive: true });
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
    delete process.env.KEYS_PATH;
    delete process.env.ALLOWLIST_PATH;
  });

  it("accepts an empty keys object (all services optional)", () => {
    const path = join(tmpDir, "keys.json");
    writeFileSync(path, "{}");
    process.env.KEYS_PATH = path;
    const keys = loadKeys();
    expect(keys.google_calendar).toBeUndefined();
    expect(keys.email).toBeUndefined();
  });

  it("parses a valid todoist keys entry", () => {
    const path = join(tmpDir, "keys.json");
    writeFileSync(path, JSON.stringify({ todoist: { bearer_token: "tok_abc" } }));
    process.env.KEYS_PATH = path;
    const keys = loadKeys();
    expect(keys.todoist?.bearer_token).toBe("tok_abc");
    expect(keys.todoist?.mcp_url).toBe("https://ai.todoist.net/mcp");
  });

  it("throws on missing required field", () => {
    const path = join(tmpDir, "keys.json");
    // todoist requires bearer_token
    writeFileSync(path, JSON.stringify({ todoist: { mcp_url: "https://ai.todoist.net/mcp" } }));
    process.env.KEYS_PATH = path;
    expect(() => loadKeys()).toThrow();
  });

  it("throws on a non-existent file", () => {
    process.env.KEYS_PATH = join(tmpDir, "does_not_exist.json");
    expect(() => loadKeys()).toThrow();
  });
});

describe("loadAllowlist", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = join(import.meta.dir, "__tmp_allowlist_test__");
    mkdirSync(tmpDir, { recursive: true });
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
    delete process.env.ALLOWLIST_PATH;
  });

  it("accepts a minimal allowlist with no services", () => {
    const path = join(tmpDir, "allowlist.json");
    writeFileSync(path, JSON.stringify({ services: {} }));
    process.env.ALLOWLIST_PATH = path;
    const al = loadAllowlist();
    expect(al.services).toEqual({});
  });

  it("defaults enabled to true when omitted", () => {
    const path = join(tmpDir, "allowlist.json");
    writeFileSync(
      path,
      JSON.stringify({ services: { google_calendar: { allowed_operations: ["list_events"] } } }),
    );
    process.env.ALLOWLIST_PATH = path;
    const al = loadAllowlist();
    expect(al.services.google_calendar?.enabled).toBe(true);
  });
});
