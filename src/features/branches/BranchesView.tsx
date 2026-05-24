import { useEffect, useState, useCallback } from "react";
import { useDatabases } from "../../state/databases";
import {
  branchList,
  branchFork,
  branchDiff,
  branchMerge,
  branchCherryPick,
} from "../../lib/branch";
import type { BranchInfo, BranchDiffResult, DiffEntry, MergeStrategy } from "../../lib/branch";
import { DiffView } from "../../components/DiffView";

function BranchSelect({
  value,
  onChange,
  branches,
}: {
  value: string;
  onChange: (v: string) => void;
  branches: BranchInfo[];
}) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)}>
      {branches.map((b) => (
        <option key={b.id} value={b.id}>
          {b.id}
        </option>
      ))}
    </select>
  );
}

export function BranchesView() {
  const { active } = useDatabases();
  const handle = active?.handle ?? null;
  const supports = active?.supportsBranching ?? false;

  const [branches, setBranches] = useState<BranchInfo[]>([]);
  const [forkSource, setForkSource] = useState("default");
  const [forkName, setForkName] = useState("");
  const [diffA, setDiffA] = useState("default");
  const [diffB, setDiffB] = useState("default");
  const [mergeSource, setMergeSource] = useState("default");
  const [mergeTarget, setMergeTarget] = useState("default");
  const [strategy, setStrategy] = useState<MergeStrategy>("LastWriterWins");
  const [diff, setDiff] = useState<BranchDiffResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (handle === null || !supports) {
      setBranches([]);
      return;
    }
    try {
      const list = await branchList(handle);
      setBranches(list);
      const ids = list.map((b) => b.id);
      const pick = (cur: string, fallback: string) => (ids.includes(cur) ? cur : fallback);
      const first = ids[0] ?? "default";
      const second = ids[1] ?? first;
      setForkSource((c) => pick(c, first));
      setDiffA((c) => pick(c, first));
      setDiffB((c) => pick(c, second));
      setMergeSource((c) => pick(c, second));
      setMergeTarget((c) => pick(c, first));
    } catch (e) {
      setErr(String(e));
    }
  }, [handle, supports]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  if (!active) return null;

  if (!supports) {
    return (
      <div className="feature">
        <header className="feature-head">
          <h2>Branches</h2>
        </header>
        <div className="empty">
          <p className="muted">
            This is a scratch (in-memory) database. Branching needs a disk-backed
            database — open one with “New disk DB”.
          </p>
        </div>
      </div>
    );
  }

  async function withBusy(label: string, fn: () => Promise<string>) {
    setBusy(true);
    setMsg(null);
    setErr(null);
    try {
      setMsg(await fn());
      await refresh();
    } catch (e) {
      setErr(`${label} failed: ${String(e)}`);
    } finally {
      setBusy(false);
    }
  }

  const runFork = () =>
    withBusy("Fork", async () => {
      if (handle === null || !forkName.trim()) return "";
      const r = await branchFork(handle, forkSource, forkName.trim());
      const name = forkName.trim();
      setForkName("");
      return `Forked ${forkSource} → ${name} (${r.keys_copied} keys copied).`;
    });

  const runDiff = async () => {
    if (handle === null) return;
    setBusy(true);
    setErr(null);
    setMsg(null);
    try {
      setDiff(await branchDiff(handle, diffA, diffB));
    } catch (e) {
      setErr(`Diff failed: ${String(e)}`);
    } finally {
      setBusy(false);
    }
  };

  const runMerge = () =>
    withBusy("Merge", async () => {
      if (handle === null) return "";
      const r = await branchMerge(handle, mergeSource, mergeTarget, strategy);
      const conflicts = r.conflicts.length;
      return `Merged ${mergeSource} → ${mergeTarget}: ${r.keys_applied} applied, ${r.keys_deleted} deleted${
        conflicts ? `, ${conflicts} conflict(s)` : ""
      }.`;
    });

  const cherryPick = (entry: DiffEntry) =>
    withBusy("Cherry-pick", async () => {
      if (handle === null || diff === null) return "";
      const r = await branchCherryPick(handle, diff.branch_b, diff.branch_a, [
        [entry.space, entry.key],
      ]);
      if (diff) setDiff(await branchDiff(handle, diff.branch_a, diff.branch_b));
      return `Cherry-picked ${entry.key} from ${diff.branch_b} → ${diff.branch_a} (${r.keys_applied} applied).`;
    });

  return (
    <div className="feature branches">
      <header className="feature-head">
        <h2>Branches</h2>
        <span className="muted">{branches.length} branches</span>
        <button className="ghost" onClick={refresh}>
          Refresh
        </button>
      </header>

      <div className="branches-body">
        <div className="branch-chips">
          {branches.map((b) => (
            <div key={b.id} className="branch-chip" title={`status: ${b.status}`}>
              <span className="branch-glyph">⎇</span>
              <span className="branch-name">{b.id}</span>
              {b.parent_id && <span className="branch-parent">from {b.parent_id}</span>}
            </div>
          ))}
        </div>

        <div className="ops-grid">
          <section className="op-card">
            <h3>Fork</h3>
            <div className="op-row">
              <BranchSelect value={forkSource} onChange={setForkSource} branches={branches} />
              <span className="arrow">→</span>
              <input
                placeholder="new-branch"
                value={forkName}
                onChange={(e) => setForkName(e.target.value)}
              />
              <button onClick={runFork} disabled={busy || !forkName.trim()}>
                Fork
              </button>
            </div>
          </section>

          <section className="op-card">
            <h3>Merge</h3>
            <div className="op-row">
              <BranchSelect value={mergeSource} onChange={setMergeSource} branches={branches} />
              <span className="arrow">→</span>
              <BranchSelect value={mergeTarget} onChange={setMergeTarget} branches={branches} />
              <select value={strategy} onChange={(e) => setStrategy(e.target.value as MergeStrategy)}>
                <option value="LastWriterWins">last-writer-wins</option>
                <option value="Strict">strict</option>
              </select>
              <button onClick={runMerge} disabled={busy || mergeSource === mergeTarget}>
                Merge
              </button>
            </div>
          </section>
        </div>

        <section className="op-card diff-card">
          <div className="op-row">
            <h3>Diff</h3>
            <BranchSelect value={diffA} onChange={setDiffA} branches={branches} />
            <span className="arrow">↔</span>
            <BranchSelect value={diffB} onChange={setDiffB} branches={branches} />
            <button onClick={runDiff} disabled={busy || diffA === diffB}>
              Compare
            </button>
          </div>
          {diff && <DiffView diff={diff} onCherryPick={cherryPick} />}
        </section>

        {msg && <div className="op-msg">{msg}</div>}
        {err && <div className="op-msg error">{err}</div>}
      </div>
    </div>
  );
}
