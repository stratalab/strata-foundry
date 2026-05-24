// Typed branch operations + types. Wire shapes verified against stratadb 0.6.1
// (see strata-bridge branch_wire_shapes test). Branching requires a disk-backed DB.

import { execute } from "./strata";
import type { Handle } from "./strata";
import type { StrataValue } from "./types";

export interface BranchInfo {
  id: string;
  status: string;
  created_at: number;
  updated_at: number;
  parent_id: string | null;
}

export interface DiffEntry {
  key: string;
  primitive: string;
  type_tag: string;
  space: string;
  /** Value on branch_a (null if absent there — i.e. added on b). */
  value_a: StrataValue | null;
  /** Value on branch_b (null if absent there — i.e. removed on b). */
  value_b: StrataValue | null;
}

export interface SpaceDiff {
  space: string;
  added: DiffEntry[];
  removed: DiffEntry[];
  modified: DiffEntry[];
}

export interface BranchDiffResult {
  branch_a: string;
  branch_b: string;
  spaces: SpaceDiff[];
  summary: {
    total_added: number;
    total_removed: number;
    total_modified: number;
    spaces_only_in_a: string[];
    spaces_only_in_b: string[];
  };
}

export interface ForkResult {
  source: string;
  destination: string;
  keys_copied: number;
  spaces_copied: number;
  fork_version: number;
}

export interface MergeResult {
  source: string;
  target: string;
  keys_applied: number;
  keys_deleted: number;
  conflicts: Array<Record<string, unknown>>;
  spaces_merged: number;
  merge_version: number;
}

export interface CherryPickResult {
  source: string;
  target: string;
  keys_applied: number;
  keys_deleted: number;
  cherry_pick_version: number;
}

export type MergeStrategy = "LastWriterWins" | "Strict";

function rec(o: unknown): Record<string, unknown> {
  return o !== null && typeof o === "object" ? (o as Record<string, unknown>) : {};
}

export async function branchList(handle: Handle): Promise<BranchInfo[]> {
  const out = rec(await execute(handle, { BranchList: {} }));
  const list = out.BranchInfoList;
  if (!Array.isArray(list)) return [];
  return (list as Array<{ info: BranchInfo }>).map((e) => e.info);
}

export async function branchFork(
  handle: Handle,
  source: string,
  destination: string,
): Promise<ForkResult> {
  const out = rec(await execute(handle, { BranchFork: { source, destination } }));
  return rec(out.BranchForked) as unknown as ForkResult;
}

export async function branchDiff(
  handle: Handle,
  branchA: string,
  branchB: string,
): Promise<BranchDiffResult> {
  const out = rec(await execute(handle, { BranchDiff: { branch_a: branchA, branch_b: branchB } }));
  return out.BranchDiff as BranchDiffResult;
}

export async function branchMerge(
  handle: Handle,
  source: string,
  target: string,
  strategy: MergeStrategy,
): Promise<MergeResult> {
  const out = rec(await execute(handle, { BranchMerge: { source, target, strategy } }));
  return out.BranchMerged as MergeResult;
}

export async function branchCherryPick(
  handle: Handle,
  source: string,
  target: string,
  keys: Array<[string, string]>,
): Promise<CherryPickResult> {
  const out = rec(await execute(handle, { BranchCherryPick: { source, target, keys } }));
  return out.BranchCherryPicked as CherryPickResult;
}
