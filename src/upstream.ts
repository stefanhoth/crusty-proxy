import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import type { Tool } from "@modelcontextprotocol/sdk/types.js";
import type { TextContent, ImageContent, ToolResult } from "./types.js";

export interface UpstreamConfig {
  url: string;
  bearerToken: string;
  /** Human-readable label for logs and tool name prefix (e.g. "todoist") */
  name: string;
}

/**
 * Connects to an upstream MCP server (HTTP/Streamable), filters its tools by
 * the allowlist, and forwards call results back to OpenClaw.
 *
 * Tools are exposed with a prefix so the namespace is consistent with local
 * tools and collision-safe across multiple upstream services:
 *   upstream tool "get_tasks"  →  OpenClaw sees "todoist_get_tasks"
 *
 * The allowlist uses the upstream's real tool names (no prefix), so it stays
 * valid when Todoist renames or adds tools — you just update allowlist.json.
 */
export class UpstreamMCPClient {
  private client: Client;
  private allowedTools: Set<string>;
  private _tools: Tool[] = [];
  private prefix: string;

  constructor(
    private config: UpstreamConfig,
    allowedOperations: string[],
  ) {
    this.client = new Client(
      { name: "crusty-proxy", version: "1.0.0" },
      { capabilities: {} },
    );
    this.allowedTools = new Set(allowedOperations);
    this.prefix = `${config.name}.`;
  }

  async connect(): Promise<void> {
    const transport = new StreamableHTTPClientTransport(new URL(this.config.url), {
      requestInit: {
        headers: { Authorization: `Bearer ${this.config.bearerToken}` },
      },
    });
    await this.client.connect(transport);

    // Fetch and cache the filtered tool list. The proxy adds a service prefix
    // so OpenClaw sees todoist_get_tasks, todoist_create_task, etc. — matching
    // the naming convention of all local tools.
    const response = await this.client.listTools();
    this._tools = response.tools
      .filter((t) => this.allowedTools.has(t.name))
      .map((t) => ({ ...t, name: `${this.prefix}${t.name}` }));

    const blocked = response.tools
      .filter((t) => !this.allowedTools.has(t.name))
      .map((t) => t.name);

    console.log(
      `[crusty-proxy] Upstream "${this.config.name}" connected — ` +
        `${this._tools.length}/${response.tools.length} tools active (allowlist)`,
    );
    if (blocked.length > 0) {
      console.log(
        `[crusty-proxy] Upstream "${this.config.name}" blocked tools: ${blocked.join(", ")}`,
      );
    }
  }

  /** Filtered, prefixed tool list — handed to OpenClaw via ListTools. */
  get tools(): Tool[] {
    return this._tools;
  }

  /** Whether this client owns the given (prefixed) tool name. */
  owns(toolName: string): boolean {
    return toolName.startsWith(this.prefix) && this.allowedTools.has(this.stripPrefix(toolName));
  }

  async callTool(prefixedName: string, args: Record<string, unknown>): Promise<ToolResult> {
    const name = this.stripPrefix(prefixedName);

    if (!this.allowedTools.has(name)) {
      return {
        content: [{ type: "text", text: `Error: Operation '${name}' is not in the allowlist` }],
        isError: true,
      };
    }

    const result = await this.client.callTool({ name, arguments: args });

    // Convert SDK content array — filter out EmbeddedResource (not in our ToolContent)
    const content = (result.content as Array<{ type: string } & Record<string, unknown>>)
      .filter((c) => c.type === "text" || c.type === "image")
      .map((c) => c as unknown as TextContent | ImageContent);

    return { content, isError: result.isError === true };
  }

  async close(): Promise<void> {
    await this.client.close();
  }

  private stripPrefix(name: string): string {
    return name.startsWith(this.prefix) ? name.slice(this.prefix.length) : name;
  }
}
