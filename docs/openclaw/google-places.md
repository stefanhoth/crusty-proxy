---
name: google-places
description: Search and explore places via the crusty-proxy MCP server (powered by goplaces + Google Places API New). Use for finding restaurants, shops, POIs, getting details, autocomplete, and resolving locations.
homepage: https://github.com/steipete/goplaces
metadata:
  {
    "openclaw":
      {
        "emoji": "📍",
        "requires": { "bins": ["mcporter"] },
        "mcpServer": "crusty-proxy",
      },
  }
---

# Google Places

Search and explore places via MCP tools exposed by crusty-proxy. Backed by the goplaces CLI and Google Places API (New).

**Constraints:** Read-only — no writes to Google Maps data.

## Tools

### `places.search`

Text search for places. Best for "find X near Y" queries.

Parameters:
- `query` (required) — natural language search, e.g. `"Italian restaurants in Zurich"`, `"coffee near Hauptbahnhof"`
- `lat`, `lng` — coordinates to bias results toward
- `radius_meters` — bias radius in meters (default 5000, used with lat/lng)
- `type` — place type filter, e.g. `"restaurant"`, `"cafe"`, `"museum"`, `"pharmacy"` (only one type accepted)
- `open_now` — boolean, only return currently open places
- `min_rating` — minimum rating 0.0–5.0
- `limit` — max results 1–20, default 10
- `language` — language code, e.g. `"de"`, `"en"`
- `region` — region code, e.g. `"CH"`, `"DE"`, `"AT"`
- `page_token` — pagination token from a previous result for next page

Returns: JSON array of places with `id` (use as `place_id` for details), `displayName`, `formattedAddress`, `location`, `rating`, `priceLevel`, `primaryType`.

Example — open cafes near a coordinate:
```json
{
  "query": "cafe",
  "lat": 47.3769,
  "lng": 8.5417,
  "radius_meters": 500,
  "open_now": true,
  "min_rating": 4.0,
  "language": "de"
}
```

---

### `places.get_details`

Fetch full details of a place by its Place ID.

Parameters:
- `place_id` (required) — Google Place ID from `places.search` or `places.nearby`
- `language` — language code
- `region` — region code
- `reviews` — boolean, include user reviews (default false)
- `photos` — boolean, include photo references (default false)

Returns: Full place JSON including `regularOpeningHours`, `internationalPhoneNumber`, `websiteUri`, `rating`, `editorialSummary`, optionally `reviews[]`.

Example:
```json
{ "place_id": "ChIJN1t_tDeuEmsRUsoyG83frY4", "language": "de", "reviews": true }
```

---

### `places.nearby`

Search for places near an exact coordinate. Better than `places.search` when you have a precise location and want proximity-ranked results.

Parameters:
- `lat` (required) — latitude
- `lng` (required) — longitude
- `radius_meters` — search radius in meters, default 1500
- `type` — place type filter
- `limit` — max results 1–20
- `language` — language code

Returns: Same format as `places.search`.

Example — pharmacies within 300m:
```json
{ "lat": 47.3769, "lng": 8.5417, "radius_meters": 300, "type": "pharmacy" }
```

---

### `places.autocomplete`

Autocomplete a partial place name or address. Use to resolve what the user is typing before fetching details.

Parameters:
- `input` (required) — partial input string, e.g. `"Zurich Hbf"`, `"Bahnhofstr"`
- `session_token` — string token to group autocomplete + details calls for API billing efficiency (use a consistent string per user session)
- `limit` — max suggestions
- `language` — language code
- `region` — region code

Returns: JSON array of suggestions with `placeId`, `description`, `types[]`.

Example:
```json
{ "input": "Limmatt", "language": "de", "region": "CH", "session_token": "session-1" }
```

---

### `places.resolve`

Resolve a free-form location string to candidate Place IDs and coordinates. Useful when a user mentions a place by name without coordinates.

Parameters:
- `location` (required) — location string, e.g. `"Bahnhofstrasse, Zurich"`, `"Prater Wien"`
- `limit` — max candidates
- `language` — language code
- `region` — region code

Returns: JSON array of candidates with `placeId`, `displayName`, `formattedAddress`, `location`.

Example:
```json
{ "location": "Grossmünster Zürich", "language": "de", "region": "CH" }
```

## Decision guide

- User asks "find me X near Y" → `places.search` with query + location bias
- User is at a specific coordinate → `places.nearby`
- User wants details, hours, phone for a specific place → `places.get_details`
- User mentions a place name ambiguously → `places.resolve` to get the Place ID, then `places.get_details`
- User is typing a partial address → `places.autocomplete`
- Typical flow: `places.search` → pick a result → `places.get_details` for hours/contact

## Place type examples

`restaurant`, `cafe`, `bar`, `bakery`, `supermarket`, `pharmacy`, `hospital`, `museum`, `park`, `hotel`, `atm`, `gas_station`, `parking`, `gym`, `spa`, `library`, `school`, `church`, `subway_station`, `train_station`
