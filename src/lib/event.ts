// Typed event-log operations. Wire shapes verified against stratadb 0.6.1:
//   EventAppend     -> { EventAppendResult: { sequence, event_type } }
//   EventLen        -> { Uint }
//   EventListTypes  -> { Keys: string[] }
//   EventList       -> { VersionedValues: [{ value=payload, version=sequence, timestamp }] }
//   EventGetByType  -> { VersionedValues: [...] }  (lets us recover the type per event)

import { execute } from "./strata";
import type { Handle } from "./strata";
import type { StrataValue } from "./types";

export interface EventEntry {
  sequence: number;
  type: string;
  timestamp: number;
  payload: StrataValue;
}

function rec(o: unknown): Record<string, unknown> {
  return o !== null && typeof o === "object" ? (o as Record<string, unknown>) : {};
}
function scoped(args: Record<string, unknown>, branch?: string, space?: string) {
  if (branch) args.branch = branch;
  if (space) args.space = space;
  return args;
}

export async function eventLen(handle: Handle, branch?: string, space?: string): Promise<number> {
  const out = rec(await execute(handle, { EventLen: scoped({}, branch, space) }));
  return typeof out.Uint === "number" ? out.Uint : 0;
}

export async function eventTypes(handle: Handle, branch?: string, space?: string): Promise<string[]> {
  const out = rec(await execute(handle, { EventListTypes: scoped({}, branch, space) }));
  return Array.isArray(out.Keys) ? (out.Keys as string[]) : [];
}

type RawVersioned = { value: StrataValue; version: number; timestamp: number };

async function eventsOfType(
  handle: Handle,
  type: string,
  branch?: string,
  space?: string,
): Promise<EventEntry[]> {
  const out = rec(await execute(handle, { EventGetByType: scoped({ event_type: type }, branch, space) }));
  const vs = Array.isArray(out.VersionedValues) ? (out.VersionedValues as RawVersioned[]) : [];
  return vs.map((v) => ({ sequence: v.version, type, timestamp: v.timestamp, payload: v.value }));
}

/** Full event log with each event's type, newest (highest sequence) first. */
export async function eventLog(handle: Handle, branch?: string, space?: string): Promise<EventEntry[]> {
  const types = await eventTypes(handle, branch, space);
  const groups = await Promise.all(types.map((t) => eventsOfType(handle, t, branch, space)));
  return groups.flat().sort((a, b) => b.sequence - a.sequence);
}

export async function eventAppend(
  handle: Handle,
  type: string,
  payload: StrataValue,
  branch?: string,
  space?: string,
): Promise<number> {
  const out = rec(
    await execute(handle, { EventAppend: scoped({ event_type: type, payload }, branch, space) }),
  );
  const r = rec(out.EventAppendResult);
  return typeof r.sequence === "number" ? r.sequence : -1;
}
