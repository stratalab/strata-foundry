import { useState } from "react";
import { useDatabases } from "../state/databases";

/** Append "/.strata" unless the path already points at one. */
function ensureStrata(p: string): string {
  const t = p.trim().replace(/\/+$/, "");
  return t.endsWith(".strata") ? t : `${t}/.strata`;
}

export function Welcome() {
  const { openScratch, openAtPath, initDatabase, recents, opening, error } = useDatabases();
  const [createPath, setCreatePath] = useState("");
  const [seed, setSeed] = useState(true);
  const [openPath, setOpenPath] = useState("");

  return (
    <div className="welcome">
      <div className="welcome-inner">
        <div className="welcome-logo">◆</div>
        <h1>Welcome to Strata Foundry</h1>
        <p className="muted welcome-tagline">
          A desktop workspace for StrataDB — key–value, events, JSON, vectors, graph, with
          branches, spaces, and time-travel.
        </p>

        <div className="welcome-cards">
          <section className="welcome-card">
            <h3>Create a database</h3>
            <p className="muted">
              Initialize a new <code>.strata</code> database — writes a hardware-tuned config, just
              like <code>strata init</code>.
            </p>
            <input
              placeholder="/path/to/my-database"
              value={createPath}
              onChange={(e) => setCreatePath(e.target.value)}
            />
            <label className="check-row">
              <input type="checkbox" checked={seed} onChange={(e) => setSeed(e.target.checked)} />
              Load sample data
            </label>
            <button
              disabled={!createPath.trim() || opening}
              onClick={() => initDatabase(ensureStrata(createPath), seed)}
            >
              Create database
            </button>
          </section>

          <section className="welcome-card">
            <h3>Open existing</h3>
            <p className="muted">
              Open a <code>.strata</code> directory you already have.
            </p>
            <input
              placeholder="/path/to/existing/.strata"
              value={openPath}
              onChange={(e) => setOpenPath(e.target.value)}
            />
            <button
              disabled={!openPath.trim() || opening}
              onClick={() => openAtPath(ensureStrata(openPath))}
            >
              Open
            </button>
          </section>

          <section className="welcome-card">
            <h3>Quick sandbox</h3>
            <p className="muted">
              An in-memory scratch database, seeded with sample data. Nothing is written to disk
              (no branching).
            </p>
            <button className="ghost" disabled={opening} onClick={openScratch}>
              Open scratch DB
            </button>
          </section>
        </div>

        {recents.length > 0 && (
          <div className="welcome-recents">
            <div className="dk">Recent</div>
            {recents.map((p) => (
              <button key={p} className="recent-item" onClick={() => openAtPath(p)} title={p}>
                {p}
              </button>
            ))}
          </div>
        )}

        {error && <div className="error pad">{error}</div>}
      </div>
    </div>
  );
}
