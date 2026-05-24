# Strata Executor — Consumer-Side Improvements

**Status:** Proposal / feedback
**Date:** 2026-05-24
**Author:** Strata Foundry team
**Audience:** `strata-core` executor maintainers

## Context

Strata Foundry is a Tauri + React desktop app that consumes `strata-core`'s
**executor** layer. It does so the same way any non-Rust consumer would: a thin
bridge serializes an externally-tagged `Command` to JSON, calls
`Executor::execute`, and deserializes the `Output` (or `Error`) JSON. Over the
course of building feature views for **every** primitive — KV, JSON, Events,
Vectors, Graph, Branches, Spaces, time-travel, and Arrow import/export — we
exercised most of the command surface and accumulated a concrete list of places
where the executor's shape made consumption harder than it needed to be.

This document captures those findings, ranked by leverage (not by effort), each
tied to a specific moment where it cost us real work. Everything here generalizes
beyond Foundry: the same friction applies to the SDKs, the MCP server, and any
future "assistant"/agent tool layer.

> Method note: because there is no consumable description of the request/response
> shapes, we reverse-engineered each one by grepping `command.rs` and then writing
> empirical "wire-shape" tests against a live database (see
> `strata-foundry/crates/strata-bridge/src/lib.rs`, the `*_wire_shapes` tests).
> Those tests are currently our **de-facto schema** — which is itself the
> strongest argument for finding #1 below.

---

## TL;DR

1. **Ship a machine-readable schema of `Command`/`Output`/`Error`** (e.g. derive
   `schemars::JsonSchema`). Highest leverage by far — every consumer can then
   generate types instead of guessing.
2. **Make serde conventions consistent** — uniform enum casing, uniform
   pagination, consolidated write/delete result types.
3. **Close the N+1 / data-completeness gaps** — `EventList` should carry the
   event type; graph needs a one-call snapshot (nodes+edges); vector query should
   optionally include metadata.
4. **Expose capabilities in `Info`** — storage kind, enabled features,
   `supports_branching` — so UIs adapt instead of failing at runtime.
5. **Add a generic `execute_many`** to batch arbitrary commands in one round-trip.

**If only two get funded: #1 and #3.** #1 makes every future consumer cheap; #3
is the concrete stuff that forced workaround code.

---

## Findings

### 1. No machine-readable schema for the command surface (highest leverage)

**Problem.** There is no consumable description of what a command takes or what
output it returns. The `/// Returns: Output::X` doc comments in `command.rs` are
helpful and were largely accurate, but they are prose, not a contract — a
consumer cannot compile against them. (`Describe` exists, but it returns a
snapshot of the *data* — `DescribeResult` — i.e. database introspection, not an
API/type description.) As a result, our workflow for **every** primitive was:
grep `command.rs` for the variant, then write a throwaway test that executes the
command against a live DB and prints the JSON, then hand-write matching
TypeScript types.

This is also where the only outright **bug** in our integration came from: the
docs/older architecture notes said `KvPut` returns `Output::Version`, but it
actually returns `WriteResult`. Prose drifts; a generated schema cannot.

**Proposal.** Derive `schemars::JsonSchema` (or equivalent) on `Command`,
`Output`, and `Error`, and expose the generated JSON Schema — either at build
time (checked-in artifact) or via a `Schema`/`DescribeApi` command. With that,
consumers **generate** their types and validators:

- Foundry's `src/lib/*.ts` types (today: hand-written + verified by tests)
- the language SDKs' types
- the MCP server's tool definitions
- a future assistant's tool catalog (the Anthropic tool schema is ~the same JSON
  Schema)

**Impact:** eliminates ~half of the per-primitive integration effort, permanently,
for all consumers. **Effort:** moderate (mostly derive macros + a serialization
endpoint).

### 2. Inconsistent serde conventions

Consumers can't predict shapes, so they must memorize per-command quirks.

**Enum casing is mixed.** Concrete examples we hit:

| Enum | File | On the wire |
|------|------|-------------|
| `DistanceMetric` | `types.rs:115` | snake_case — `"cosine"`, `"dot_product"` |
| `ExportFormat` / `ExportPrimitive` | `types.rs:974` | snake_case — `"jsonl"`, `"kv"` |
| `MergeStrategy` | `branch_ops/mod.rs` | PascalCase — `"LastWriterWins"` |
| `BranchStatus` | (in `BranchInfo`) | lowercase — `"active"` |

We lost a debug cycle on exactly this: sending `"Cosine"` to
`VectorCreateCollection` failed with "unknown variant `Cosine`, expected
`cosine`…". Pick one convention (snake_case is the most common here) and apply it
everywhere via `#[serde(rename_all = ...)]`.

**Near-duplicate result types.** "A write happened, here's the new version" is
spelled at least four different ways: `WriteResult{key,version}` (KV/JSON),
`GraphWriteResult{node_id,created}`, `GraphEdgeWriteResult{src,dst,edge_type,created}`,
`VectorWriteResult{collection,key,version}`. Deletes likewise: `DeleteResult{key,deleted}`
vs `VectorDeleteResult`. And "create" returns are inconsistent: `GraphCreate` and
`SpaceCreate` return the bare string `"Unit"`, while `VectorCreateCollection`
returns `Version`. Consumers end up with N branches that all mean the same thing.
Standardize field names (`key`/`version`) and consolidate where possible.

**Pagination differs per primitive.** `JsonList` requires a `limit`; `KvList`'s
is optional; `GraphListNodesPaginated` is a *separate command* rather than a flag
on `GraphListNodes`; `EventList` has its own `limit`/`as_of` shape. A uniform
`{ prefix?, cursor?, limit? }` convention with a sane default limit everywhere
would let consumers write one generic list-handler.

### 3. N+1 and data-completeness gaps

These forced actual workaround code in Foundry.

- **`EventList` omits the event type.** Rows are `{ value (=payload), version
  (=sequence), timestamp }` — no `event_type`. To render a typed event timeline
  we had to call `EventListTypes`, then `EventGetByType` per type, and merge by
  sequence. The executor already knows the type at write time; just include it on
  each row.
- **Graph rendering is forced into N+1 (twice).** `GraphListNodes` returns only
  IDs (`Keys`), so node type/properties require `GraphGetNode` × N. And there is
  **no list-edges command at all** — the only way to enumerate edges is
  `GraphNeighbors(outgoing)` × N. Drawing a 4-node graph is `list + 4×get +
  4×neighbors` = 9 calls. A single `GraphSnapshot` (nodes-with-records + edges),
  or `GraphListNodes` returning full records plus an edge listing, collapses this
  to one call.
- **`VectorQuery` drops match metadata.** Matches come back as
  `{ key, score, metadata: null }` even when metadata was upserted; showing it
  requires `VectorGet` per hit. An `include_metadata: bool` on the query avoids
  the round-trips.

### 4. No capability/feature introspection in `Info`

`DatabaseInfo` (`types.rs:351`) carries `version`, `uptime_secs`, `branch_count`,
`total_keys`, `default_branch` — but **not**:

- **storage kind** (disk-backed vs in-memory),
- **enabled cargo features** (arrow, embed, anthropic/openai/google),
- **`supports_branching`** (and similar capability flags).

Consequences for Foundry: we learned that *"fork requires a disk-backed
database"* from a **runtime error**, and we now **hardcode** "scratch (in-memory)
DBs can't branch" in the frontend. If `Info` reported storage kind + feature
flags + capability booleans, the UI could disable the right affordances up front
and degrade gracefully, instead of discovering limits by hitting errors. This
matters for any consumer compiled with a different feature set than it assumes.

### 5. No generic `execute_many` (batch arbitrary commands)

The execution boundary is one-command-at-a-time. The N+1 patterns in #3 therefore
become N round-trips across the FFI/IPC boundary. There are per-primitive batch
ops (`KvBatchGet`, `EventBatchAppend`, `GraphBulkInsert`) but **no generic** "run
this list of commands." (An earlier `strata_execute_many` was specced in the
Foundry architecture doc but never implemented at the executor level.) A generic
batch — execute `[Command]`, return `[Result<Output, Error>]` — cuts IPC for
every consumer and is the natural complement to the snapshot fixes in #3.

### 6. Minor consistency nits

- **`as_of` reads degrade the output shape.** Current `KvGet`/`JsonGet` return
  `MaybeVersioned` (value + version + timestamp), but with `as_of` they return
  `Maybe` (value only). A time-travel read losing the version info is surprising;
  keeping `MaybeVersioned` would let consumers handle one shape.
- **Externally-tagged unit variants serialize as bare strings** (`"Unit"`,
  `"TxnBegun"`) while everything else is an object. Decodable, but a consumer's
  output parser has to special-case "string or object." Minor.

---

## Prioritization

| # | Improvement | Consumer pain removed | Effort | Beneficiaries |
|---|-------------|----------------------|--------|---------------|
| 1 | Machine-readable schema | Eliminates type-guessing entirely | Med | Foundry, SDKs, MCP, assistant |
| 3 | N+1 / completeness fixes | Removes workaround code | Low–Med | Foundry, any UI |
| 2 | Consistent serde conventions | Removes per-command special-casing | Low–Med | All |
| 4 | Capabilities in `Info` | UI adapts vs fails | Low | All |
| 5 | Generic `execute_many` | Fewer round-trips | Low | All |
| 6 | `as_of` shape / unit nits | Marginal | Low | All |

**Fund #1 and #3 first.** #1 makes every future consumer cheap to build and keeps
docs from drifting; #3 is the concrete data-completeness/N+1 work that directly
caused workaround code in Foundry. #2, #4, #5 are quality-of-life that compound
across the SDKs, MCP, and a future assistant — not just Foundry.

> Note on scope: a structured cross-primitive **query** engine is explicitly *not*
> requested here. Foundry's product position is that `get` + `search` cover
> retrieval, and a universal query engine is high-effort and works against the
> store's performance guarantees. These findings are about making the *existing*
> command surface cleaner to consume, not adding a query layer.

---

## Appendix A — Verified wire shapes (de-facto contract)

Captured empirically against a live in-memory/disk database (see the
`*_wire_shapes` tests in `strata-bridge`). Presented here as the contract a
generated schema (#1) would replace.

```text
KvPut         -> {"WriteResult":{"key":"...","version":N}}
KvGet (hit)   -> {"MaybeVersioned":{"value":<Value>,"version":N,"timestamp":µs}}
KvGet (miss)  -> {"MaybeVersioned":null}
KvList        -> {"Keys":[...]}            (sorted)
KvDelete      -> {"DeleteResult":{"key":"...","deleted":true}}
KvGetv        -> {"VersionHistory":[{"value":..,"version":N,"timestamp":µs}, ...]}  (newest first)

SpaceList     -> {"SpaceList":[...]}       SpaceCreate -> "Unit"

BranchList    -> {"BranchInfoList":[{"info":{"id","status","created_at","updated_at","parent_id"},"version","timestamp"}]}
BranchFork    -> {"BranchForked":{"source","destination","keys_copied","spaces_copied","fork_version"}}
BranchDiff    -> {"BranchDiff":{"branch_a","branch_b","spaces":[{"space","added":[{"key","raw_key","primitive","type_tag","space","value_a","value_b"}],"removed":[],"modified":[...]}],"summary":{"total_added","total_removed","total_modified","spaces_only_in_a","spaces_only_in_b"}}}
BranchMerge   -> {"BranchMerged":{"source","target","keys_applied","keys_deleted","conflicts":[],"spaces_merged","merge_version"}}
CherryPick    -> {"BranchCherryPicked":{"source","target","keys_applied","keys_deleted","cherry_pick_version"}}

EventAppend   -> {"EventAppendResult":{"sequence":N,"event_type":"..."}}
EventList     -> {"VersionedValues":[{"value":<payload>,"version":<seq>,"timestamp":µs}]}   # NOTE: no event_type
EventListTypes-> {"Keys":[...]}            EventLen -> {"Uint":N}

JsonList      -> {"JsonListResult":{"keys":[...],"has_more":false}}
JsonGet ($)   -> {"MaybeVersioned":{"value":<Value>,"version":N,"timestamp":µs}}
JsonSet       -> {"WriteResult":{"key":"...","version":N}}

VectorCreateCollection -> {"Version":N}
VectorListCollections  -> {"VectorCollectionList":[{"name","dimension","metric","count","index_type","memory_bytes"}]}
VectorUpsert  -> {"VectorWriteResult":{"collection","key","version"}}
VectorQuery   -> {"VectorMatches":[{"key","score","metadata":null}]}   # NOTE: metadata not populated
VectorGet     -> {"VectorData":{"key","data":{"embedding":[...],"metadata":<Value>},"version","timestamp"}}

GraphCreate   -> "Unit"
GraphAddNode  -> {"GraphWriteResult":{"node_id","created"}}
GraphAddEdge  -> {"GraphEdgeWriteResult":{"src","dst","edge_type","created"}}
GraphListNodes-> {"Keys":[...]}            # NOTE: ids only, no type/properties
GraphGetNode  -> {"Maybe":{"Object":{"properties":<Value>,"object_type":<Value>}}}
GraphNeighbors-> {"GraphNeighbors":[{"node_id","edge_type","weight"}]}   # no list-edges command

DbExport      -> {"Exported":{"row_count","format","primitive","data"?,"path"?,"size_bytes"?}}
ArrowImport   -> {"ArrowImported":{"rows_imported","rows_skipped","target","file_path"}}
```

## Appendix B — Casing/format quick reference

- snake_case: `DistanceMetric`, `ExportFormat`, `ExportPrimitive`
- PascalCase: `MergeStrategy`
- lowercase: `BranchStatus`
- timestamps: microseconds since the Unix epoch, everywhere
- `branch`/`space` are optional on most commands, defaulting to `"default"`
- branching operations require a **disk-backed** database (no-op / error on `cache()`)
