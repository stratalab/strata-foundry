//! Tauri-independent bridge to `stratadb`.
//!
//! Owns a registry of open databases keyed by integer handle IDs and runs
//! externally-tagged JSON `Command`s against them, returning `Output` JSON.
//! This crate has no Tauri dependency so it compiles and tests anywhere
//! `stratadb` does — the Tauri shell (`src-tauri`) is a thin wrapper over it.

use std::sync::atomic::{AtomicU64, Ordering};

use dashmap::DashMap;
use stratadb::{Command, Executor, Output, Strata};

/// Thread-safe registry of open database handles.
///
/// Each handle stores an [`Executor`] (which is `Send + Sync` and holds an
/// `Arc<Database>`, keeping the database alive). The `Strata` wrapper used to
/// open it is dropped once the executor is extracted.
pub struct Registry {
    next_id: AtomicU64,
    handles: DashMap<u64, Executor>,
}

impl Registry {
    pub fn new() -> Self {
        Self {
            next_id: AtomicU64::new(1),
            handles: DashMap::new(),
        }
    }

    /// Open an on-disk database at a `.strata` directory path.
    pub fn open(&self, path: &str) -> Result<u64, String> {
        let strata = Strata::open(path).map_err(|e| e.to_string())?;
        Ok(self.insert(strata))
    }

    /// Open an ephemeral in-memory database.
    pub fn open_memory(&self) -> Result<u64, String> {
        let strata = Strata::cache().map_err(|e| e.to_string())?;
        Ok(self.insert(strata))
    }

    /// Close a handle, dropping its executor (and the database if last ref).
    pub fn close(&self, id: u64) {
        self.handles.remove(&id);
    }

    /// Execute one externally-tagged JSON `Command`; returns `Output` JSON.
    pub fn execute(&self, id: u64, command_json: &str) -> Result<String, String> {
        let executor = self.handles.get(&id).ok_or("invalid handle")?;

        let cmd: Command = serde_json::from_str(command_json)
            .map_err(|e| format!("invalid command JSON: {e}"))?;

        let output: Output = executor.execute(cmd).map_err(|e| {
            // stratadb's Error derives Serialize — surface it as JSON.
            serde_json::to_string(&e).unwrap_or_else(|_| format!(r#"{{"Internal":{{"reason":"{e}"}}}}"#))
        })?;

        serde_json::to_string(&output).map_err(|e| format!("failed to serialize output: {e}"))
    }

    fn insert(&self, strata: Strata) -> u64 {
        // Reconstruct a stateless Executor from the shared Database handle.
        let executor = Executor::new(strata.database());
        let id = self.next_id.fetch_add(1, Ordering::Relaxed);
        self.handles.insert(id, executor);
        id
    }
}

impl Default for Registry {
    fn default() -> Self {
        Self::new()
    }
}

// Compile-time guarantee that Registry is safe to share as Tauri managed state.
const _: () = {
    fn assert_send_sync<T: Send + Sync + 'static>() {}
    let _ = assert_send_sync::<Registry>;
};

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn open_memory_ping_info() {
        let reg = Registry::new();
        let h = reg.open_memory().expect("open scratch db");

        let pong = reg.execute(h, r#"{"Ping":null}"#).expect("ping");
        assert!(pong.contains("Pong"), "expected Pong, got: {pong}");

        let info = reg.execute(h, r#"{"Info":null}"#).expect("info");
        assert!(info.contains("DatabaseInfo") || info.contains("Info"), "got: {info}");

        reg.close(h);
        assert!(reg.execute(h, r#"{"Ping":null}"#).is_err(), "closed handle should error");
    }
}
