import { useConnection } from "../state/connection";

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
  const { status, label } = useConnection();
  return (
    <nav className="sidebar">
      <div className="brand">Strata Foundry</div>
      <div className="conn">
        <span className={`dot ${status}`} />
        <span className="conn-label" title={label ?? undefined}>
          {label ?? "no database"}
        </span>
      </div>
      <ul className="nav-list">
        {SECTIONS.map((s) => (
          <li key={s.id}>
            <button
              className={`nav-item ${active === s.id ? "active" : ""}`}
              disabled={!s.ready || status !== "connected"}
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
