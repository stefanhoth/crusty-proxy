import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import type { Tool } from "@modelcontextprotocol/sdk/types.js";
import type { TextContent, ImageContent, ToolResult } from "../types.js";
import type { UpstreamClient, UpstreamPingResult } from "./types.js";

export interface StdioUpstreamConfig {
  /** Human-readable label for logs and tool name prefix (e.g. "gws") */
  name: string;
  command: string;
  args?: string[];
  /** Extra environment variables passed to the child process. */
  env?: Record<string, string>;
}

/**
 * Upstream MCP client over stdio.
 * Used for local CLI tools that speak MCP over stdin/stdout (e.g. gws mcp).
 * The child process is spawned on connect() and terminated on close().
 */
export class StdioUpstreamClient implements UpstreamClient {
  private client: Client;
  private allowedTools: Set<string>;
  private _tools: Tool[] = [];
  private prefix: string;

  constructor(
    private config: StdioUpstreamConfig,
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
    const transport = new StdioClientTransport({
      command: this.config.command,
      args: this.config.args,
      env: this.config.env,
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
        tools_active:  response.tools.filter((t) =>  this.allowedTools.has(t.name)).map((t) => t.name),
        tools_blocked: response.tools.filter((t) => !this.allowedTools.has(t.name)).map((t) => t.name),
        tools_unknown: [...this.allowedTools].filter((n) => !upstreamNames.has(n)),
      };
    } catch {
      return { reachable: false, tools_active: [], tools_blocked: [], tools_unknown: [] };
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
