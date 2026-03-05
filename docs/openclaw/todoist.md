---
name: todoist
description: Read and manage Todoist tasks via the crusty-proxy MCP server. Backed by the official Todoist hosted MCP — tool schemas are always current.
homepage: https://todoist.com
metadata:
  {
    "openclaw":
      {
        "emoji": "✅",
        "requires": { "mcp": ["crusty-proxy"] },
        "mcpServer": "crusty-proxy",
      },
  }
---

# Todoist

Manage tasks via MCP tools exposed by crusty-proxy. The proxy connects to the official Todoist hosted MCP (`https://ai.todoist.net/mcp`) — tool schemas and descriptions come directly from Todoist and stay current automatically.

Tool names are prefixed with `todoist.` by the proxy (e.g. `todoist.create_task`). The exact parameter schemas may evolve as Todoist updates their MCP — use `mcporter list crusty-proxy` to see the live signatures.

**Constraints:** Allowlist permits: list tasks, get task, create task, complete/close task, list projects. Deleting tasks or projects is not allowed.

## Tools

### `todoist.get_tasks`

List active tasks. Supports Todoist's native filter syntax.

Common filter expressions:
- `"today"` — due today
- `"overdue"` — past due
- `"p1"` — priority 1 (urgent)
- `"7 days"` — due within 7 days
- `"@label_name"` — by label
- `"no due date"` — without deadline

Example:
```json
{ "filter": "today" }
```

---

### `todoist.get_task`

Fetch full details of a single task by ID.

---

### `todoist.create_task`

Create a new task. Supports natural language due dates.

Example:
```json
{
  "content": "Review pull request #42",
  "due_string": "today",
  "priority": 3
}
```

Example with recurring due date:
```json
{
  "content": "Weekly team report",
  "due_string": "every Friday at 9am",
  "labels": ["work"],
  "priority": 2
}
```

Priority scale: `1` normal · `2` medium · `3` high · `4` urgent.

---

### `todoist.close_task`

Mark a task as completed. Removes it from active task lists.

---

### `todoist.get_projects`

List all projects. Use to resolve project names to IDs for filtering or task creation.

## Decision guide

- "What do I have to do today?" → `todoist.get_tasks` with `filter: "today"`
- "What's overdue?" → `todoist.get_tasks` with `filter: "overdue"`
- "Add a task / remind me to..." → `todoist.create_task`
- "Mark X as done" → find with `todoist.get_tasks`, then `todoist.close_task`
- "What projects do I have?" → `todoist.get_projects`
- Delete request → explain not supported via the proxy
- Priority from user language: "urgent/critical" → 4, "high/important" → 3, "medium" → 2, default → 1
