import type { Tool } from "@modelcontextprotocol/sdk/types.js";
import type { ToolResult } from "../types.js";

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
  close(): Promise<void>;
}
