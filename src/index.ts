import { version } from "../package.json";
import express from "express";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { loadKeys, loadAllowlist, isOperationAllowed } from "./config.js";
import { CalendarService } from "./services/calendar.js";
import { EmailService } from "./services/email.js";
import { createTodoistUpstream } from "./services/todoist.js";
import { PlacesService } from "./services/places.js";
import { GeminiService } from "./services/gemini.js";
import { UpstreamMCPClient } from "./upstream.js";
import type { Tool } from "@modelcontextprotocol/sdk/types.js";
import type { Allowlist, Keys, ToolResult } from "./types.js";

// ── Logging ──────────────────────────────────────────────────────────────────

const log = {
  info:  (...args: unknown[]) => console.log( new Date().toISOString(), "[crusty-proxy]", ...args),
  warn:  (...args: unknown[]) => console.warn( new Date().toISOString(), "[crusty-proxy]", ...args),
  error: (...args: unknown[]) => console.error(new Date().toISOString(), "[crusty-proxy]", ...args),
};

// ── Startup ─────────────────────────────────────────────────────────────────

let keys: Keys;
let allowlist: Allowlist;

try {
  keys = loadKeys();
  allowlist = loadAllowlist();
  log.info("Config loaded successfully");
} catch (err) {
  log.error("FATAL: Failed to load config:", err);
  process.exit(1);
}

// ── Local service instances (direct API wrappers) ────────────────────────────

const calendar = keys.google_calendar ? new CalendarService(keys.google_calendar) : null;
const email    = keys.email           ? new EmailService(keys.email)               : null;
const places   = keys.google_places   ? new PlacesService(keys.google_places)      : null;
const gemini   = keys.gemini          ? new GeminiService(keys.gemini)             : null;

log.info("Services configured:", {
  google_calendar: calendar !== null,
  email:           email    !== null,
  google_places:   places   !== null,
  gemini:          gemini   !== null,
});

// ── Upstream MCP clients (official hosted MCP servers) ───────────────────────
// Populated async in main() before the HTTP server starts.
// Key = service name, Value = connected client with cached tool list.

const upstreams = new Map<string, UpstreamMCPClient>();

async function initUpstreams(): Promise<void> {
  if (keys.todoist && allowlist.services.todoist?.enabled) {
    const client = createTodoistUpstream(
      keys.todoist,
      allowlist.services.todoist.allowed_operations,
    );
    await client.connect();
    upstreams.set("todoist", client);
    log.info(`Todoist upstream connected — ${client.tools.length} tools available`);
  }
  // Add future official MCP servers here (same pattern):
  //   if (keys.someService && allowlist.services.someService?.enabled) {
  //     const client = createSomeServiceUpstream(...);
  //     await client.connect();
  //     upstreams.set("someService", client);
  //   }
}

// ── Tool definitions ─────────────────────────────────────────────────────────

function buildTools(al: Allowlist): Tool[] {
  const tools: Tool[] = [];

  if (al.services.google_calendar?.enabled) {
    const ops = al.services.google_calendar.allowed_operations;
    if (ops.includes("list_events")) {
      tools.push({
        name: "calendar.list_events",
        description: "List Google Calendar events in a date range",
        inputSchema: {
          type: "object",
          properties: {
            start_date: { type: "string", description: "Start date (ISO 8601 or natural language, e.g. 2025-01-01)" },
            end_date: { type: "string", description: "End date (ISO 8601 or natural language)" },
            max_results: { type: "number", description: "Maximum number of events to return (default 50)" },
            query: { type: "string", description: "Free text search within events" },
          },
          required: ["start_date", "end_date"],
        },
      });
    }
    if (ops.includes("get_event")) {
      tools.push({
        name: "calendar.get_event",
        description: "Get a specific Google Calendar event by ID",
        inputSchema: {
          type: "object",
          properties: {
            event_id: { type: "string", description: "The Google Calendar event ID" },
          },
          required: ["event_id"],
        },
      });
    }
    if (ops.includes("create_event")) {
      tools.push({
        name: "calendar.create_event",
        description: "Create a new event in Google Calendar",
        inputSchema: {
          type: "object",
          properties: {
            summary: { type: "string", description: "Event title" },
            start: { type: "string", description: "Start datetime (ISO 8601)" },
            end: { type: "string", description: "End datetime (ISO 8601)" },
            description: { type: "string", description: "Event description" },
            location: { type: "string", description: "Event location" },
            attendees: {
              type: "array",
              items: { type: "string" },
              description: "List of attendee email addresses",
            },
          },
          required: ["summary", "start", "end"],
        },
      });
    }
  }

  if (al.services.email?.enabled) {
    const ops = al.services.email.allowed_operations;
    if (ops.includes("list_messages")) {
      tools.push({
        name: "email.list_messages",
        description: "List email messages from IMAP inbox",
        inputSchema: {
          type: "object",
          properties: {
            folder: { type: "string", description: "Mailbox folder (default: INBOX)" },
            limit: { type: "number", description: "Max number of messages to return (default 20)" },
            search: { type: "string", description: "Search in subject or from fields" },
          },
        },
      });
    }
    if (ops.includes("get_message")) {
      tools.push({
        name: "email.get_message",
        description: "Get the full content of an email by UID",
        inputSchema: {
          type: "object",
          properties: {
            uid: { type: "number", description: "IMAP UID of the message" },
            folder: { type: "string", description: "Mailbox folder (default: INBOX)" },
          },
          required: ["uid"],
        },
      });
    }
    if (ops.includes("send_message")) {
      tools.push({
        name: "email.send_message",
        description: "Send an email via SMTP",
        inputSchema: {
          type: "object",
          properties: {
            to: {
              oneOf: [
                { type: "string" },
                { type: "array", items: { type: "string" } },
              ],
              description: "Recipient email address(es)",
            },
            subject: { type: "string", description: "Email subject" },
            text: { type: "string", description: "Plain text body" },
            html: { type: "string", description: "HTML body (optional)" },
            cc: {
              oneOf: [
                { type: "string" },
                { type: "array", items: { type: "string" } },
              ],
              description: "CC recipients (optional)",
            },
            reply_to: { type: "string", description: "Reply-To address (optional)" },
          },
          required: ["to", "subject", "text"],
        },
      });
    }
  }

  if (al.services.google_places?.enabled) {
    const ops = al.services.google_places.allowed_operations;
    if (ops.includes("search_places")) {
      tools.push({
        name: "places.search",
        description: "Search for places by text query using Google Places API (via goplaces)",
        inputSchema: {
          type: "object",
          properties: {
            query: { type: "string", description: "Search query (e.g. 'Italian restaurants in Zurich')" },
            lat: { type: "number", description: "Latitude for location bias" },
            lng: { type: "number", description: "Longitude for location bias" },
            radius_meters: { type: "number", description: "Search radius in meters (default 5000)" },
            type: { type: "string", description: "Place type filter (e.g. 'restaurant', 'museum', 'cafe')" },
            open_now: { type: "boolean", description: "Only return places that are currently open" },
            min_rating: { type: "number", description: "Minimum rating (0-5)" },
            limit: { type: "number", description: "Max results (1-20, default 10)" },
            language: { type: "string", description: "Language code (e.g. 'de', 'en')" },
            region: { type: "string", description: "Region code (e.g. 'CH', 'DE')" },
            page_token: { type: "string", description: "Pagination token from a previous search result" },
          },
          required: ["query"],
        },
      });
    }
    if (ops.includes("get_place_details")) {
      tools.push({
        name: "places.get_details",
        description: "Get detailed information about a place by Place ID (hours, phone, website, rating, reviews)",
        inputSchema: {
          type: "object",
          properties: {
            place_id: { type: "string", description: "Google Place ID (from places_search or places_nearby)" },
            language: { type: "string", description: "Language code (e.g. 'de', 'en')" },
            region: { type: "string", description: "Region code (e.g. 'CH', 'DE')" },
            reviews: { type: "boolean", description: "Include user reviews (default false)" },
            photos: { type: "boolean", description: "Include photo references (default false)" },
          },
          required: ["place_id"],
        },
      });
    }
    if (ops.includes("nearby_search")) {
      tools.push({
        name: "places.nearby",
        description: "Search for places near a specific location (lat/lng required)",
        inputSchema: {
          type: "object",
          properties: {
            lat: { type: "number", description: "Latitude of center point" },
            lng: { type: "number", description: "Longitude of center point" },
            radius_meters: { type: "number", description: "Search radius in meters (default 1500)" },
            type: { type: "string", description: "Place type filter (e.g. 'cafe', 'pharmacy')" },
            limit: { type: "number", description: "Max results (1-20, default 10)" },
            language: { type: "string", description: "Language code (e.g. 'de', 'en')" },
          },
          required: ["lat", "lng"],
        },
      });
    }
    if (ops.includes("autocomplete")) {
      tools.push({
        name: "places.autocomplete",
        description: "Autocomplete a partial place name or address query",
        inputSchema: {
          type: "object",
          properties: {
            input: { type: "string", description: "Partial input to autocomplete (e.g. 'Zurich Hbf')" },
            session_token: { type: "string", description: "Session token to group autocomplete + details calls for billing" },
            limit: { type: "number", description: "Max suggestions to return" },
            language: { type: "string", description: "Language code (e.g. 'de', 'en')" },
            region: { type: "string", description: "Region code (e.g. 'CH', 'DE')" },
          },
          required: ["input"],
        },
      });
    }
    if (ops.includes("resolve_location")) {
      tools.push({
        name: "places.resolve",
        description: "Resolve a free-form location string to candidate Place IDs and coordinates",
        inputSchema: {
          type: "object",
          properties: {
            location: { type: "string", description: "Location string to resolve (e.g. 'Bahnhofstrasse, Zurich')" },
            limit: { type: "number", description: "Max candidates to return" },
            language: { type: "string", description: "Language code (e.g. 'de', 'en')" },
            region: { type: "string", description: "Region code (e.g. 'CH', 'DE')" },
          },
          required: ["location"],
        },
      });
    }
  }

  if (al.services.gemini?.enabled) {
    const ops = al.services.gemini.allowed_operations;
    if (ops.includes("generate_image")) {
      tools.push({
        name: "gemini.generate_image",
        description: "Generate an image using Google Imagen 3",
        inputSchema: {
          type: "object",
          properties: {
            prompt: { type: "string", description: "Image generation prompt" },
            aspect_ratio: {
              type: "string",
              enum: ["1:1", "9:16", "16:9", "4:3", "3:4"],
              description: "Image aspect ratio (default: 1:1)",
            },
            number_of_images: {
              type: "number",
              description: "Number of images to generate (1-4, default: 1)",
              minimum: 1,
              maximum: 4,
            },
          },
          required: ["prompt"],
        },
      });
    }
    if (ops.includes("edit_image")) {
      tools.push({
        name: "gemini.edit_image",
        description: "Edit or transform an image using Gemini 2.0 Flash",
        inputSchema: {
          type: "object",
          properties: {
            image_base64: { type: "string", description: "Base64-encoded input image" },
            image_mime_type: {
              type: "string",
              description: "MIME type of the input image (default: image/png)",
              enum: ["image/png", "image/jpeg", "image/webp"],
            },
            prompt: { type: "string", description: "Edit instructions (e.g. 'Make the sky purple')" },
          },
          required: ["image_base64", "prompt"],
        },
      });
    }
  }

  // Upstream MCP tools — schemas come directly from the upstream server,
  // already filtered to the allowlist. No maintenance required here.
  for (const client of upstreams.values()) {
    tools.push(...client.tools);
  }

  return tools;
}

// ── Tool dispatch ─────────────────────────────────────────────────────────────

async function handleToolCall(
  name: string,
  args: Record<string, unknown>,
  al: Allowlist,
): Promise<ToolResult> {
  const err = (msg: string): ToolResult => ({
    content: [{ type: "text", text: `Error: ${msg}` }],
    isError: true,
  });

  log.info(`Tool call: ${name}`);
  try {
    // Google Calendar
    if (name === "calendar.list_events") {
      if (!isOperationAllowed(al, "google_calendar", "list_events")) return err("Operation not allowed");
      if (!calendar) return err("Google Calendar not configured");
      return { content: [{ type: "text", text: await calendar.listEvents(args as Parameters<typeof calendar.listEvents>[0]) }] };
    }
    if (name === "calendar.get_event") {
      if (!isOperationAllowed(al, "google_calendar", "get_event")) return err("Operation not allowed");
      if (!calendar) return err("Google Calendar not configured");
      return { content: [{ type: "text", text: await calendar.getEvent(args as Parameters<typeof calendar.getEvent>[0]) }] };
    }
    if (name === "calendar.create_event") {
      if (!isOperationAllowed(al, "google_calendar", "create_event")) return err("Operation not allowed");
      if (!calendar) return err("Google Calendar not configured");
      return { content: [{ type: "text", text: await calendar.createEvent(args as Parameters<typeof calendar.createEvent>[0]) }] };
    }

    // Email
    if (name === "email.list_messages") {
      if (!isOperationAllowed(al, "email", "list_messages")) return err("Operation not allowed");
      if (!email) return err("Email not configured");
      return { content: [{ type: "text", text: await email.listMessages(args as Parameters<typeof email.listMessages>[0]) }] };
    }
    if (name === "email.get_message") {
      if (!isOperationAllowed(al, "email", "get_message")) return err("Operation not allowed");
      if (!email) return err("Email not configured");
      return { content: [{ type: "text", text: await email.getMessage(args as Parameters<typeof email.getMessage>[0]) }] };
    }
    if (name === "email.send_message") {
      if (!isOperationAllowed(al, "email", "send_message")) return err("Operation not allowed");
      if (!email) return err("Email not configured");
      return { content: [{ type: "text", text: await email.sendMessage(args as Parameters<typeof email.sendMessage>[0]) }] };
    }

    // Places (via goplaces CLI)
    if (name === "places.search") {
      if (!isOperationAllowed(al, "google_places", "search_places")) return err("Operation not allowed");
      if (!places) return err("Google Places not configured");
      return { content: [{ type: "text", text: await places.searchPlaces(args as Parameters<typeof places.searchPlaces>[0]) }] };
    }
    if (name === "places.get_details") {
      if (!isOperationAllowed(al, "google_places", "get_place_details")) return err("Operation not allowed");
      if (!places) return err("Google Places not configured");
      return { content: [{ type: "text", text: await places.getPlaceDetails(args as Parameters<typeof places.getPlaceDetails>[0]) }] };
    }
    if (name === "places.nearby") {
      if (!isOperationAllowed(al, "google_places", "nearby_search")) return err("Operation not allowed");
      if (!places) return err("Google Places not configured");
      return { content: [{ type: "text", text: await places.nearbySearch(args as Parameters<typeof places.nearbySearch>[0]) }] };
    }
    if (name === "places.autocomplete") {
      if (!isOperationAllowed(al, "google_places", "autocomplete")) return err("Operation not allowed");
      if (!places) return err("Google Places not configured");
      return { content: [{ type: "text", text: await places.autocomplete(args as Parameters<typeof places.autocomplete>[0]) }] };
    }
    if (name === "places.resolve") {
      if (!isOperationAllowed(al, "google_places", "resolve_location")) return err("Operation not allowed");
      if (!places) return err("Google Places not configured");
      return { content: [{ type: "text", text: await places.resolveLocation(args as Parameters<typeof places.resolveLocation>[0]) }] };
    }

    // Gemini
    if (name === "gemini.generate_image") {
      if (!isOperationAllowed(al, "gemini", "generate_image")) return err("Operation not allowed");
      if (!gemini) return err("Gemini not configured");
      const result = await gemini.generateImage(args as Parameters<typeof gemini.generateImage>[0]);
      return {
        content: [
          { type: "text", text: result.text },
          ...result.images,
        ],
      };
    }
    if (name === "gemini.edit_image") {
      if (!isOperationAllowed(al, "gemini", "edit_image")) return err("Operation not allowed");
      if (!gemini) return err("Gemini not configured");
      const result = await gemini.editImage(args as Parameters<typeof gemini.editImage>[0]);
      return {
        content: [
          { type: "text", text: result.text },
          ...result.images,
        ],
      };
    }

    // Upstream MCP tools (e.g. Todoist official MCP) — route by tool ownership
    for (const [, client] of upstreams) {
      if (client.owns(name)) {
        return client.callTool(name, args);
      }
    }

    return err(`Unknown tool: ${name}`);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    log.error(`Tool error (${name}):`, message);
    return { content: [{ type: "text", text: `Error calling ${name}: ${message}` }], isError: true };
  }
}

// ── MCP Server factory ────────────────────────────────────────────────────────

function createServer(): Server {
  const server = new Server(
    { name: "crusty-proxy", version },
    { capabilities: { tools: {} } },
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: buildTools(allowlist),
  }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    // Cast through unknown: our ToolResult shape is compatible at runtime but
    // the SDK's union type (which includes a task-based variant) confuses tsc.
    return handleToolCall(name, (args as Record<string, unknown>) ?? {}, allowlist) as unknown as ReturnType<Parameters<typeof server.setRequestHandler>[1]>;
  });

  return server;
}

// ── HTTP/SSE Express app ──────────────────────────────────────────────────────

const app = express();
app.use(express.json());

const transports = new Map<string, SSEServerTransport>();

app.get("/sse", async (req, res) => {
  log.info("New SSE connection from", req.ip);
  const transport = new SSEServerTransport("/messages", res);
  transports.set(transport.sessionId, transport);

  res.on("close", () => {
    log.info("SSE connection closed", transport.sessionId);
    transports.delete(transport.sessionId);
  });

  const server = createServer();
  await server.connect(transport);
});

app.post("/messages", async (req, res) => {
  const sessionId = req.query.sessionId as string;
  const transport = transports.get(sessionId);
  if (!transport) {
    res.status(400).json({ error: "Unknown session ID" });
    return;
  }
  await transport.handlePostMessage(req, res);
});

// ── Streamable HTTP transport (mcporter, modern MCP clients) ──────────────────

app.post("/mcp", async (req, res) => {
  log.info("Streamable HTTP request from", req.ip);
  const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
  const server = createServer();
  await server.connect(transport);
  await transport.handleRequest(req, res, req.body);
});

app.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    version,
    services: {
      google_calendar: calendar !== null && (allowlist.services.google_calendar?.enabled ?? false),
      email: email !== null && (allowlist.services.email?.enabled ?? false),
      todoist: upstreams.has("todoist"),
      google_places: places !== null && (allowlist.services.google_places?.enabled ?? false),
      gemini: gemini !== null && (allowlist.services.gemini?.enabled ?? false),
    },
    upstream_services: [...upstreams.keys()],
    tools: buildTools(allowlist).length,
  });
});

// ── Startup ───────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  // Connect upstream MCP servers before accepting traffic — tool list must
  // be populated before OpenClaw connects and calls ListTools.
  await initUpstreams();

  const PORT = parseInt(process.env.PORT ?? "3000", 10);
  app.listen(PORT, "0.0.0.0", () => {
    const toolCount = buildTools(allowlist).length;
    log.info(`Crusty Proxy v${version} listening on :${PORT} — ${toolCount} tools active`);
    log.info(`SSE endpoint:              http://0.0.0.0:${PORT}/sse`);
    log.info(`Streamable HTTP endpoint: http://0.0.0.0:${PORT}/mcp`);
  });
}

main().catch((err) => {
  log.error("FATAL startup error:", err);
  process.exit(1);
});
