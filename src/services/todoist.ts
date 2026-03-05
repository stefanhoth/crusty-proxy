import { UpstreamMCPClient } from "../upstream.js";
import type { TodoistKeysSchema } from "../types.js";
import type { z } from "zod";

type TodoistKeys = z.infer<typeof TodoistKeysSchema>;

/**
 * Creates an UpstreamMCPClient pointed at the official Todoist hosted MCP.
 *
 * Todoist maintains this server — tool schemas, descriptions, and new
 * capabilities stay current automatically. The allowlist in allowlist.json
 * controls which tools are exposed to OpenClaw.
 *
 * Getting the bearer token (one-time setup):
 *   mcporter auth https://ai.todoist.net/mcp
 *   # or: npx mcp-remote auth https://ai.todoist.net/mcp
 * Then copy the resulting access token into keys.json.
 */
export function createTodoistUpstream(
  keys: TodoistKeys,
  allowedOperations: string[],
): UpstreamMCPClient {
  return new UpstreamMCPClient(
    {
      url: keys.mcp_url,
      bearerToken: keys.bearer_token,
      name: "todoist",
    },
    allowedOperations,
  );
}
