import { useEffect, useState, useCallback } from "react";
import { useConnection } from "../../state/connection";
import { kvList, kvGet } from "../../lib/kv";
import type { VersionedValue } from "../../lib/kv";
import { valueType, toPlain } from "../../lib/value";

export function KvView() {
  const { handle } = useConnection();
  const [keys, setKeys] = useState<string[]>([]);
  const [filter, setFilter] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const [detail, setDetail] = useState<VersionedValue | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (handle === null) return;
    setLoading(true);
    setError(null);
    try {
      setKeys(await kvList(handle));
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, [handle]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (handle === null || selected === null) {
      setDetail(null);
      return;
    }
    let cancelled = false;
    kvGet(handle, selected)
      .then((v) => {
        if (!cancelled) setDetail(v);
      })
      .catch(() => {
        if (!cancelled) setDetail(null);
      });
    return () => {
      cancelled = true;
    };
  }, [handle, selected]);

  const shown = keys.filter((k) => k.toLowerCase().includes(filter.toLowerCase()));

  return (
    <div className="feature">
      <header className="feature-head">
        <h2>Key–Value</h2>
        <span className="muted">
          {shown.length} / {keys.length} keys
        </span>
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
          {!loading && !error && shown.length === 0 && (
            <div className="muted pad">No keys</div>
          )}
          <ul className="key-list">
            {shown.map((k) => (
              <li key={k}>
                <button
                  className={`key ${selected === k ? "active" : ""}`}
                  onClick={() => setSelected(k)}
                >
                  {k}
                </button>
              </li>
            ))}
          </ul>
        </div>

        <div className="detail-pane">
          {selected === null ? (
            <div className="muted pad">Select a key to inspect</div>
          ) : detail === null ? (
            <div className="muted pad">Key not found</div>
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
                <span>{new Date(detail.timestamp / 1000).toLocaleString()}</span>
              </div>
              <pre className="value-box">
                {JSON.stringify(toPlain(detail.value), null, 2)}
              </pre>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
