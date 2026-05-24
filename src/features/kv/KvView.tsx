import { useEffect, useState, useCallback } from "react";
import { useDatabases } from "../../state/databases";
import { kvList, kvGet, kvPut, kvDelete, kvHistory } from "../../lib/kv";
import type { VersionedValue } from "../../lib/kv";
import { valueType, toPlain, fromPlain } from "../../lib/value";
import { buildKeyTree } from "../../lib/keytree";
import { KeyTree } from "../../components/KeyTree";
import { JsonTree } from "../../components/JsonTree";

type Mode = "view" | "edit" | "add" | "history";

const fmtTs = (us: number) => new Date(us / 1000).toLocaleString();

export function KvView() {
  const { active } = useDatabases();
  const handle = active?.handle ?? null;
  const branch = active?.currentBranch;

  const [keys, setKeys] = useState<string[]>([]);
  const [filter, setFilter] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const [detail, setDetail] = useState<VersionedValue | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [mode, setMode] = useState<Mode>("view");
  const [editKey, setEditKey] = useState("");
  const [editText, setEditText] = useState("");
  const [editErr, setEditErr] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [history, setHistory] = useState<VersionedValue[]>([]);
  const [histSel, setHistSel] = useState<number | null>(null);

  const refresh = useCallback(async () => {
    if (handle === null) return;
    setLoading(true);
    setError(null);
    try {
      setKeys(await kvList(handle, branch));
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, [handle, branch]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Load the selected key's current value; reset transient panel state.
  useEffect(() => {
    setDeleting(false);
    if (handle === null || selected === null) {
      setDetail(null);
      return;
    }
    setMode((m) => (m === "add" ? "add" : "view"));
    let cancelled = false;
    kvGet(handle, selected, branch)
      .then((v) => !cancelled && setDetail(v))
      .catch(() => !cancelled && setDetail(null));
    return () => {
      cancelled = true;
    };
  }, [handle, selected, branch]);

  const shown = keys.filter((k) => k.toLowerCase().includes(filter.toLowerCase()));
  const tree = buildKeyTree(shown);

  function openAdd() {
    setEditKey("");
    setEditText('{\n  \n}');
    setEditErr(null);
    setMode("add");
  }
  function openEdit() {
    if (!selected || !detail) return;
    setEditKey(selected);
    setEditText(JSON.stringify(toPlain(detail.value), null, 2));
    setEditErr(null);
    setMode("edit");
  }

  async function save() {
    if (handle === null) return;
    const key = mode === "add" ? editKey.trim() : editKey;
    if (!key) return;
    let value;
    try {
      value = fromPlain(JSON.parse(editText));
    } catch (e) {
      setEditErr(`Invalid JSON: ${String(e)}`);
      return;
    }
    try {
      await kvPut(handle, key, value, branch);
      await refresh();
      setSelected(key);
      setMode("view");
    } catch (e) {
      setEditErr(String(e));
    }
  }

  async function del() {
    if (handle === null || selected === null) return;
    try {
      await kvDelete(handle, selected, branch);
      setSelected(null);
      setDeleting(false);
      await refresh();
    } catch (e) {
      setError(String(e));
    }
  }

  async function openHistory() {
    if (handle === null || selected === null) return;
    try {
      const h = await kvHistory(handle, selected, branch);
      setHistory(h);
      setHistSel(h[0]?.version ?? null);
      setMode("history");
    } catch (e) {
      setError(String(e));
    }
  }

  async function restore(v: VersionedValue) {
    if (handle === null || selected === null) return;
    try {
      await kvPut(handle, selected, v.value, branch);
      await refresh();
      const h = await kvHistory(handle, selected, branch);
      setHistory(h);
      setHistSel(h[0]?.version ?? null);
      const cur = await kvGet(handle, selected, branch);
      setDetail(cur);
    } catch (e) {
      setError(String(e));
    }
  }

  return (
    <div className="feature">
      <header className="feature-head">
        <h2>Key–Value</h2>
        <span className="muted">
          {shown.length} / {keys.length} keys · branch <code>{branch}</code>
        </span>
        <span className="grow" />
        <button onClick={openAdd}>Add key</button>
        <button className="ghost" onClick={refresh}>
          Refresh
        </button>
      </header>

      <div className="split">
        <div className="list-pane">
          <input
            className="filter"
            placeholder="Filter keys…"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          />
          {loading && <div className="muted pad">Loading…</div>}
          {error && <div className="error pad">{error}</div>}
          {!loading && !error && shown.length === 0 && <div className="muted pad">No keys</div>}
          <div className="tree-scroll">
            <KeyTree nodes={tree} selected={selected} onSelect={setSelected} />
          </div>
        </div>

        <div className="detail-pane">
          {mode === "add" || mode === "edit" ? (
            <div className="editor">
              <div className="detail-row">
                <span className="dk">key</span>
                {mode === "add" ? (
                  <input
                    className="grow"
                    placeholder="namespace:key"
                    value={editKey}
                    onChange={(e) => setEditKey(e.target.value)}
                  />
                ) : (
                  <code>{editKey}</code>
                )}
              </div>
              <span className="dk">value (JSON)</span>
              <textarea
                className="value-edit"
                spellCheck={false}
                value={editText}
                onChange={(e) => setEditText(e.target.value)}
              />
              {editErr && <div className="error">{editErr}</div>}
              <div className="editor-actions">
                <button onClick={save} disabled={mode === "add" && !editKey.trim()}>
                  Save
                </button>
                <button className="ghost" onClick={() => setMode("view")}>
                  Cancel
                </button>
              </div>
            </div>
          ) : mode === "history" && selected ? (
            <div className="history">
              <div className="detail-row">
                <span className="dk">history</span>
                <code>{selected}</code>
                <span className="grow" />
                <button className="ghost" onClick={() => setMode("view")}>
                  ← back
                </button>
              </div>
              <div className="muted" style={{ paddingBottom: 8 }}>
                {history.length} versions on branch <code>{branch}</code>
              </div>
              {history.map((v) => (
                <div
                  key={v.version}
                  className={`hist-entry ${histSel === v.version ? "active" : ""}`}
                  onClick={() => setHistSel(v.version)}
                >
                  <div className="hist-head">
                    <span className="badge">v{v.version}</span>
                    <span className="muted">{fmtTs(v.timestamp)}</span>
                    <span className="grow" />
                    <button
                      className="ghost tiny"
                      onClick={(e) => {
                        e.stopPropagation();
                        restore(v);
                      }}
                    >
                      Restore
                    </button>
                  </div>
                  {histSel === v.version && (
                    <div className="json-view">
                      <JsonTree value={v.value} />
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : selected === null ? (
            <div className="muted pad">Select a key to inspect</div>
          ) : detail === null ? (
            <div className="muted pad">Key not found on this branch</div>
          ) : (
            <>
              <div className="detail-row">
                <span className="dk">key</span>
                <code>{selected}</code>
              </div>
              <div className="detail-row">
                <span className="dk">type</span>
                <span className="badge">{valueType(detail.value)}</span>
              </div>
              <div className="detail-row">
                <span className="dk">version</span>
                <span>v{detail.version}</span>
              </div>
              <div className="detail-row">
                <span className="dk">updated</span>
                <span>{fmtTs(detail.timestamp)}</span>
              </div>
              <div className="detail-actions">
                <button className="ghost" onClick={openEdit}>
                  Edit
                </button>
                <button className="ghost" onClick={openHistory}>
                  History
                </button>
                {deleting ? (
                  <span className="confirm">
                    Delete?
                    <button className="danger" onClick={del}>
                      Yes
                    </button>
                    <button className="ghost" onClick={() => setDeleting(false)}>
                      No
                    </button>
                  </span>
                ) : (
                  <button className="ghost danger-text" onClick={() => setDeleting(true)}>
                    Delete
                  </button>
                )}
              </div>
              <div className="json-view">
                <JsonTree value={detail.value} />
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
