//! Tauri shell: exposes the `strata-bridge` registry to the React frontend
//! as `invoke`-able commands. All database work happens in `strata-bridge`.

use std::sync::Arc;

use strata_bridge::Registry;
use tauri::State;

/// App-wide state: one registry of open database handles.
struct AppState {
    registry: Arc<Registry>,
}

/// Liveness check that the Rust bridge is wired up.
#[tauri::command]
fn db_ping() -> &'static str {
    "strata-foundry"
}

/// Open an on-disk database at a `.strata` path. Returns a handle ID.
#[tauri::command]
fn db_open(state: State<'_, AppState>, path: String) -> Result<u64, String> {
    state.registry.open(&path)
}

/// Initialize a new database (replicates `strata init`): create directory,
/// write a profile-tuned strata.toml, and open. Returns JSON
/// `{ handle, profile, cores, ram_gb }`.
#[tauri::command]
fn db_init(state: State<'_, AppState>, path: String) -> Result<String, String> {
    state.registry.init(&path)
}

/// Open an ephemeral in-memory database. Returns a handle ID.
#[tauri::command]
fn db_open_memory(state: State<'_, AppState>) -> Result<u64, String> {
    state.registry.open_memory()
}

/// Close a database handle.
#[tauri::command]
fn db_close(state: State<'_, AppState>, handle: u64) {
    state.registry.close(handle);
}

/// Execute one externally-tagged JSON `Command`; returns `Output` JSON.
#[tauri::command]
fn db_execute(state: State<'_, AppState>, handle: u64, command: String) -> Result<String, String> {
    state.registry.execute(handle, &command)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .manage(AppState {
            registry: Arc::new(Registry::new()),
        })
        .invoke_handler(tauri::generate_handler![
            db_ping,
            db_open,
            db_init,
            db_open_memory,
            db_close,
            db_execute
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
