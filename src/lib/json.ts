// Typed JSON-document operations (whole-document, at path "$"). Wire shapes:
//   JsonList -> { JsonListResult: { keys: string[], has_more } }
//   JsonGet  -> { MaybeVersioned: { value, version, timestamp } }
//   JsonSet  -> { WriteResult: { key, version } }
//   JsonGetv -> { VersionHistory: [{ value, version, timestamp }] }

import { execute } from "./strata";
import type { Handle } from "./strata";
import type { StrataValue } from "./types";
import type { VersionedValue } from "./kv";

function rec(o: unknown): Record<string, unknown> {
  return o !== null && typeof o === "object" ? (o as Record<string, unknown>) : {};
}
function scoped(args: Record<string, unknown>, branch?: string, space?: string) {
  if (branch) args.branch = branch;
  if (space) args.space = space;
  return args;
}

export async function jsonList(handle: Handle, branch?: string, space?: string): Promise<string[]> {
  const out = rec(await execute(handle, { JsonList: scoped({ limit: 1000 }, branch, space) }));
  const r = rec(out.JsonListResult);
  return Array.isArray(r.keys) ? (r.keys as string[]) : [];
}

export async function jsonGet(
  handle: Handle,
  key: string,
  branch?: string,
  space?: string,
): Promise<VersionedValue | null> {
  const out = rec(await execute(handle, { JsonGet: scoped({ key, path: "$" }, branch, space) }));
  const mv = out.MaybeVersioned;
  return mv ? (mv as VersionedValue) : null;
}

export async function jsonSet(
  handle: Handle,
  key: string,
  value: StrataValue,
  branch?: string,
  space?: string,
): Promise<number> {
  const out = rec(
    await execute(handle, { JsonSet: scoped({ key, path: "$", value }, branch, space) }),
  );
  const wr = rec(out.WriteResult);
  return typeof wr.version === "number" ? wr.version : 0;
}

export async function jsonDelete(
  handle: Handle,
  key: string,
  branch?: string,
  space?: string,
): Promise<void> {
  await execute(handle, { JsonDelete: scoped({ key, path: "$" }, branch, space) });
}

/** Full version history for a document, newest version first. */
export async function jsonHistory(
  handle: Handle,
  key: string,
  branch?: string,
  space?: string,
): Promise<VersionedValue[]> {
  const out = rec(await execute(handle, { JsonGetv: scoped({ key }, branch, space) }));
  return Array.isArray(out.VersionHistory) ? (out.VersionHistory as VersionedValue[]) : [];
}
