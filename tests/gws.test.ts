import { describe, it, expect } from "bun:test";
import { isGwsAuthHealthy } from "../src/services/gws.js";
import type { GwsAuthStatus } from "../src/services/gws.js";

describe("isGwsAuthHealthy", () => {
  it("returns true when token is valid and all fields positive", () => {
    const status: GwsAuthStatus = {
      token_valid: true,
      token_cache_exists: true,
      plain_credentials_exists: true,
      user: "test@example.com",
      scope_count: 8,
    };
    expect(isGwsAuthHealthy(status)).toBe(true);
  });

  it("returns true when token is valid and optional fields absent (healthy baseline)", () => {
    // token_cache_exists and credentials_readable absent = healthy
    const status: GwsAuthStatus = { token_valid: true };
    expect(isGwsAuthHealthy(status)).toBe(true);
  });

  it("returns false when token_valid is absent (expired token, no cache)", () => {
    // gws auth status omits token_valid entirely when auth is broken
    const status: GwsAuthStatus = {
      token_cache_exists: false,
      plain_credentials_exists: true,
    };
    expect(isGwsAuthHealthy(status)).toBe(false);
  });

  it("returns false when token_valid is false", () => {
    const status: GwsAuthStatus = { token_valid: false };
    expect(isGwsAuthHealthy(status)).toBe(false);
  });

  it("returns false when token_cache_exists is false", () => {
    const status: GwsAuthStatus = {
      token_valid: true,
      token_cache_exists: false,
    };
    expect(isGwsAuthHealthy(status)).toBe(false);
  });

  it("returns false when credentials_readable is false", () => {
    const status: GwsAuthStatus = {
      token_valid: true,
      credentials_readable: false,
    };
    expect(isGwsAuthHealthy(status)).toBe(false);
  });

  it("returns false when both token_cache_exists and credentials_readable are false", () => {
    const status: GwsAuthStatus = {
      token_cache_exists: false,
      credentials_readable: false,
      plain_credentials_exists: true,
    };
    expect(isGwsAuthHealthy(status)).toBe(false);
  });
});
