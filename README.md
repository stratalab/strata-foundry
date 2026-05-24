# Strata Foundry

Cross-platform desktop explorer for [StrataDB](../strata-core), built with **Tauri 2 + React + TypeScript**. macOS is the primary target; Windows and Linux are also built.

This is a rewrite of the original native SwiftUI/macOS app (preserved in git history). Because StrataDB is a Rust crate and Tauri's backend is Rust, there is **no FFI bridge** — the backend calls `stratadb` directly.

## Layout

```
src/                  React + TypeScript frontend
  lib/strata.ts        typed transport over the Tauri command bridge
  lib/types.ts         StrataValue/Command/Output wire types
src-tauri/            Tauri shell — exposes db_* commands to the frontend
crates/strata-bridge/ Tauri-independent registry + JSON command execution
                       (depends only on stratadb; compiles/tests anywhere)
```

The DB logic lives in `crates/strata-bridge` so it builds and tests without
the Tauri webview toolchain. `src-tauri` is a thin wrapper that registers it
as Tauri managed state and re-exports `open` / `open_memory` / `close` /
`execute` as `invoke`-able commands.

## Develop

Requires Node 20+, Rust, and the Tauri prerequisites for your OS
(<https://tauri.app/start/prerequisites/> — on Linux: `webkit2gtk` + `rsvg2`).

```bash
npm install
npm run tauri dev      # run the desktop app
```

Verify the DB bridge without the webview toolchain (works on any platform):

```bash
cd crates/strata-bridge && cargo test
```

`stratadb` is consumed by path from the sibling `../strata-core` checkout.
