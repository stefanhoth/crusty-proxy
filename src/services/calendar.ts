import { createDAVClient } from "tsdav";
import { randomUUID } from "node:crypto";
import type { CalDavKeys } from "../types.js";

// ── Minimal ICS helpers ──────────────────────────────────────────────────────

/** Unfold RFC 5545 line folding (CRLF + whitespace → join). */
function unfoldLines(ics: string): string[] {
  return ics
    .replace(/\r\n/g, "\n")
    .replace(/\n[ \t]/g, "")
    .split("\n");
}

/** Extract the first VEVENT block from an iCalendar string. */
function extractVEvent(ics: string): string | null {
  const start = ics.indexOf("BEGIN:VEVENT");
  const end = ics.indexOf("END:VEVENT");
  if (start === -1 || end === -1) return null;
  return ics.substring(start, end + "END:VEVENT".length);
}

/** Parse VEVENT property lines into a Map. Strips parameter segments (;TZID=...) from keys. */
function parseProps(block: string): Map<string, string> {
  const props = new Map<string, string>();
  for (const line of unfoldLines(block)) {
    const colonIdx = line.indexOf(":");
    if (colonIdx === -1) continue;
    const key = line.substring(0, colonIdx).split(";")[0].toUpperCase();
    const value = line.substring(colonIdx + 1);
    if (key) props.set(key, value);
  }
  return props;
}

/** Convert a compact ICS date/datetime to ISO 8601. */
function formatICSDate(dt: string): string {
  if (dt.length === 8) {
    // DATE: 20250101 → 2025-01-01
    return `${dt.slice(0, 4)}-${dt.slice(4, 6)}-${dt.slice(6, 8)}`;
  }
  // DATETIME: 20250101T120000Z or 20250101T120000
  const utc = dt.endsWith("Z") ? "Z" : "";
  const d = dt.replace("Z", "");
  if (d.length < 15) return dt;
  return `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}T${d.slice(9, 11)}:${d.slice(11, 13)}:${d.slice(13, 15)}${utc}`;
}

interface ParsedEvent {
  id: string;
  summary: string;
  start: string | undefined;
  end: string | undefined;
  location?: string;
  description?: string;
  status?: string;
  url?: string;
}

function parseVEventObject(ics: string | undefined, objectUrl?: string): ParsedEvent | null {
  if (!ics) return null;
  const vevent = extractVEvent(ics);
  if (!vevent) return null;
  const props = parseProps(vevent);

  const dtstart = props.get("DTSTART");
  const dtend = props.get("DTEND");
  const result: ParsedEvent = {
    id: props.get("UID") ?? "",
    summary: props.get("SUMMARY") ?? "(no title)",
    start: dtstart ? formatICSDate(dtstart) : undefined,
    end: dtend ? formatICSDate(dtend) : undefined,
    url: objectUrl,
  };
  const location = props.get("LOCATION");
  const description = props.get("DESCRIPTION");
  const status = props.get("STATUS");
  if (location) result.location = location;
  if (description) result.description = description.replace(/\\n/g, "\n").replace(/\\,/g, ",");
  if (status) result.status = status;
  return result;
}

/** Format a JS date/datetime string to ICS DATETIME (UTC). */
function toICSDateTime(dateStr: string): string {
  return new Date(dateStr).toISOString().replace(/[-:.]/g, "").replace(/\d{3}Z$/, "Z");
}

function buildICS(args: {
  uid: string;
  summary: string;
  start: string;
  end: string;
  description?: string;
  location?: string;
  attendees?: string[];
}): string {
  const dtstamp = toICSDateTime(new Date().toISOString());
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//crusty-proxy//CalDAV//EN",
    "CALSCALE:GREGORIAN",
    "BEGIN:VEVENT",
    `UID:${args.uid}`,
    `DTSTAMP:${dtstamp}`,
    `DTSTART:${toICSDateTime(args.start)}`,
    `DTEND:${toICSDateTime(args.end)}`,
    `SUMMARY:${args.summary}`,
  ];
  if (args.description) lines.push(`DESCRIPTION:${args.description.replace(/\n/g, "\\n")}`);
  if (args.location) lines.push(`LOCATION:${args.location}`);
  for (const email of args.attendees ?? []) {
    lines.push(`ATTENDEE;CUTYPE=INDIVIDUAL;ROLE=REQ-PARTICIPANT:mailto:${email}`);
  }
  lines.push("END:VEVENT", "END:VCALENDAR");
  return lines.join("\r\n") + "\r\n";
}

// ── CalendarService ───────────────────────────────────────────────────────────

type DAVClientInstance = Awaited<ReturnType<typeof createDAVClient>>;

export class CalendarService {
  private keys: CalDavKeys;
  private _client: DAVClientInstance | null = null;
  private _calendarUrl: string | null = null;

  constructor(keys: CalDavKeys) {
    this.keys = keys;
  }

  private async getClient(): Promise<DAVClientInstance> {
    if (!this._client) {
      this._client = await createDAVClient({
        serverUrl: this.keys.caldav_url,
        credentials: {
          username: this.keys.username,
          password: this.keys.password,
        },
        authMethod: "Basic",
        defaultAccountType: "caldav",
      });
    }
    return this._client;
  }

  private async getCalendarUrl(): Promise<string> {
    if (this._calendarUrl) return this._calendarUrl;
    if (this.keys.calendar_url) {
      this._calendarUrl = this.keys.calendar_url;
      return this._calendarUrl;
    }
    const client = await this.getClient();
    const calendars = await client.fetchCalendars();
    if (calendars.length === 0) throw new Error("No calendars found on CalDAV server");
    this._calendarUrl = calendars[0].url;
    return this._calendarUrl;
  }

  async listEvents(args: {
    start_date: string;
    end_date: string;
    max_results?: number;
    query?: string;
  }): Promise<string> {
    const client = await this.getClient();
    const calUrl = await this.getCalendarUrl();

    const objects = await client.fetchCalendarObjects({
      calendar: { url: calUrl },
      timeRange: {
        start: new Date(args.start_date).toISOString(),
        end: new Date(args.end_date).toISOString(),
      },
    });

    let events = objects
      .map((obj) => parseVEventObject(obj.data, obj.url))
      .filter((e): e is ParsedEvent => e !== null);

    if (args.query) {
      const q = args.query.toLowerCase();
      events = events.filter(
        (e) =>
          e.summary.toLowerCase().includes(q) ||
          e.description?.toLowerCase().includes(q) ||
          e.location?.toLowerCase().includes(q),
      );
    }

    if (args.max_results) events = events.slice(0, args.max_results);
    if (events.length === 0) return "No events found in the specified range.";
    return JSON.stringify(events, null, 2);
  }

  async getEvent(args: { event_id: string }): Promise<string> {
    const client = await this.getClient();
    const calUrl = await this.getCalendarUrl();

    // Fetch all objects and find by UID
    const objects = await client.fetchCalendarObjects({ calendar: { url: calUrl } });
    const match = objects.find((obj) => {
      if (!obj.data) return false;
      const vevent = extractVEvent(obj.data);
      if (!vevent) return false;
      return parseProps(vevent).get("UID") === args.event_id;
    });

    if (!match) throw new Error(`Event not found: ${args.event_id}`);
    const event = parseVEventObject(match.data, match.url);
    if (!event) throw new Error(`Failed to parse event: ${args.event_id}`);
    return JSON.stringify(event, null, 2);
  }

  async createEvent(args: {
    summary: string;
    start: string;
    end: string;
    description?: string;
    location?: string;
    attendees?: string[];
  }): Promise<string> {
    const client = await this.getClient();
    const calUrl = await this.getCalendarUrl();

    const uid = randomUUID();
    const ics = buildICS({ uid, ...args });

    await client.createCalendarObject({
      calendar: { url: calUrl },
      filename: `${uid}.ics`,
      iCalString: ics,
    });

    return JSON.stringify(
      { id: uid, summary: args.summary, start: args.start, end: args.end },
      null,
      2,
    );
  }
}
