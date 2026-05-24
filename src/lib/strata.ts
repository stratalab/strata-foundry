// Typed transport over the Tauri command bridge. Mirrors the old Swift
// `StrataTransport`: open a handle, execute JSON commands, close.

import { invoke } from "@tauri-apps/api/core";
import type { StrataCommand, StrataOutput } from "./types";

export type Handle = number;

/** Liveness check that the Rust bridge is wired up. */
export function ping(): Promise<string> {
  return invoke<string>("db_ping");
}

/** Open an on-disk database at a `.strata` directory path. */
export function open(path: string): Promise<Handle> {
  return invoke<Handle>("db_open", { path });
}

/** Result of `init`: handle plus the detected hardware profile. */
export interface InitInfo {
  handle: Handle;
  profile: string;
  cores: number;
  ram_gb: number;
}

/** Initialize a new database (replicates `strata init`): create dir + tuned
 * strata.toml + open. */
export async function init(path: string): Promise<InitInfo> {
  const json = await invoke<string>("db_init", { path });
  return JSON.parse(json) as InitInfo;
}

/** Open an ephemeral in-memory database. */
export function openMemory(): Promise<Handle> {
  return invoke<Handle>("db_open_memory");
}

/** Close a handle and free its database. */
export function close(handle: Handle): Promise<void> {
  return invoke("db_close", { handle });
}

/** Execute one externally-tagged Command; returns the parsed Output. */
export async function execute(
  handle: Handle,
  command: StrataCommand,
): Promise<StrataOutput> {
  const json = await invoke<string>("db_execute", {
    handle,
    command: JSON.stringify(command),
  });
  return JSON.parse(json) as StrataOutput;
}
