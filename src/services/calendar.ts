import { google } from "googleapis";
import type { GoogleCalendarKeysSchema } from "../types.js";
import type { z } from "zod";

type CalendarKeys = z.infer<typeof GoogleCalendarKeysSchema>;

export class CalendarService {
  private calendar;
  private calendarId: string;

  constructor(keys: CalendarKeys) {
    const auth = new google.auth.OAuth2(keys.client_id, keys.client_secret);
    auth.setCredentials({ refresh_token: keys.refresh_token });
    this.calendar = google.calendar({ version: "v3", auth });
    this.calendarId = keys.calendar_id;
  }

  async listEvents(args: {
    start_date: string;
    end_date: string;
    max_results?: number;
    query?: string;
  }): Promise<string> {
    const res = await this.calendar.events.list({
      calendarId: this.calendarId,
      timeMin: new Date(args.start_date).toISOString(),
      timeMax: new Date(args.end_date).toISOString(),
      maxResults: args.max_results ?? 50,
      singleEvents: true,
      orderBy: "startTime",
      q: args.query,
    });
    const events = res.data.items ?? [];
    if (events.length === 0) return "No events found in the specified range.";
    return JSON.stringify(
      events.map((e) => ({
        id: e.id,
        summary: e.summary,
        start: e.start?.dateTime ?? e.start?.date,
        end: e.end?.dateTime ?? e.end?.date,
        location: e.location,
        description: e.description,
        status: e.status,
      })),
      null,
      2,
    );
  }

  async getEvent(args: { event_id: string }): Promise<string> {
    const res = await this.calendar.events.get({
      calendarId: this.calendarId,
      eventId: args.event_id,
    });
    const e = res.data;
    return JSON.stringify(
      {
        id: e.id,
        summary: e.summary,
        start: e.start?.dateTime ?? e.start?.date,
        end: e.end?.dateTime ?? e.end?.date,
        location: e.location,
        description: e.description,
        attendees: e.attendees?.map((a) => ({ email: a.email, status: a.responseStatus })),
        status: e.status,
        htmlLink: e.htmlLink,
      },
      null,
      2,
    );
  }

  async createEvent(args: {
    summary: string;
    start: string;
    end: string;
    description?: string;
    location?: string;
    attendees?: string[];
  }): Promise<string> {
    const res = await this.calendar.events.insert({
      calendarId: this.calendarId,
      requestBody: {
        summary: args.summary,
        description: args.description,
        location: args.location,
        start: {
          dateTime: new Date(args.start).toISOString(),
          timeZone: "UTC",
        },
        end: {
          dateTime: new Date(args.end).toISOString(),
          timeZone: "UTC",
        },
        attendees: args.attendees?.map((email) => ({ email })),
      },
    });
    return JSON.stringify(
      {
        id: res.data.id,
        htmlLink: res.data.htmlLink,
        summary: res.data.summary,
        start: res.data.start?.dateTime,
        end: res.data.end?.dateTime,
      },
      null,
      2,
    );
  }
}
