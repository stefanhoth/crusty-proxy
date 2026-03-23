import { execFile } from "child_process";
import { promisify } from "util";
import type { ToolResult } from "../types.js";

export interface GwsAuthStatus {
  token_valid?: boolean;           // absent when auth is broken / token cache missing
  token_cache_exists?: boolean;    // false when no cached token exists
  credentials_readable?: boolean;  // false when credentials file can't be read
  plain_credentials_exists?: boolean;
  user?: string;
  auth_method?: string;
  storage?: string;
  scope_count?: number;
  scopes?: string[];
  has_refresh_token?: boolean;
  credential_source?: string;
}

const execFileAsync = promisify(execFile);

/**
 * Returns true only when all three health signals are clearly positive.
 * A missing field (undefined) is treated as healthy for token_valid but
 * as unhealthy for the other two, matching gws behaviour:
 *  - token_valid is absent when auth is broken (treat absent as false)
 *  - token_cache_exists / credentials_readable are absent when healthy
 */
export function isGwsAuthHealthy(status: GwsAuthStatus): boolean {
  return (
    status.token_valid === true &&
    status.token_cache_exists !== false &&
    status.credentials_readable !== false
  );
}

/**
 * Convert a camelCase parameter key to a --kebab-case CLI flag.
 * e.g. "calendarId" → "--calendar-id", "maxResults" → "--max-results"
 */
function toKebabFlag(key: string): string {
  return "--" + key.replace(/([A-Z])/g, (_, c: string) => "-" + c.toLowerCase());
}

/**
 * Bridges a single Google Workspace CLI (gws) service via direct subprocess calls.
 *
 * Replaces the former stdio MCP approach (gws mcp -s ...) which was removed in
 * gws 0.8.0 (see https://github.com/googleworkspace/cli/pull/275). Each tool call
 * now spawns a short-lived gws process, matching the goplaces pattern.
 *
 * Operation → CLI mapping (operation names match allowlist entries, service prefix stripped):
 *   serviceKey="gws_calendar", op="events_list"           → gws calendar events list
 *   serviceKey="gws_gmail",    op="users_messages_list"   → gws gmail users messages list
 *   serviceKey="gws_drive",    op="files_create"          → gws drive files create
 *
 * Tool input schema:
 *   params  — path and query parameters (Google API camelCase), passed as --kebab-case flags
 *   body    — request body for write operations (insert/update/patch/create), passed as --json
 *
 * Credentials are read by gws from GOOGLE_WORKSPACE_CLI_CREDENTIALS_FILE (env var,
 * bind-mounted read-only into the container). Discovery docs are cached in /tmp/gws.
 */
export class GwsServiceBridge {
  private readonly gwsService: string;
  private readonly env: NodeJS.ProcessEnv;

  constructor(serviceKey: string) {
    // "gws_calendar" → "calendar", "gws_gmail" → "gmail"
    this.gwsService = serviceKey.replace(/^gws_/, "");
    this.env = {
      ...process.env,
      GOOGLE_WORKSPACE_CLI_CONFIG_DIR: process.env.GOOGLE_WORKSPACE_CLI_CONFIG_DIR ?? "/tmp/gws",
    };
  }

  /** The bare gws service name, e.g. "calendar", "gmail", "drive" */
  get gwsServiceName(): string {
    return this.gwsService;
  }

  /**
   * Run `gws auth status` and return the parsed result.
   * Since all bridges share the same credentials file, any bridge instance
   * can run this — call it once on the first active bridge.
   * Returns null if gws is not installed or the command fails.
   */
  async authStatus(): Promise<GwsAuthStatus | null> {
    try {
      const { stdout } = await execFileAsync("gws", ["auth", "status"], {
        timeout: 10_000,
        env: this.env,
      });
      return JSON.parse(stdout.trim()) as GwsAuthStatus;
    } catch {
      return null;
    }
  }

  async call(operation: string, args: Record<string, unknown>): Promise<ToolResult> {
    // "events_list" → ["events", "list"], "users_messages_list" → ["users", "messages", "list"]
    const segments = operation.split("_");
    const cmdArgs: string[] = [this.gwsService, ...segments, "--format", "json"];

    // Path/query params → --kebab-case flags
    const params = args.params as Record<string, unknown> | undefined;
    if (params) {
      for (const [key, value] of Object.entries(params)) {
        if (value === null || value === undefined) continue;
        if (typeof value === "boolean") {
          if (value) cmdArgs.push(toKebabFlag(key));
        } else if (Array.isArray(value)) {
          // Repeated params (e.g. labelIds) — one flag per value
          for (const item of value) cmdArgs.push(toKebabFlag(key), String(item));
        } else {
          cmdArgs.push(toKebabFlag(key), String(value));
        }
      }
    }

    // Request body → --json
    const body = args.body as Record<string, unknown> | undefined;
    if (body && Object.keys(body).length > 0) {
      cmdArgs.push("--json", JSON.stringify(body));
    }

    try {
      const { stdout, stderr } = await execFileAsync("gws", cmdArgs, {
        timeout: 30_000,
        maxBuffer: 5 * 1024 * 1024,
        env: this.env,
      });
      if (stderr) console.warn(`[gws_${this.gwsService}] stderr:`, stderr.trim());
      return { content: [{ type: "text", text: stdout.trim() }] };
    } catch (e: unknown) {
      // execFile rejects with an error object carrying stderr/stdout/code
      const err = e as { stderr?: string; stdout?: string; code?: number; message?: string };
      // gws ≥0.12.0 structured exit codes: 1=API, 2=Auth, 3=Validation, 4=Discovery, 5=Internal
      const detail = err.stderr?.trim() || err.stdout?.trim() || err.message || "unknown error";
      return {
        content: [{ type: "text", text: `gws error (exit ${err.code ?? "?"}): ${detail}` }],
        isError: true,
      };
    }
  }
}
