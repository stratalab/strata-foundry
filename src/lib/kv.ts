// Typed KV operations over the command bridge.
// Wire shapes verified against stratadb 0.6.1:
//   KvList            -> { Keys: string[] }                (sorted)
//   KvGet (hit)       -> { MaybeVersioned: { value, version, timestamp } }
//   KvGet (miss)      -> { MaybeVersioned: null }
//   KvPut             -> { WriteResult: { key, version } }
// timestamp is microseconds since the Unix epoch. All ops accept an optional
// branch (defaults to "default" server-side).

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

export async function kvList(handle: Handle, branch?: string, prefix?: string): Promise<string[]> {
  const args: Record<string, unknown> = {};
  if (branch) args.branch = branch;
  if (prefix) args.prefix = prefix;
  const out = asRecord(await execute(handle, { KvList: args }));
  return Array.isArray(out.Keys) ? (out.Keys as string[]) : [];
}

export async function kvGet(
  handle: Handle,
  key: string,
  branch?: string,
): Promise<VersionedValue | null> {
  const args: Record<string, unknown> = { key };
  if (branch) args.branch = branch;
  const out = asRecord(await execute(handle, { KvGet: args }));
  const mv = out.MaybeVersioned;
  return mv ? (mv as VersionedValue) : null;
}

export async function kvPut(
  handle: Handle,
  key: string,
  value: StrataValue,
  branch?: string,
): Promise<number> {
  const args: Record<string, unknown> = { key, value };
  if (branch) args.branch = branch;
  const out = asRecord(await execute(handle, { KvPut: args }));
  const wr = asRecord(out.WriteResult);
  return typeof wr.version === "number" ? wr.version : 0;
}

export async function kvDelete(handle: Handle, key: string, branch?: string): Promise<void> {
  const args: Record<string, unknown> = { key };
  if (branch) args.branch = branch;
  await execute(handle, { KvDelete: args });
}

/** Full version history for a key, newest version first. */
export async function kvHistory(
  handle: Handle,
  key: string,
  branch?: string,
): Promise<VersionedValue[]> {
  const args: Record<string, unknown> = { key };
  if (branch) args.branch = branch;
  const out = asRecord(await execute(handle, { KvGetv: args }));
  return Array.isArray(out.VersionHistory) ? (out.VersionHistory as VersionedValue[]) : [];
}
