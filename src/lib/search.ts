// Cross-primitive search. Wire shape (verified):
//   Search { branch?, space?, search: { query, recipe?, k?, as_of? } }
//   -> { SearchResults: { hits: [{ entity_ref{kind,branch_id,space,key?,doc_id?,sequence?}, score, rank, snippet? }], stats: {...} } }
// recipe is a named string ("default" -> hybrid, "keyword" -> BM25, "hybrid").
// Keyword search needs no embedding model.

import { execute } from "./strata";
import type { Handle } from "./strata";

export interface SearchHit {
  kind: string; // kv | json | event | vector | graph | branch
  id: string; // key | doc_id | #sequence
  space: string | null;
  score: number;
  rank: number;
  snippet: string | null;
}

export interface SearchStats {
  mode: string;
  elapsed_ms: number;
  index_used: boolean;
  truncated: boolean;
}

export interface SearchResults {
  hits: SearchHit[];
  stats: SearchStats;
}

function rec(o: unknown): Record<string, unknown> {
  return o !== null && typeof o === "object" ? (o as Record<string, unknown>) : {};
}

function entityId(ref: Record<string, unknown>): string {
  if (typeof ref.key === "string") return ref.key;
  if (typeof ref.doc_id === "string") return ref.doc_id;
  if (typeof ref.sequence === "number") return `#${ref.sequence}`;
  return typeof ref.branch_id === "string" ? ref.branch_id : "";
}

export async function search(
  handle: Handle,
  opts: { query: string; recipe?: string; k?: number },
  branch?: string,
  space?: string,
): Promise<SearchResults> {
  const sq: Record<string, unknown> = { query: opts.query };
  if (opts.recipe) sq.recipe = opts.recipe;
  if (opts.k != null) sq.k = opts.k;
  const args: Record<string, unknown> = { search: sq };
  if (branch) args.branch = branch;
  if (space) args.space = space;

  const out = rec(await execute(handle, { Search: args }));
  const sr = rec(out.SearchResults);
  const rawHits = Array.isArray(sr.hits) ? (sr.hits as Array<Record<string, unknown>>) : [];
  const hits: SearchHit[] = rawHits.map((h) => {
    const ref = rec(h.entity_ref);
    return {
      kind: String(ref.kind ?? ""),
      id: entityId(ref),
      space: typeof ref.space === "string" ? ref.space : null,
      score: typeof h.score === "number" ? h.score : 0,
      rank: typeof h.rank === "number" ? h.rank : 0,
      snippet: typeof h.snippet === "string" ? h.snippet : null,
    };
  });
  const stats = rec(sr.stats);
  return {
    hits,
    stats: {
      mode: String(stats.mode ?? ""),
      elapsed_ms: typeof stats.elapsed_ms === "number" ? stats.elapsed_ms : 0,
      index_used: stats.index_used === true,
      truncated: stats.truncated === true,
    },
  };
}
