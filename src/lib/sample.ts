// Seed databases with sample data so feature views have something to show.

import { kvPut } from "./kv";
import { branchFork } from "./branch";
import type { Handle } from "./strata";

/** Seed KV sample data on the default branch (works on scratch + disk). */
export async function seedSample(handle: Handle): Promise<void> {
  await kvPut(handle, "user:alice", {
    Object: {
      name: { String: "Alice Chen" },
      age: { Int: 30 },
      role: { String: "admin" },
      active: { Bool: true },
    },
  });
  await kvPut(handle, "user:bob", {
    Object: {
      name: { String: "Bob Martinez" },
      age: { Int: 25 },
      role: { String: "developer" },
      active: { Bool: true },
    },
  });
  await kvPut(handle, "config:app_version", { String: "2.1.0" });
  await kvPut(handle, "config:max_retries", { Int: 3 });
  await kvPut(handle, "config:debug_mode", { Bool: false });
  await kvPut(handle, "config:allowed_origins", {
    Array: [{ String: "https://app.strata.dev" }, { String: "https://localhost:3000" }],
  });
  await kvPut(handle, "counter:page_views", { Int: 48291 });
  await kvPut(handle, "cache:exchange_rates", {
    Object: { USD_EUR: { Float: 0.92 }, USD_GBP: { Float: 0.79 } },
  });
}

/**
 * Seed a disk database with KV data plus a diverged "feature" branch, so
 * fork/diff/merge/cherry-pick have something meaningful to show immediately.
 */
export async function seedDiskSample(handle: Handle): Promise<void> {
  await seedSample(handle);
  await branchFork(handle, "default", "feature");
  // Diverge the feature branch: modify, add, and change a config value.
  await kvPut(
    handle,
    "user:alice",
    {
      Object: {
        name: { String: "Alice Chen (edited)" },
        age: { Int: 31 },
        role: { String: "admin" },
        active: { Bool: true },
      },
    },
    "feature",
  );
  await kvPut(
    handle,
    "user:carol",
    {
      Object: {
        name: { String: "Carol Kim" },
        age: { Int: 35 },
        role: { String: "designer" },
        active: { Bool: false },
      },
    },
    "feature",
  );
  await kvPut(handle, "config:debug_mode", { Bool: true }, "feature");
}
