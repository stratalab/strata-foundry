import { useEffect, useState, useCallback } from "react";
import { useDatabases } from "../state/databases";
import { branchList, branchFork } from "../lib/branch";

export function BranchSwitcher() {
  const { active, setBranch } = useDatabases();
  const handle = active?.handle ?? null;
  const supports = active?.supportsBranching ?? false;
  const current = active?.currentBranch ?? "default";

  const [branches, setBranches] = useState<string[]>([]);
  const [open, setOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    if (handle === null || !supports) {
      setBranches([]);
      return;
    }
    try {
      setBranches((await branchList(handle)).map((b) => b.id));
    } catch {
      setBranches([]);
    }
  }, [handle, supports]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  if (!active) return null;

  if (!supports) {
    return (
      <div className="branch-switcher disabled" title="Branching requires a disk-backed database">
        ⎇ default
      </div>
    );
  }

  return (
    <div className="branch-switcher-wrap">
      <button
        className="branch-switcher"
        onClick={() => {
          setOpen((o) => !o);
          refresh();
        }}
      >
        ⎇ {current} <span className="caret">▾</span>
      </button>
      {open && (
        <>
          <div className="menu-backdrop" onClick={() => setOpen(false)} />
          <div className="branch-menu">
            <div className="branch-menu-title">Switch branch</div>
            {branches.map((b) => (
              <button
                key={b}
                className={`branch-item ${b === current ? "active" : ""}`}
                onClick={() => {
                  setBranch(b);
                  setOpen(false);
                }}
              >
                ⎇ {b}
                {b === current && <span className="check">✓</span>}
              </button>
            ))}
            <form
              className="branch-fork"
              onSubmit={async (e) => {
                e.preventDefault();
                if (handle === null || !newName.trim()) return;
                setBusy(true);
                try {
                  await branchFork(handle, current, newName.trim());
                  await refresh();
                  setBranch(newName.trim());
                  setNewName("");
                  setOpen(false);
                } finally {
                  setBusy(false);
                }
              }}
            >
              <input
                placeholder="new branch from current…"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
              />
              <button type="submit" disabled={!newName.trim() || busy}>
                Fork
              </button>
            </form>
          </div>
        </>
      )}
    </div>
  );
}
