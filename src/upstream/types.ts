import type { Tool } from "@modelcontextprotocol/sdk/types.js";
import type { ToolResult } from "../types.js";

export interface UpstreamPingResult {
  reachable: boolean;
  /** Tools present in upstream AND in allowlist. */
  tools_active: string[];
  /** Tools present in upstream but NOT in allowlist. */
  tools_blocked: string[];
  /** Tools in allowlist but NOT present in upstream (stale or wrong names). */
  tools_unknown: string[];
}

/**
 * Common interface for upstream MCP clients, regardless of transport.
 * Implementations: HttpUpstreamClient (Streamable HTTP), StdioUpstreamClient (stdio process).
 */
export interface UpstreamClient {
  connect(): Promise<void>;
  /** Filtered, prefixed tool list — handed to OpenClaw via ListTools. */
  readonly tools: Tool[];
  /** Whether this client owns the given (prefixed) tool name. */
  owns(toolName: string): boolean;
  callTool(prefixedName: string, args: Record<string, unknown>): Promise<ToolResult>;
  /** Live reachability check — calls listTools() and returns tool counts. */
  ping(): Promise<UpstreamPingResult>;
  close(): Promise<void>;
}
