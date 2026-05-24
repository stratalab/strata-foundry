//! Tauri-independent bridge to `stratadb`.
//!
//! Owns a registry of open databases keyed by integer handle IDs and runs
//! externally-tagged JSON `Command`s against them, returning `Output` JSON.
//! This crate has no Tauri dependency so it compiles and tests anywhere
//! `stratadb` does — the Tauri shell (`src-tauri`) is a thin wrapper over it.

use std::sync::atomic::{AtomicU64, Ordering};

use dashmap::DashMap;
use stratadb::{
    apply_profile_if_defaults, detect_hardware, Command, Executor, Output, Profile, Strata,
    StrataConfig,
};

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

    /// Initialize a new database, replicating `strata init`: create the
    /// directory, write a hardware-profile-tuned `strata.toml`, open it, and
    /// return a handle plus the detected profile info as JSON.
    pub fn init(&self, path: &str) -> Result<String, String> {
        let dir = std::path::Path::new(path);
        std::fs::create_dir_all(dir).map_err(|e| format!("failed to create {path}: {e}"))?;

        let hw = detect_hardware();
        let profile = Profile::classify(hw);

        let config_path = dir.join("strata.toml");
        if !config_path.exists() {
            let mut cfg = StrataConfig::default();
            apply_profile_if_defaults(&mut cfg, profile, hw);
            cfg.write_to_file(&config_path)
                .map_err(|e| format!("failed to write strata.toml: {e}"))?;
        }

        let strata = Strata::open(dir).map_err(|e| e.to_string())?;
        let id = self.insert(strata);

        let ram_gb = hw.ram_bytes as f64 / (1024.0 * 1024.0 * 1024.0);
        Ok(format!(
            r#"{{"handle":{id},"profile":{},"cores":{},"ram_gb":{:.1}}}"#,
            serde_json::json!(profile.to_string()),
            hw.cores,
            ram_gb,
        ))
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

    /// Prints the real KvPut/KvList/KvGet wire shapes so the frontend can be
    /// typed against them. Run: `cargo test kv_wire_shapes -- --nocapture`.
    #[test]
    fn kv_wire_shapes() {
        let reg = Registry::new();
        let h = reg.open_memory().unwrap();

        let put_alice = reg
            .execute(h, r#"{"KvPut":{"key":"user:alice","value":{"Object":{"name":{"String":"Alice"},"age":{"Int":30}}}}}"#)
            .unwrap();
        let put_cfg = reg
            .execute(h, r#"{"KvPut":{"key":"config:max","value":{"Int":42}}}"#)
            .unwrap();
        let list_all = reg.execute(h, r#"{"KvList":{}}"#).unwrap();
        let list_pref = reg.execute(h, r#"{"KvList":{"prefix":"user:"}}"#).unwrap();
        let get_alice = reg.execute(h, r#"{"KvGet":{"key":"user:alice"}}"#).unwrap();
        let get_missing = reg.execute(h, r#"{"KvGet":{"key":"nope"}}"#).unwrap();

        eprintln!("KvPut       -> {put_alice}");
        eprintln!("KvPut(int)  -> {put_cfg}");
        eprintln!("KvList{{}}    -> {list_all}");
        eprintln!("KvList pfx  -> {list_pref}");
        eprintln!("KvGet hit   -> {get_alice}");
        eprintln!("KvGet miss  -> {get_missing}");

        assert!(list_all.contains("user:alice") && list_all.contains("config:max"));
        assert!(list_pref.contains("user:alice") && !list_pref.contains("config:max"));
    }

    /// Captures the branch fork/diff/merge/cherry-pick wire shapes.
    /// Run: `cargo test branch_wire_shapes -- --nocapture`.
    #[test]
    fn branch_wire_shapes() {
        // Branching requires a disk-backed database (fork/diff/merge no-op on cache()).
        let dir = std::env::temp_dir().join(format!("strata-bw-{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&dir);
        let path = dir.join(".strata");
        let reg = Registry::new();
        let h = reg.open(path.to_str().unwrap()).unwrap();
        let run = |c: &str| reg.execute(h, c).unwrap_or_else(|e| format!("ERR: {e}"));

        run(r#"{"KvPut":{"key":"user:alice","value":{"String":"Alice"}}}"#);
        run(r#"{"KvPut":{"key":"config:x","value":{"Int":1}}}"#);

        eprintln!("BranchList  -> {}", run(r#"{"BranchList":{}}"#));
        eprintln!("BranchFork  -> {}", run(r#"{"BranchFork":{"source":"default","destination":"feature"}}"#));

        run(r#"{"KvPut":{"branch":"feature","key":"user:alice","value":{"String":"Alice v2"}}}"#);
        run(r#"{"KvPut":{"branch":"feature","key":"user:carol","value":{"String":"Carol"}}}"#);

        eprintln!("BranchGet   -> {}", run(r#"{"BranchGet":{"branch":"feature"}}"#));
        eprintln!("BranchDiff  -> {}", run(r#"{"BranchDiff":{"branch_a":"default","branch_b":"feature"}}"#));
        eprintln!("MergeBase   -> {}", run(r#"{"BranchMergeBase":{"branch_a":"default","branch_b":"feature"}}"#));
        eprintln!("CherryPick  -> {}", run(r#"{"BranchCherryPick":{"source":"feature","target":"default","keys":[["default","user:carol"]]}}"#));
        eprintln!("BranchMerge -> {}", run(r#"{"BranchMerge":{"source":"feature","target":"default","strategy":"LastWriterWins"}}"#));

        reg.close(h);
        let _ = std::fs::remove_dir_all(&dir);
    }

    /// Captures KvGetv (version history) + KvDelete wire shapes for time-travel.
    /// Run: `cargo test kv_history_shapes -- --nocapture`.
    #[test]
    fn kv_history_shapes() {
        let reg = Registry::new();
        let h = reg.open_memory().unwrap();
        let run = |c: &str| reg.execute(h, c).unwrap_or_else(|e| format!("ERR: {e}"));

        run(r#"{"KvPut":{"key":"k","value":{"String":"v1"}}}"#);
        run(r#"{"KvPut":{"key":"k","value":{"String":"v2"}}}"#);
        run(r#"{"KvPut":{"key":"k","value":{"Int":3}}}"#);

        eprintln!("KvGetv      -> {}", run(r#"{"KvGetv":{"key":"k"}}"#));
        eprintln!("KvDelete    -> {}", run(r#"{"KvDelete":{"key":"k"}}"#));
        eprintln!("GetAfterDel -> {}", run(r#"{"KvGet":{"key":"k"}}"#));
    }

    /// Captures Space wire shapes + key isolation per space (on in-memory).
    /// Run: `cargo test space_wire_shapes -- --nocapture`.
    #[test]
    fn space_wire_shapes() {
        let reg = Registry::new();
        let h = reg.open_memory().unwrap();
        let run = |c: &str| reg.execute(h, c).unwrap_or_else(|e| format!("ERR: {e}"));

        run(r#"{"KvPut":{"key":"user:alice","value":{"String":"Alice"}}}"#);
        eprintln!("SpaceList(0) -> {}", run(r#"{"SpaceList":{}}"#));
        eprintln!("SpaceCreate  -> {}", run(r#"{"SpaceCreate":{"space":"analytics"}}"#));
        eprintln!("SpaceList(1) -> {}", run(r#"{"SpaceList":{}}"#));
        run(r#"{"KvPut":{"space":"analytics","key":"metric:dau","value":{"Int":1000}}}"#);
        eprintln!("KvList analytics -> {}", run(r#"{"KvList":{"space":"analytics"}}"#));
        eprintln!("KvList default   -> {}", run(r#"{"KvList":{}}"#));
        eprintln!("SpaceExists  -> {}", run(r#"{"SpaceExists":{"space":"analytics"}}"#));
    }

    /// Captures Event + JSON wire shapes. Run: `cargo test event_json_wire_shapes -- --nocapture`.
    #[test]
    fn event_json_wire_shapes() {
        let reg = Registry::new();
        let h = reg.open_memory().unwrap();
        let run = |c: &str| reg.execute(h, c).unwrap_or_else(|e| format!("ERR: {e}"));

        // Events
        eprintln!("EvAppend -> {}", run(r#"{"EventAppend":{"event_type":"user.created","payload":{"Object":{"user":{"String":"alice"}}}}}"#));
        run(r#"{"EventAppend":{"event_type":"user.login","payload":{"Object":{"user":{"String":"bob"}}}}}"#);
        eprintln!("EvLen    -> {}", run(r#"{"EventLen":{}}"#));
        eprintln!("EvTypes  -> {}", run(r#"{"EventListTypes":{}}"#));
        eprintln!("EvList   -> {}", run(r#"{"EventList":{"limit":10}}"#));
        eprintln!("EvGet0   -> {}", run(r#"{"EventGet":{"sequence":0}}"#));

        // JSON
        eprintln!("JsonSet  -> {}", run(r#"{"JsonSet":{"key":"doc:readme","path":"$","value":{"Object":{"title":{"String":"Hi"},"tags":{"Array":[{"String":"a"}]}}}}}"#));
        eprintln!("JsonList -> {}", run(r#"{"JsonList":{"limit":100}}"#));
        eprintln!("JsonGet  -> {}", run(r#"{"JsonGet":{"key":"doc:readme","path":"$"}}"#));
        eprintln!("JsonCount-> {}", run(r#"{"JsonCount":{}}"#));
    }

    /// Captures Vector wire shapes. Run: `cargo test vector_wire_shapes -- --nocapture`.
    #[test]
    fn vector_wire_shapes() {
        let reg = Registry::new();
        let h = reg.open_memory().unwrap();
        let run = |c: &str| reg.execute(h, c).unwrap_or_else(|e| format!("ERR: {e}"));

        eprintln!("CreateColl -> {}", run(r#"{"VectorCreateCollection":{"collection":"docs","dimension":4,"metric":"cosine"}}"#));
        eprintln!("Upsert     -> {}", run(r#"{"VectorUpsert":{"collection":"docs","key":"a","vector":[1.0,0.0,0.0,0.0],"metadata":{"Object":{"title":{"String":"Alpha"}}}}}"#));
        run(r#"{"VectorUpsert":{"collection":"docs","key":"b","vector":[0.0,1.0,0.0,0.0],"metadata":{"Object":{"title":{"String":"Beta"}}}}}"#);
        run(r#"{"VectorUpsert":{"collection":"docs","key":"c","vector":[0.9,0.1,0.0,0.0],"metadata":{"Object":{"title":{"String":"Gamma"}}}}}"#);
        eprintln!("ListColl   -> {}", run(r#"{"VectorListCollections":{}}"#));
        eprintln!("Count      -> {}", run(r#"{"VectorCount":{"collection":"docs"}}"#));
        eprintln!("Query      -> {}", run(r#"{"VectorQuery":{"collection":"docs","query":[1.0,0.0,0.0,0.0],"k":3}}"#));
        eprintln!("Get        -> {}", run(r#"{"VectorGet":{"collection":"docs","key":"a"}}"#));
    }

    /// Captures Graph wire shapes. Run: `cargo test graph_wire_shapes -- --nocapture`.
    #[test]
    fn graph_wire_shapes() {
        let reg = Registry::new();
        let h = reg.open_memory().unwrap();
        let run = |c: &str| reg.execute(h, c).unwrap_or_else(|e| format!("ERR: {e}"));

        eprintln!("Create   -> {}", run(r#"{"GraphCreate":{"graph":"social"}}"#));
        eprintln!("AddNode  -> {}", run(r#"{"GraphAddNode":{"graph":"social","node_id":"alice","object_type":"Person","properties":{"Object":{"name":{"String":"Alice"}}}}}"#));
        run(r#"{"GraphAddNode":{"graph":"social","node_id":"bob","object_type":"Person","properties":{"Object":{"name":{"String":"Bob"}}}}}"#);
        run(r#"{"GraphAddNode":{"graph":"social","node_id":"acme","object_type":"Company","properties":{"Object":{"name":{"String":"Acme"}}}}}"#);
        eprintln!("AddEdge  -> {}", run(r#"{"GraphAddEdge":{"graph":"social","src":"alice","dst":"bob","edge_type":"FOLLOWS"}}"#));
        run(r#"{"GraphAddEdge":{"graph":"social","src":"alice","dst":"acme","edge_type":"WORKS_AT"}}"#);
        eprintln!("List     -> {}", run(r#"{"GraphList":{}}"#));
        eprintln!("ListNodes-> {}", run(r#"{"GraphListNodes":{"graph":"social"}}"#));
        eprintln!("GetNode  -> {}", run(r#"{"GraphGetNode":{"graph":"social","node_id":"alice"}}"#));
        eprintln!("Neighbors-> {}", run(r#"{"GraphNeighbors":{"graph":"social","node_id":"alice","direction":"both"}}"#));
    }

    /// `init` writes a strata.toml and returns a working handle (replicates `strata init`).
    #[test]
    fn init_writes_config_and_opens() {
        let dir = std::env::temp_dir().join(format!("strata-init-{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&dir);
        let path = dir.join(".strata");
        let reg = Registry::new();

        let json = reg.init(path.to_str().unwrap()).expect("init");
        assert!(json.contains("\"handle\"") && json.contains("\"profile\""), "got: {json}");
        assert!(path.join("strata.toml").exists(), "strata.toml should be written");

        let v: serde_json::Value = serde_json::from_str(&json).unwrap();
        let h = v["handle"].as_u64().unwrap();
        assert!(reg.execute(h, r#"{"Ping":null}"#).unwrap().contains("Pong"));

        reg.close(h);
        let _ = std::fs::remove_dir_all(&dir);
    }

    /// Arrow export -> file -> re-import round-trip (requires the `arrow` feature).
    #[test]
    fn arrow_export_import_roundtrip() {
        let reg = Registry::new();
        let h = reg.open_memory().unwrap();
        let run = |c: &str| reg.execute(h, c).unwrap_or_else(|e| format!("ERR: {e}"));
        run(r#"{"KvPut":{"key":"user:alice","value":{"String":"Alice"}}}"#);
        run(r#"{"KvPut":{"key":"user:bob","value":{"String":"Bob"}}}"#);

        let inline = run(r#"{"DbExport":{"primitive":"kv","format":"jsonl"}}"#);
        eprintln!("Export inline -> {inline}");
        assert!(inline.contains("Exported") && inline.contains("row_count"), "got {inline}");

        let dir = std::env::temp_dir().join(format!("strata-arrow-{}", std::process::id()));
        let _ = std::fs::create_dir_all(&dir);
        let file = dir.join("kv.jsonl");
        let fp = serde_json::json!(file.to_str().unwrap());
        let exp = run(&format!(r#"{{"DbExport":{{"primitive":"kv","format":"jsonl","path":{fp}}}}}"#));
        eprintln!("Export file   -> {exp}");
        assert!(file.exists(), "export file should be written");

        let imp = run(&format!(r#"{{"ArrowImport":{{"file_path":{fp},"target":"kv","format":"jsonl"}}}}"#));
        eprintln!("Import        -> {imp}");
        assert!(imp.contains("ArrowImported") && imp.contains("rows_imported"), "got {imp}");

        reg.close(h);
        let _ = std::fs::remove_dir_all(&dir);
    }

    /// Captures inference wire shapes that need no model download (requires `embed`).
    /// Run: `cargo test inference_wire_shapes -- --nocapture`.
    #[test]
    fn inference_wire_shapes() {
        let reg = Registry::new();
        let h = reg.open_memory().unwrap();
        let run = |c: &str| reg.execute(h, c).unwrap_or_else(|e| format!("ERR: {e}"));
        eprintln!("ModelsList  -> {}", run(r#"{"ModelsList":null}"#));
        eprintln!("ModelsLocal -> {}", run(r#"{"ModelsLocal":null}"#));
        eprintln!("EmbedStatus -> {}", run(r#"{"EmbedStatus":null}"#));
        eprintln!("ConfigGet   -> {}", run(r#"{"ConfigGet":null}"#));
        eprintln!("ConfigSet   -> {}", run(r#"{"ConfigureSet":{"key":"embed_batch_size","value":"256"}}"#));
        eprintln!("ConfigKey   -> {}", run(r#"{"ConfigureGetKey":{"key":"embed_batch_size"}}"#));
    }

    /// Captures Search (keyword/BM25) wire shapes across primitives.
    /// Run: `cargo test search_wire_shapes -- --nocapture`.
    #[test]
    fn search_wire_shapes() {
        let reg = Registry::new();
        let h = reg.open_memory().unwrap();
        let run = |c: &str| reg.execute(h, c).unwrap_or_else(|e| format!("ERR: {e}"));
        run(r#"{"KvPut":{"key":"user:alice","value":{"Object":{"name":{"String":"Alice"},"role":{"String":"admin"}}}}}"#);
        run(r#"{"KvPut":{"key":"user:bob","value":{"Object":{"name":{"String":"Bob"},"role":{"String":"developer"}}}}}"#);
        run(r#"{"JsonSet":{"key":"doc:readme","path":"$","value":{"Object":{"title":{"String":"admin guide"}}}}}"#);
        run(r#"{"EventAppend":{"event_type":"login","payload":{"Object":{"user":{"String":"alice"}}}}}"#);

        eprintln!("Search kw   -> {}", run(r#"{"Search":{"search":{"query":"admin","recipe":"keyword","k":10}}}"#));
        eprintln!("Search def  -> {}", run(r#"{"Search":{"search":{"query":"alice","k":5}}}"#));
    }
}
