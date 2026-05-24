// Typed KV operations over the command bridge.
// Wire shapes verified against stratadb 0.6.1:
//   KvList            -> { Keys: string[] }                (sorted)
//   KvGet (hit)       -> { MaybeVersioned: { value, version, timestamp } }
//   KvGet (miss)      -> { MaybeVersioned: null }
//   KvPut             -> { WriteResult: { key, version } }
// timestamp is microseconds since the Unix epoch.

import { execute } from "./strata";
import type { Handle } from "./strata";
import type { StrataValue } from "./types";

export interface VersionedValue {
  value: StrataValue;
  version: number;
  /** Microseconds since the Unix epoch. */
  timestamp: number;
}

function asRecord(o: unknown): Record<string, unknown> {
  return o !== null && typeof o === "object" ? (o as Record<string, unknown>) : {};
}

export async function kvList(handle: Handle, prefix?: string): Promise<string[]> {
  const out = asRecord(await execute(handle, { KvList: prefix ? { prefix } : {} }));
  return Array.isArray(out.Keys) ? (out.Keys as string[]) : [];
}

export async function kvGet(handle: Handle, key: string): Promise<VersionedValue | null> {
  const out = asRecord(await execute(handle, { KvGet: { key } }));
  const mv = out.MaybeVersioned;
  return mv ? (mv as VersionedValue) : null;
}

export async function kvPut(handle: Handle, key: string, value: StrataValue): Promise<number> {
  const out = asRecord(await execute(handle, { KvPut: { key, value } }));
  const wr = asRecord(out.WriteResult);
  return typeof wr.version === "number" ? wr.version : 0;
}
