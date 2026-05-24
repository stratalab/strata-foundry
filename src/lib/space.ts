// Typed space operations. Spaces group keys within a branch (like schemas).
// Wire shapes verified: SpaceList -> { SpaceList: string[] } (sorted);
// SpaceCreate -> "Unit"; SpaceExists -> { Bool }. Spaces are per-branch and
// work on in-memory databases too.

import { execute } from "./strata";
import type { Handle } from "./strata";

function rec(o: unknown): Record<string, unknown> {
  return o !== null && typeof o === "object" ? (o as Record<string, unknown>) : {};
}

export async function spaceList(handle: Handle, branch?: string): Promise<string[]> {
  const args: Record<string, unknown> = {};
  if (branch) args.branch = branch;
  const out = rec(await execute(handle, { SpaceList: args }));
  return Array.isArray(out.SpaceList) ? (out.SpaceList as string[]) : [];
}

export async function spaceCreate(handle: Handle, space: string, branch?: string): Promise<void> {
  const args: Record<string, unknown> = { space };
  if (branch) args.branch = branch;
  await execute(handle, { SpaceCreate: args });
}

export async function spaceExists(handle: Handle, space: string, branch?: string): Promise<boolean> {
  const args: Record<string, unknown> = { space };
  if (branch) args.branch = branch;
  const out = rec(await execute(handle, { SpaceExists: args }));
  return out.Bool === true;
}
