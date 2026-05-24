// Typed vector operations. Wire shapes verified against stratadb 0.6.1:
//   VectorListCollections -> { VectorCollectionList: [{ name, dimension, metric, count, index_type, memory_bytes }] }
//   VectorCreateCollection -> { Version }   (metric serializes snake_case: "cosine"/"euclidean"/"dot_product")
//   VectorUpsert -> { VectorWriteResult: { collection, key, version } }
//   VectorQuery  -> { VectorMatches: [{ key, score, metadata }] }   (ranked, best first)
//   VectorGet    -> { VectorData: { key, data: { embedding, metadata }, version, timestamp } } | null

import { execute } from "./strata";
import type { Handle } from "./strata";
import type { StrataValue } from "./types";

export type DistanceMetric = "cosine" | "euclidean" | "dot_product";

export interface VectorCollection {
  name: string;
  dimension: number;
  metric: string;
  count: number;
  index_type: string;
  memory_bytes: number;
}

export interface VectorMatch {
  key: string;
  score: number;
  metadata: StrataValue | null;
}

export interface VectorData {
  key: string;
  embedding: number[];
  metadata: StrataValue | null;
  version: number;
  timestamp: number;
}

function rec(o: unknown): Record<string, unknown> {
  return o !== null && typeof o === "object" ? (o as Record<string, unknown>) : {};
}
function scoped(args: Record<string, unknown>, branch?: string, space?: string) {
  if (branch) args.branch = branch;
  if (space) args.space = space;
  return args;
}

export async function vectorListCollections(
  handle: Handle,
  branch?: string,
  space?: string,
): Promise<VectorCollection[]> {
  const out = rec(await execute(handle, { VectorListCollections: scoped({}, branch, space) }));
  return Array.isArray(out.VectorCollectionList)
    ? (out.VectorCollectionList as VectorCollection[])
    : [];
}

export async function vectorCreateCollection(
  handle: Handle,
  collection: string,
  dimension: number,
  metric: DistanceMetric,
  branch?: string,
  space?: string,
): Promise<void> {
  await execute(handle, {
    VectorCreateCollection: scoped({ collection, dimension, metric }, branch, space),
  });
}

export async function vectorDeleteCollection(
  handle: Handle,
  collection: string,
  branch?: string,
  space?: string,
): Promise<void> {
  await execute(handle, { VectorDeleteCollection: scoped({ collection }, branch, space) });
}

export async function vectorUpsert(
  handle: Handle,
  collection: string,
  key: string,
  vector: number[],
  metadata: StrataValue | null,
  branch?: string,
  space?: string,
): Promise<void> {
  const args = scoped({ collection, key, vector }, branch, space);
  if (metadata !== null) args.metadata = metadata;
  await execute(handle, { VectorUpsert: args });
}

export async function vectorQuery(
  handle: Handle,
  collection: string,
  query: number[],
  k: number,
  branch?: string,
  space?: string,
): Promise<VectorMatch[]> {
  const out = rec(await execute(handle, { VectorQuery: scoped({ collection, query, k }, branch, space) }));
  return Array.isArray(out.VectorMatches) ? (out.VectorMatches as VectorMatch[]) : [];
}

export async function vectorGet(
  handle: Handle,
  collection: string,
  key: string,
  branch?: string,
  space?: string,
): Promise<VectorData | null> {
  const out = rec(await execute(handle, { VectorGet: scoped({ collection, key }, branch, space) }));
  if (!out.VectorData) return null;
  const vd = rec(out.VectorData);
  const data = rec(vd.data);
  return {
    key: String(vd.key ?? key),
    embedding: Array.isArray(data.embedding) ? (data.embedding as number[]) : [],
    metadata: (data.metadata as StrataValue) ?? null,
    version: typeof vd.version === "number" ? vd.version : 0,
    timestamp: typeof vd.timestamp === "number" ? vd.timestamp : 0,
  };
}
