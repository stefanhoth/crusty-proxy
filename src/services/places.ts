import { execFile } from "child_process";
import { promisify } from "util";
import type { GooglePlacesKeysSchema } from "../types.js";
import type { z } from "zod";

type PlacesKeys = z.infer<typeof GooglePlacesKeysSchema>;

const execFileAsync = promisify(execFile);
const BINARY = process.env.GOPLACES_BIN ?? "goplaces";

export class PlacesService {
  private env: NodeJS.ProcessEnv;

  constructor(keys: PlacesKeys) {
    // Pass API key via env var — avoids it appearing in process listings
    this.env = { ...process.env, GOOGLE_PLACES_API_KEY: keys.api_key };
  }

  private async run(args: string[]): Promise<string> {
    const { stdout, stderr } = await execFileAsync(
      BINARY,
      ["--json", "--no-color", ...args],
      { timeout: 15_000, maxBuffer: 5 * 1024 * 1024, env: this.env },
    );
    if (stderr) console.warn("[places] goplaces stderr:", stderr.trim());
    return stdout.trim();
  }

  async searchPlaces(args: {
    query: string;
    lat?: number;
    lng?: number;
    radius_meters?: number;
    type?: string;
    open_now?: boolean;
    min_rating?: number;
    limit?: number;
    language?: string;
    region?: string;
    page_token?: string;
  }): Promise<string> {
    const cmd = ["search", args.query];
    if (args.lat !== undefined) cmd.push("--lat", String(args.lat));
    if (args.lng !== undefined) cmd.push("--lng", String(args.lng));
    if (args.radius_meters !== undefined) cmd.push("--radius-m", String(args.radius_meters));
    if (args.type) cmd.push("--type", args.type);
    if (args.open_now) cmd.push("--open-now");
    if (args.min_rating !== undefined) cmd.push("--min-rating", String(args.min_rating));
    if (args.limit !== undefined) cmd.push("--limit", String(Math.min(args.limit, 20)));
    if (args.language) cmd.push("--language", args.language);
    if (args.region) cmd.push("--region", args.region);
    if (args.page_token) cmd.push("--page-token", args.page_token);
    return this.run(cmd);
  }

  async getPlaceDetails(args: {
    place_id: string;
    language?: string;
    region?: string;
    reviews?: boolean;
    photos?: boolean;
  }): Promise<string> {
    const cmd = ["details", args.place_id];
    if (args.language) cmd.push("--language", args.language);
    if (args.region) cmd.push("--region", args.region);
    if (args.reviews) cmd.push("--reviews");
    if (args.photos) cmd.push("--photos");
    return this.run(cmd);
  }

  async nearbySearch(args: {
    lat: number;
    lng: number;
    radius_meters?: number;
    type?: string;
    limit?: number;
    language?: string;
  }): Promise<string> {
    const cmd = ["nearby", "--lat", String(args.lat), "--lng", String(args.lng)];
    if (args.radius_meters !== undefined) cmd.push("--radius-m", String(args.radius_meters));
    if (args.type) cmd.push("--type", args.type);
    if (args.limit !== undefined) cmd.push("--limit", String(Math.min(args.limit, 20)));
    if (args.language) cmd.push("--language", args.language);
    return this.run(cmd);
  }

  async autocomplete(args: {
    input: string;
    session_token?: string;
    limit?: number;
    language?: string;
    region?: string;
  }): Promise<string> {
    const cmd = ["autocomplete", args.input];
    if (args.session_token) cmd.push("--session-token", args.session_token);
    if (args.limit !== undefined) cmd.push("--limit", String(args.limit));
    if (args.language) cmd.push("--language", args.language);
    if (args.region) cmd.push("--region", args.region);
    return this.run(cmd);
  }

  async resolveLocation(args: {
    location: string;
    limit?: number;
    language?: string;
    region?: string;
  }): Promise<string> {
    const cmd = ["resolve", args.location];
    if (args.limit !== undefined) cmd.push("--limit", String(args.limit));
    if (args.language) cmd.push("--language", args.language);
    if (args.region) cmd.push("--region", args.region);
    return this.run(cmd);
  }
}
