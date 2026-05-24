import { useState } from "react";
import { ConnectionProvider, useConnection } from "./state/connection";
import { Sidebar } from "./components/Sidebar";
import { KvView } from "./features/kv/KvView";
import "./App.css";

function Workspace() {
  const { status, error, openScratch, openAtPath, disconnect } = useConnection();
  const [active, setActive] = useState("kv");
  const [path, setPath] = useState("");

  return (
    <div className="app">
      <Sidebar active={active} onSelect={setActive} />
      <main className="main">
        <div className="topbar">
          <button onClick={openScratch} disabled={status === "connecting"}>
            Open scratch DB
          </button>
          <form
            className="open-form"
            onSubmit={(e) => {
              e.preventDefault();
              if (path.trim()) openAtPath(path.trim());
            }}
          >
            <input
              placeholder="/path/to/.strata"
              value={path}
              onChange={(e) => setPath(e.target.value)}
            />
            <button type="submit" disabled={!path.trim() || status === "connecting"}>
              Open
            </button>
          </form>
          {status === "connected" && (
            <button className="ghost" onClick={disconnect}>
              Close
            </button>
          )}
        </div>

        {error && <div className="error pad">{error}</div>}

        <div className="content">
          {status !== "connected" ? (
            <div className="empty">
              <h1>Strata Foundry</h1>
              <p className="muted">Open a database to begin.</p>
            </div>
          ) : active === "kv" ? (
            <KvView />
          ) : (
            <div className="empty">
              <p className="muted">This view isn’t built yet.</p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

function App() {
  return (
    <ConnectionProvider>
      <Workspace />
    </ConnectionProvider>
  );
}

export default App;
