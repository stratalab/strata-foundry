import { useState } from "react";
import { DatabasesProvider, useDatabases } from "./state/databases";
import { Sidebar } from "./components/Sidebar";
import { BranchSwitcher } from "./components/BranchSwitcher";
import { SpaceSwitcher } from "./components/SpaceSwitcher";
import { KvView } from "./features/kv/KvView";
import { BranchesView } from "./features/branches/BranchesView";
import { EventsView } from "./features/events/EventsView";
import { JsonView } from "./features/json/JsonView";
import "./App.css";

function TabBar() {
  const { dbs, activeId, setActive, closeDb, openScratch } = useDatabases();
  if (dbs.length === 0) return null;
  return (
    <div className="tabbar">
      {dbs.map((db) => (
        <div
          key={db.id}
          className={`tab ${db.id === activeId ? "active" : ""}`}
          onClick={() => setActive(db.id)}
          title={db.kind === "scratch" ? "in-memory (no branching)" : db.label}
        >
          <span className={`tab-dot ${db.kind}`} />
          <span className="tab-label">{db.label}</span>
          <button
            className="tab-close"
            onClick={(e) => {
              e.stopPropagation();
              closeDb(db.id);
            }}
          >
            ×
          </button>
        </div>
      ))}
      <button className="tab-add" onClick={openScratch} title="New scratch database">
        +
      </button>
    </div>
  );
}

function Workspace() {
  const { active, opening, error, openScratch, openDiskDemo, openAtPath, closeDb } =
    useDatabases();
  const [section, setSection] = useState("kv");
  const [path, setPath] = useState("");

  return (
    <div className="app">
      <Sidebar active={section} onSelect={setSection} />
      <main className="main">
        <TabBar />
        <div className="topbar">
          <button onClick={openScratch} disabled={opening}>
            Open scratch DB
          </button>
          <button className="ghost" onClick={openDiskDemo} disabled={opening}>
            New disk DB
          </button>
          <form
            className="open-form"
            onSubmit={(e) => {
              e.preventDefault();
              if (path.trim()) {
                openAtPath(path.trim());
                setPath("");
              }
            }}
          >
            <input
              placeholder="/path/to/project/.strata"
              value={path}
              onChange={(e) => setPath(e.target.value)}
            />
            <button type="submit" disabled={!path.trim() || opening}>
              Open
            </button>
          </form>
          <span className="grow" />
          {active && <SpaceSwitcher />}
          {active && <BranchSwitcher />}
          {active && (
            <button className="ghost" onClick={() => closeDb(active.id)}>
              Close
            </button>
          )}
        </div>

        {error && <div className="error pad">{error}</div>}

        <div className="content">
          {!active ? (
            <div className="empty">
              <h1>Strata Foundry</h1>
              <p className="muted">Open a database to begin.</p>
            </div>
          ) : section === "branches" ? (
            <BranchesView key={active.id} />
          ) : section === "kv" ? (
            <KvView key={active.id} />
          ) : section === "event" ? (
            <EventsView key={active.id} />
          ) : section === "json" ? (
            <JsonView key={active.id} />
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
    <DatabasesProvider>
      <Workspace />
    </DatabasesProvider>
  );
}

export default App;
