// Wire types mirroring stratadb's serde externally-tagged enums.
// (See the database's Command/Output/Value model.)

/** Rust `Value` — externally-tagged. `Null` is the bare string "Null". */
export type StrataValue =
  | "Null"
  | { Bool: boolean }
  | { Int: number }
  | { Float: number }
  | { String: string }
  | { Bytes: number[] }
  | { Array: StrataValue[] }
  | { Object: Record<string, StrataValue> };

/**
 * Rust `Command` — externally-tagged single-key object, e.g.
 *   { Ping: null }
 *   { KvGet: { key: "user:1" } }
 *   { KvPut: { key: "user:1", value: { String: "Alice" } } }
 *
 * Kept as an open record during the mechanics phase; tighten into a
 * per-variant union as features are ported.
 */
export type StrataCommand = Record<string, unknown>;

/** Rust `Output` — externally-tagged, e.g. { Pong: { version } }. */
export type StrataOutput = string | Record<string, unknown>;
