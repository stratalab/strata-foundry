// Helpers for working with StrataValue (the externally-tagged Rust Value enum).

import type { StrataValue } from "./types";

/** Short type tag for display, e.g. "object", "int". */
export function valueType(v: StrataValue): string {
  if (v === "Null") return "null";
  if ("Bool" in v) return "bool";
  if ("Int" in v) return "int";
  if ("Float" in v) return "float";
  if ("String" in v) return "string";
  if ("Bytes" in v) return "bytes";
  if ("Array" in v) return "array";
  if ("Object" in v) return "object";
  return "unknown";
}

/** Convert a StrataValue into a plain JS value (for JSON.stringify / display). */
export function toPlain(v: StrataValue): unknown {
  if (v === "Null") return null;
  if ("Bool" in v) return v.Bool;
  if ("Int" in v) return v.Int;
  if ("Float" in v) return v.Float;
  if ("String" in v) return v.String;
  if ("Bytes" in v) return v.Bytes;
  if ("Array" in v) return v.Array.map(toPlain);
  if ("Object" in v) {
    const out: Record<string, unknown> = {};
    for (const [k, val] of Object.entries(v.Object)) out[k] = toPlain(val);
    return out;
  }
  return null;
}

/** One-line preview string for a value. */
export function preview(v: StrataValue): string {
  const plain = toPlain(v);
  return typeof plain === "string" ? plain : JSON.stringify(plain);
}

/** Convert a plain JS value (e.g. from JSON.parse) into a tagged StrataValue. */
export function fromPlain(v: unknown): StrataValue {
  if (v === null || v === undefined) return "Null";
  if (typeof v === "boolean") return { Bool: v };
  if (typeof v === "number") return Number.isInteger(v) ? { Int: v } : { Float: v };
  if (typeof v === "string") return { String: v };
  if (Array.isArray(v)) return { Array: v.map(fromPlain) };
  if (typeof v === "object") {
    const out: Record<string, StrataValue> = {};
    for (const [k, val] of Object.entries(v as Record<string, unknown>)) out[k] = fromPlain(val);
    return { Object: out };
  }
  return "Null";
}
