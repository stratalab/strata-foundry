import { useState } from "react";
import { openMemory, execute, ping } from "./lib/strata";
import "./App.css";

function App() {
  const [log, setLog] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  const append = (line: string) => setLog((l) => [...l, line]);

  async function runSmokeTest() {
    setBusy(true);
    setLog([]);
    try {
      append(`bridge: ${await ping()}`);
      const handle = await openMemory();
      append(`opened scratch db → handle ${handle}`);
      append(`Ping → ${JSON.stringify(await execute(handle, { Ping: null }))}`);
      append(`Info → ${JSON.stringify(await execute(handle, { Info: null }))}`);
    } catch (e) {
      append(`error: ${String(e)}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="container">
      <h1>Strata Foundry</h1>
      <p>
        Tauri + React shell. The Rust backend bridges directly to{" "}
        <code>stratadb</code> — no FFI layer.
      </p>
      <button onClick={runSmokeTest} disabled={busy}>
        {busy ? "Running…" : "Open scratch DB & run smoke test"}
      </button>
      <pre style={{ textAlign: "left", marginTop: 16 }}>{log.join("\n")}</pre>
    </main>
  );
}

export default App;
