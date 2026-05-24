// Typed KV operations over the command bridge.
// Wire shapes verified against stratadb 0.6.1:
//   KvList            -> { Keys: string[] }                (sorted)
//   KvGet (hit)       -> { MaybeVersioned: { value, version, timestamp } }
//   KvGet (miss)      -> { MaybeVersioned: null }
//   KvPut             -> { WriteResult: { key, version } }
//   KvDelete          -> { DeleteResult: { key, deleted } }
//   KvGetv            -> { VersionHistory: [{ value, version, timestamp }] }  (newest first)
// timestamp is microseconds since the Unix epoch. Every op is scoped by an
// optional (branch, space), both defaulting to "default" server-side.

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

function scoped(
  args: Record<string, unknown>,
  branch?: string,
  space?: string,
): Record<string, unknown> {
  if (branch) args.branch = branch;
  if (space) args.space = space;
  return args;
}

export async function kvList(
  handle: Handle,
  branch?: string,
  space?: string,
  prefix?: string,
): Promise<string[]> {
  const args = scoped({}, branch, space);
  if (prefix) args.prefix = prefix;
  const out = asRecord(await execute(handle, { KvList: args }));
  return Array.isArray(out.Keys) ? (out.Keys as string[]) : [];
}

export async function kvGet(
  handle: Handle,
  key: string,
  branch?: string,
  space?: string,
): Promise<VersionedValue | null> {
  const out = asRecord(await execute(handle, { KvGet: scoped({ key }, branch, space) }));
  const mv = out.MaybeVersioned;
  return mv ? (mv as VersionedValue) : null;
}

export async function kvPut(
  handle: Handle,
  key: string,
  value: StrataValue,
  branch?: string,
  space?: string,
): Promise<number> {
  const out = asRecord(await execute(handle, { KvPut: scoped({ key, value }, branch, space) }));
  const wr = asRecord(out.WriteResult);
  return typeof wr.version === "number" ? wr.version : 0;
}

export async function kvDelete(
  handle: Handle,
  key: string,
  branch?: string,
  space?: string,
): Promise<void> {
  await execute(handle, { KvDelete: scoped({ key }, branch, space) });
}

/** Full version history for a key, newest version first. */
export async function kvHistory(
  handle: Handle,
  key: string,
  branch?: string,
  space?: string,
): Promise<VersionedValue[]> {
  const out = asRecord(await execute(handle, { KvGetv: scoped({ key }, branch, space) }));
  return Array.isArray(out.VersionHistory) ? (out.VersionHistory as VersionedValue[]) : [];
}
