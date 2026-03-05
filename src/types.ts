import { z } from "zod";

// ── Config schemas ──────────────────────────────────────────────────────────

export const GoogleCalendarKeysSchema = z.object({
  client_id: z.string(),
  client_secret: z.string(),
  refresh_token: z.string(),
  calendar_id: z.string().default("primary"),
});

export const EmailKeysSchema = z.object({
  imap: z.object({
    host: z.string(),
    port: z.number().int().positive(),
    tls: z.boolean().default(true),
    username: z.string(),
    password: z.string(),
  }),
  smtp: z.object({
    host: z.string(),
    port: z.number().int().positive(),
    secure: z.boolean().default(false),
    username: z.string(),
    password: z.string(),
  }),
});

export const TodoistKeysSchema = z.object({
  /** URL of the upstream Todoist MCP server. Default: https://ai.todoist.net/mcp */
  mcp_url: z.string().url().default("https://ai.todoist.net/mcp"),
  /** OAuth bearer token — obtain once via: mcporter auth https://ai.todoist.net/mcp */
  bearer_token: z.string(),
});

export const GooglePlacesKeysSchema = z.object({
  api_key: z.string(),
});

export const GeminiKeysSchema = z.object({
  api_key: z.string(),
});

export const KeysSchema = z.object({
  google_calendar: GoogleCalendarKeysSchema.optional(),
  email: EmailKeysSchema.optional(),
  todoist: TodoistKeysSchema.optional(),
  google_places: GooglePlacesKeysSchema.optional(),
  gemini: GeminiKeysSchema.optional(),
});

export const ServiceAllowlistSchema = z.object({
  enabled: z.boolean().default(true),
  allowed_operations: z.array(z.string()),
});

export const AllowlistSchema = z.object({
  services: z.object({
    google_calendar: ServiceAllowlistSchema.optional(),
    email: ServiceAllowlistSchema.optional(),
    todoist: ServiceAllowlistSchema.optional(),
    google_places: ServiceAllowlistSchema.optional(),
    gemini: ServiceAllowlistSchema.optional(),
  }),
});

export type Keys = z.infer<typeof KeysSchema>;
export type Allowlist = z.infer<typeof AllowlistSchema>;

// ── Tool result types ───────────────────────────────────────────────────────

export interface TextContent {
  type: "text";
  text: string;
}

export interface ImageContent {
  type: "image";
  data: string;
  mimeType: string;
}

export type ToolContent = TextContent | ImageContent;

export interface ToolResult {
  content: ToolContent[];
  isError?: boolean;
}
