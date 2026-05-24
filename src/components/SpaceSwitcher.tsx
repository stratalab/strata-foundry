import { useEffect, useState, useCallback } from "react";
import { useDatabases } from "../state/databases";
import { spaceList, spaceCreate } from "../lib/space";

// Reuses the branch-switcher styles for a consistent context-selector look.
export function SpaceSwitcher() {
  const { active, setSpace } = useDatabases();
  const handle = active?.handle ?? null;
  const branch = active?.currentBranch ?? "default";
  const current = active?.currentSpace ?? "default";

  const [spaces, setSpaces] = useState<string[]>([]);
  const [open, setOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    if (handle === null) {
      setSpaces([]);
      return;
    }
    try {
      setSpaces(await spaceList(handle, branch));
    } catch {
      setSpaces([]);
    }
  }, [handle, branch]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  if (!active) return null;

  return (
    <div className="branch-switcher-wrap">
      <button
        className="branch-switcher"
        onClick={() => {
          setOpen((o) => !o);
          refresh();
        }}
      >
        ▦ {current} <span className="caret">▾</span>
      </button>
      {open && (
        <>
          <div className="menu-backdrop" onClick={() => setOpen(false)} />
          <div className="branch-menu">
            <div className="branch-menu-title">Switch space</div>
            {spaces.map((s) => (
              <button
                key={s}
                className={`branch-item ${s === current ? "active" : ""}`}
                onClick={() => {
                  setSpace(s);
                  setOpen(false);
                }}
              >
                ▦ {s}
                {s === current && <span className="check">✓</span>}
              </button>
            ))}
            <form
              className="branch-fork"
              onSubmit={async (e) => {
                e.preventDefault();
                if (handle === null || !newName.trim()) return;
                setBusy(true);
                try {
                  await spaceCreate(handle, newName.trim(), branch);
                  await refresh();
                  setSpace(newName.trim());
                  setNewName("");
                  setOpen(false);
                } finally {
                  setBusy(false);
                }
              }}
            >
              <input
                placeholder="new space name…"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
              />
              <button type="submit" disabled={!newName.trim() || busy}>
                Create
              </button>
            </form>
          </div>
        </>
      )}
    </div>
  );
}
