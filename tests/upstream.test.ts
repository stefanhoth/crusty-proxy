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

// ── ping() — tool categorization ─────────────────────────────────────────────
//
// ping() calls listTools() on the live MCP client. We patch the private
// client instance via (client as any) to avoid spawning real processes.

function mockListTools(client: object, tools: string[]): void {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (client as any).client = {
    listTools: async () => ({
      tools: tools.map((name) => ({ name, description: "", inputSchema: { type: "object" } })),
    }),
  };
}

describe("HttpUpstreamClient.ping() — tool categorization", () => {
  // Allowlist: a, b, c  |  Upstream: a, b, d
  // active: a, b  |  blocked: d  |  unknown: c
  it("correctly categorises active, blocked, and unknown tools", async () => {
    const client = makeHttpClient(["a", "b", "c"]);
    mockListTools(client, ["a", "b", "d"]);

    const result = await client.ping();

    expect(result.reachable).toBe(true);
    expect(result.tools_active).toEqual(["a", "b"]);
    expect(result.tools_blocked).toEqual(["d"]);
    expect(result.tools_unknown).toEqual(["c"]);
  });

  it("returns all active when allowlist matches upstream exactly", async () => {
    const client = makeHttpClient(["x", "y"]);
    mockListTools(client, ["x", "y"]);

    const result = await client.ping();

    expect(result.reachable).toBe(true);
    expect(result.tools_active).toEqual(["x", "y"]);
    expect(result.tools_blocked).toEqual([]);
    expect(result.tools_unknown).toEqual([]);
  });

  it("returns all unknown when no allowlist tool exists in upstream", async () => {
    const client = makeHttpClient(["old-tool"]);
    mockListTools(client, ["new-tool"]);

    const result = await client.ping();

    expect(result.reachable).toBe(true);
    expect(result.tools_active).toEqual([]);
    expect(result.tools_blocked).toEqual(["new-tool"]);
    expect(result.tools_unknown).toEqual(["old-tool"]);
  });

  it("returns reachable:false and empty lists when listTools throws", async () => {
    const client = makeHttpClient(["a"]);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (client as any).client = {
      listTools: async () => { throw new Error("connection refused"); },
    };

    const result = await client.ping();

    expect(result.reachable).toBe(false);
    expect(result.tools_active).toEqual([]);
    expect(result.tools_blocked).toEqual([]);
    expect(result.tools_unknown).toEqual([]);
  });
});

describe("StdioUpstreamClient.ping() — tool categorization", () => {
  it("correctly categorises active, blocked, and unknown tools", async () => {
    const client = makeStdioClient(["calendar_events_list", "calendar_events_insert"]);
    mockListTools(client, ["calendar_events_list", "calendar_events_get"]);

    const result = await client.ping();

    expect(result.reachable).toBe(true);
    expect(result.tools_active).toEqual(["calendar_events_list"]);
    expect(result.tools_blocked).toEqual(["calendar_events_get"]);
    expect(result.tools_unknown).toEqual(["calendar_events_insert"]);
  });
});
