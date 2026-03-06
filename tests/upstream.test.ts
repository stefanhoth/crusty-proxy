import { describe, it, expect } from "bun:test";
import { HttpUpstreamClient } from "../src/upstream/http.js";
import { StdioUpstreamClient } from "../src/upstream/stdio.js";

// owns() and callTool() allowlist enforcement can be tested without connecting
// to a real upstream — the constructor is pure and callTool() short-circuits
// before touching the network/process for blocked tools.

const makeHttpClient = (allowedOps: string[]) =>
  new HttpUpstreamClient(
    { url: "http://localhost:9999/mcp", bearerToken: "test", name: "todoist" },
    allowedOps,
  );

const makeStdioClient = (allowedOps: string[]) =>
  new StdioUpstreamClient(
    { command: "gws", args: ["mcp", "-s", "calendar"], name: "gws" },
    allowedOps,
  );

describe("HttpUpstreamClient.owns()", () => {
  const client = makeHttpClient(["get_tasks", "create_task"]);

  it("owns a prefixed tool that is in the allowlist", () => {
    expect(client.owns("todoist.get_tasks")).toBe(true);
    expect(client.owns("todoist.create_task")).toBe(true);
  });

  it("does not own a prefixed tool not in the allowlist", () => {
    expect(client.owns("todoist.delete_task")).toBe(false);
  });

  it("does not own a tool from a different service", () => {
    expect(client.owns("calendar.list_events")).toBe(false);
    expect(client.owns("email.send_message")).toBe(false);
  });

  it("does not own an unprefixed tool name", () => {
    expect(client.owns("get_tasks")).toBe(false);
  });
});

describe("HttpUpstreamClient.callTool() — allowlist enforcement", () => {
  it("returns an error result for a blocked tool without hitting the network", async () => {
    const client = makeHttpClient(["get_tasks"]);
    // delete_task is not in the allowlist — should be blocked before any network call
    const result = await client.callTool("todoist.delete_task", {});
    expect(result.isError).toBe(true);
    expect(result.content[0].type).toBe("text");
    expect((result.content[0] as { type: "text"; text: string }).text).toContain("allowlist");
  });
});

describe("StdioUpstreamClient.owns()", () => {
  const client = makeStdioClient(["calendar_list_events", "calendar_create_event"]);

  it("owns a prefixed tool that is in the allowlist", () => {
    expect(client.owns("gws.calendar_list_events")).toBe(true);
  });

  it("does not own a prefixed tool not in the allowlist", () => {
    expect(client.owns("gws.calendar_delete_event")).toBe(false);
  });

  it("does not own a tool from a different service", () => {
    expect(client.owns("todoist.get_tasks")).toBe(false);
  });
});

describe("StdioUpstreamClient.callTool() — allowlist enforcement", () => {
  it("returns an error result for a blocked tool without spawning a process", async () => {
    const client = makeStdioClient(["calendar_list_events"]);
    const result = await client.callTool("gws.calendar_delete_event", {});
    expect(result.isError).toBe(true);
    expect((result.content[0] as { type: "text"; text: string }).text).toContain("allowlist");
  });
});
