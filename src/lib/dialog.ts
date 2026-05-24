// Thin wrappers over the Tauri dialog plugin (native open/save dialogs).

import { open, save } from "@tauri-apps/plugin-dialog";

/** Pick a directory (e.g. a `.strata` folder or where to create one). */
export async function pickDirectory(title?: string): Promise<string | null> {
  const res = await open({ directory: true, multiple: false, title });
  return typeof res === "string" ? res : null;
}

/** Pick a single file, optionally filtered by extension. */
export async function pickFile(opts?: {
  title?: string;
  extensions?: string[];
}): Promise<string | null> {
  const filters = opts?.extensions ? [{ name: "Data", extensions: opts.extensions }] : undefined;
  const res = await open({ directory: false, multiple: false, title: opts?.title, filters });
  return typeof res === "string" ? res : null;
}

/** Pick a destination path for saving a file. */
export async function pickSavePath(opts?: {
  title?: string;
  defaultPath?: string;
}): Promise<string | null> {
  const res = await save({ title: opts?.title, defaultPath: opts?.defaultPath });
  return res ?? null;
}
