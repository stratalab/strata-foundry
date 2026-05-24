// Typed Arrow import/export (Parquet / CSV / JSONL). Wire shapes verified:
//   DbExport    -> { Exported: { row_count, format, primitive, data?, path? } }
//   ArrowImport -> { ArrowImported: { rows_imported, rows_skipped, target, file_path } }
// ExportFormat/ExportPrimitive serialize snake_case. Requires the bridge's
// `arrow` cargo feature (enabled on stratadb).

import { execute } from "./strata";
import type { Handle } from "./strata";

export type ExportFormat = "csv" | "json" | "jsonl" | "parquet";
export type ExportPrimitive = "kv" | "json" | "events" | "vector" | "graph";
export type ImportTarget = "kv" | "json" | "vector";

export interface ExportResult {
  row_count: number;
  format: string;
  primitive: string;
  /** Rendered data, present when no file path was given. */
  data?: string;
  /** File written, present when a path was given. */
  path?: string;
}

export interface ImportResult {
  rows_imported: number;
  rows_skipped: number;
  target: string;
  file_path: string;
}

function rec(o: unknown): Record<string, unknown> {
  return o !== null && typeof o === "object" ? (o as Record<string, unknown>) : {};
}
function scoped(args: Record<string, unknown>, branch?: string, space?: string) {
  if (branch) args.branch = branch;
  if (space) args.space = space;
  return args;
}

export async function dbExport(
  handle: Handle,
  opts: {
    primitive: ExportPrimitive;
    format: ExportFormat;
    prefix?: string;
    limit?: number;
    path?: string;
    collection?: string;
    graph?: string;
  },
  branch?: string,
  space?: string,
): Promise<ExportResult> {
  const args = scoped({ primitive: opts.primitive, format: opts.format }, branch, space);
  if (opts.prefix) args.prefix = opts.prefix;
  if (opts.limit) args.limit = opts.limit;
  if (opts.path) args.path = opts.path;
  if (opts.collection) args.collection = opts.collection;
  if (opts.graph) args.graph = opts.graph;
  const out = rec(await execute(handle, { DbExport: args }));
  return rec(out.Exported) as unknown as ExportResult;
}

export async function arrowImport(
  handle: Handle,
  opts: {
    filePath: string;
    target: ImportTarget;
    keyColumn?: string;
    valueColumn?: string;
    collection?: string;
    format?: string;
  },
  branch?: string,
  space?: string,
): Promise<ImportResult> {
  const args = scoped({ file_path: opts.filePath, target: opts.target }, branch, space);
  if (opts.keyColumn) args.key_column = opts.keyColumn;
  if (opts.valueColumn) args.value_column = opts.valueColumn;
  if (opts.collection) args.collection = opts.collection;
  if (opts.format) args.format = opts.format;
  const out = rec(await execute(handle, { ArrowImport: args }));
  return rec(out.ArrowImported) as unknown as ImportResult;
}
