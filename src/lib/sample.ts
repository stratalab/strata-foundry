// Seed databases with sample data so feature views have something to show.

import { kvPut } from "./kv";
import { branchFork } from "./branch";
import { spaceCreate } from "./space";
import { eventAppend } from "./event";
import { jsonSet } from "./json";
import { vectorCreateCollection, vectorUpsert } from "./vector";
import { graphCreate, graphAddNode, graphAddEdge } from "./graph";
import type { Handle } from "./strata";

/** Seed KV, events, JSON, and a second space on the default branch. */
export async function seedSample(handle: Handle): Promise<void> {
  // KV — default space
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

  // A second space to show grouping
  await spaceCreate(handle, "analytics");
  await kvPut(handle, "metric:dau", { Int: 4821 }, undefined, "analytics");
  await kvPut(handle, "metric:signups", { Int: 137 }, undefined, "analytics");
  await kvPut(handle, "metric:churn_rate", { Float: 0.021 }, undefined, "analytics");

  // Events — append-only log
  await eventAppend(handle, "user.created", { Object: { user: { String: "alice" } } });
  await eventAppend(handle, "user.login", {
    Object: { user: { String: "alice" }, method: { String: "api_key" } },
  });
  await eventAppend(handle, "tool.call", {
    Object: { tool: { String: "web_search" }, duration_ms: { Int: 342 }, results: { Int: 15 } },
  });
  await eventAppend(handle, "user.login", {
    Object: { user: { String: "bob" }, method: { String: "oauth" } },
  });

  // JSON documents
  await jsonSet(handle, "doc:readme", {
    Object: {
      title: { String: "Getting Started" },
      tags: { Array: [{ String: "docs" }, { String: "intro" }] },
      published: { Bool: true },
    },
  });
  await jsonSet(handle, "doc:agent-config", {
    Object: {
      model: { String: "claude-sonnet-4-6" },
      temperature: { Float: 0.7 },
      max_steps: { Int: 100 },
    },
  });

  // A small vector collection (4-dim) so nearest-neighbour search is demoable.
  await vectorCreateCollection(handle, "embeddings", 4, "cosine");
  await vectorUpsert(handle, "embeddings", "doc:alpha", [1, 0, 0, 0], { Object: { title: { String: "Alpha" } } });
  await vectorUpsert(handle, "embeddings", "doc:beta", [0, 1, 0, 0], { Object: { title: { String: "Beta" } } });
  await vectorUpsert(handle, "embeddings", "doc:gamma", [0.9, 0.1, 0, 0], { Object: { title: { String: "Gamma" } } });
  await vectorUpsert(handle, "embeddings", "doc:delta", [0, 0, 1, 0], { Object: { title: { String: "Delta" } } });

  // A small graph (people + a company) so the graph canvas isn't empty.
  await graphCreate(handle, "org");
  await graphAddNode(handle, "org", "alice", "Person", { Object: { name: { String: "Alice Chen" } } });
  await graphAddNode(handle, "org", "bob", "Person", { Object: { name: { String: "Bob Martinez" } } });
  await graphAddNode(handle, "org", "carol", "Person", { Object: { name: { String: "Carol Kim" } } });
  await graphAddNode(handle, "org", "acme", "Company", { Object: { name: { String: "Acme Inc" } } });
  await graphAddEdge(handle, "org", "alice", "acme", "WORKS_AT");
  await graphAddEdge(handle, "org", "bob", "acme", "WORKS_AT");
  await graphAddEdge(handle, "org", "alice", "bob", "MANAGES");
  await graphAddEdge(handle, "org", "bob", "carol", "MANAGES");
  await graphAddEdge(handle, "org", "carol", "alice", "FOLLOWS");
}

/**
 * Seed a disk database with sample data plus a diverged "feature" branch, so
 * fork/diff/merge/cherry-pick have something meaningful to show immediately.
 */
export async function seedDiskSample(handle: Handle): Promise<void> {
  await seedSample(handle);
  await branchFork(handle, "default", "feature");
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
