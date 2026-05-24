// Seed a scratch database with a small, varied sample dataset so feature
// views have something to show. Mirrors the old Rust create_sample_db.

import { kvPut } from "./kv";
import type { Handle } from "./strata";

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
    Array: [
      { String: "https://app.strata.dev" },
      { String: "https://localhost:3000" },
    ],
  });
  await kvPut(handle, "counter:page_views", { Int: 48291 });
  await kvPut(handle, "cache:exchange_rates", {
    Object: { USD_EUR: { Float: 0.92 }, USD_GBP: { Float: 0.79 } },
  });
}
