import { useDatabases } from "../state/databases";

export interface Section {
  id: string;
  label: string;
  ready: boolean;
}

/** Strata primitives. `ready` flags which feature views are built so far. */
export const SECTIONS: Section[] = [
  { id: "kv", label: "Key–Value", ready: true },
  { id: "event", label: "Events", ready: false },
  { id: "json", label: "JSON", ready: false },
  { id: "vector", label: "Vectors", ready: false },
  { id: "graph", label: "Graph", ready: false },
  { id: "search", label: "Search", ready: false },
  { id: "branches", label: "Branches", ready: false },
];

export function Sidebar({
  active,
  onSelect,
}: {
  active: string;
  onSelect: (id: string) => void;
}) {
  const { active: db } = useDatabases();
  const connected = db !== null;
  return (
    <nav className="sidebar">
      <div className="brand">Strata Foundry</div>
      <div className="conn">
        <span className={`dot ${connected ? "connected" : ""}`} />
        <span className="conn-label" title={db?.label ?? undefined}>
          {db?.label ?? "no database"}
        </span>
      </div>
      <ul className="nav-list">
        {SECTIONS.map((s) => (
          <li key={s.id}>
            <button
              className={`nav-item ${active === s.id ? "active" : ""}`}
              disabled={!s.ready || !connected}
              onClick={() => onSelect(s.id)}
            >
              <span>{s.label}</span>
              {!s.ready && <span className="soon">soon</span>}
            </button>
          </li>
        ))}
      </ul>
    </nav>
  );
}
