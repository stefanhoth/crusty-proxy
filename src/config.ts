import { readFileSync } from "fs";
import { AllowlistSchema, KeysSchema, type Allowlist, type Keys } from "./types.js";

const KEYS_PATH = process.env.KEYS_PATH ?? "/etc/mcp-proxy/keys.json";
const ALLOWLIST_PATH = process.env.ALLOWLIST_PATH ?? "/etc/mcp-proxy/allowlist.json";

function loadJson(path: string): unknown {
  try {
    return JSON.parse(readFileSync(path, "utf-8"));
  } catch (err) {
    throw new Error(`Failed to load config from ${path}: ${err}`);
  }
}

export function loadKeys(): Keys {
  const raw = loadJson(KEYS_PATH);
  const result = KeysSchema.safeParse(raw);
  if (!result.success) {
    throw new Error(`Invalid keys config: ${result.error.message}`);
  }
  return result.data;
}

export function loadAllowlist(): Allowlist {
  const raw = loadJson(ALLOWLIST_PATH);
  const result = AllowlistSchema.safeParse(raw);
  if (!result.success) {
    throw new Error(`Invalid allowlist config: ${result.error.message}`);
  }
  return result.data;
}

export function isOperationAllowed(
  allowlist: Allowlist,
  service: keyof Allowlist["services"],
  operation: string,
): boolean {
  const serviceConfig = allowlist.services[service];
  if (!serviceConfig?.enabled) return false;
  return serviceConfig.allowed_operations.includes(operation);
}
