import { StdioUpstreamClient } from "../upstream/stdio.js";

/**
 * Creates a StdioUpstreamClient for the Google Workspace CLI (gws mcp).
 *
 * gws reads credentials from GOOGLE_WORKSPACE_CLI_CREDENTIALS_FILE (an env
 * var pointing to the exported credentials JSON). The discovery cache goes
 * to /tmp/gws so it survives within a session but doesn't need a writable
 * rootfs beyond the tmpfs mount.
 *
 * Which gws services to start is derived from the allowlist tool name prefixes:
 *   "calendar_events_list"  → needs service "calendar"
 *   "gmail_users_messages_list" → needs service "gmail"
 *
 * Getting credentials (one-time setup):
 *   gws auth login            # on a machine with a browser
 *   gws auth export --unmasked > gws-credentials.json
 * Then copy gws-credentials.json to /opt/mcp-proxy/config/ on the VPS.
 */
export function createGwsUpstream(allowedOperations: string[]): StdioUpstreamClient {
  // Derive service names from tool name prefixes (first segment before "_")
  const services = [...new Set(allowedOperations.map((op) => op.split("_")[0]).filter(Boolean))];

  return new StdioUpstreamClient(
    {
      name: "gws",
      command: "gws",
      args: ["mcp", "-s", services.join(",")],
      env: {
        // Credentials file — bind-mounted read-only into the container
        ...(process.env.GOOGLE_WORKSPACE_CLI_CREDENTIALS_FILE && {
          GOOGLE_WORKSPACE_CLI_CREDENTIALS_FILE: process.env.GOOGLE_WORKSPACE_CLI_CREDENTIALS_FILE,
        }),
        // Use tmpfs for discovery document cache (container has read-only rootfs)
        GOOGLE_WORKSPACE_CLI_CONFIG_DIR: "/tmp/gws",
      },
    },
    allowedOperations,
  );
}
