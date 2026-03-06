import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import type { Tool } from "@modelcontextprotocol/sdk/types.js";
import type { TextContent, ImageContent, ToolResult } from "../types.js";
import type { UpstreamClient, UpstreamPingResult } from "./types.js";

export interface HttpUpstreamConfig {
  url: string;
  bearerToken: string;
  /** Human-readable label for logs and tool name prefix (e.g. "todoist") */
  name: string;
}

/**
 * Upstream MCP client over Streamable HTTP.
 * Used for hosted MCP servers that authenticate via bearer token (e.g. Todoist).
 */
export class HttpUpstreamClient implements UpstreamClient {
  private client: Client;
  private allowedTools: Set<string>;
  private _tools: Tool[] = [];
  private prefix: string;

  constructor(
    private config: HttpUpstreamConfig,
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
    await this.fetchTools();
  }

  get tools(): Tool[] {
    return this._tools;
  }

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
    const content = (result.content as Array<{ type: string } & Record<string, unknown>>)
      .filter((c) => c.type === "text" || c.type === "image")
      .map((c) => c as unknown as TextContent | ImageContent);

    return { content, isError: result.isError === true };
  }

  async ping(): Promise<UpstreamPingResult> {
    try {
      const response = await this.client.listTools();
      const upstreamNames = new Set(response.tools.map((t) => t.name));
      return {
        reachable: true,
        tools_active:  response.tools.filter((t) =>  this.allowedTools.has(t.name)).length,
        tools_blocked: response.tools.filter((t) => !this.allowedTools.has(t.name)).length,
        tools_unknown: [...this.allowedTools].filter((n) => !upstreamNames.has(n)).length,
      };
    } catch {
      return { reachable: false, tools_active: 0, tools_blocked: 0, tools_unknown: 0 };
    }
  }

  async close(): Promise<void> {
    await this.client.close();
  }

  private async fetchTools(): Promise<void> {
    const response = await this.client.listTools();
    const upstreamNames = new Set(response.tools.map((t) => t.name));
    const blocked = response.tools.filter((t) => !this.allowedTools.has(t.name)).map((t) => t.name);
    const unknown = [...this.allowedTools].filter((n) => !upstreamNames.has(n));

    this._tools = response.tools
      .filter((t) => this.allowedTools.has(t.name))
      .map((t) => ({ ...t, name: `${this.prefix}${t.name}` }));

    const ts = new Date().toISOString();
    console.log(ts, "[crusty-proxy]", `Upstream "${this.config.name}" connected`, {
      active: this._tools.length,
      blocked: blocked.length,
      unknown: unknown.length,
    });
    if (blocked.length > 0) console.log(ts, "[crusty-proxy]", `Upstream "${this.config.name}" blocked tools:`, blocked);
    if (unknown.length > 0) console.log(ts, "[crusty-proxy]", `Upstream "${this.config.name}" unknown tools (stale allowlist entries):`, unknown);
  }

  private stripPrefix(name: string): string {
    return name.startsWith(this.prefix) ? name.slice(this.prefix.length) : name;
  }
}
