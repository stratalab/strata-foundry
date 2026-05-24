import { useEffect, useState, useCallback } from "react";
import { useDatabases } from "../../state/databases";
import {
  vectorListCollections,
  vectorCreateCollection,
  vectorDeleteCollection,
  vectorUpsert,
  vectorQuery,
  vectorGet,
} from "../../lib/vector";
import type { VectorCollection, VectorMatch, VectorData, DistanceMetric } from "../../lib/vector";
import { fromPlain } from "../../lib/value";
import { JsonTree } from "../../components/JsonTree";
import type { StrataValue } from "../../lib/types";

const parseVec = (s: string): number[] =>
  s
    .split(",")
    .map((x) => parseFloat(x.trim()))
    .filter((x) => !Number.isNaN(x));

export function VectorView() {
  const { active } = useDatabases();
  const handle = active?.handle ?? null;
  const branch = active?.currentBranch;
  const space = active?.currentSpace;

  const [collections, setCollections] = useState<VectorCollection[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [opErr, setOpErr] = useState<string | null>(null);

  const [queryText, setQueryText] = useState("");
  const [k, setK] = useState(5);
  const [matches, setMatches] = useState<VectorMatch[] | null>(null);
  const [detail, setDetail] = useState<VectorData | null>(null);

  const [newName, setNewName] = useState("");
  const [newDim, setNewDim] = useState(4);
  const [newMetric, setNewMetric] = useState<DistanceMetric>("cosine");

  const [addOpen, setAddOpen] = useState(false);
  const [addKey, setAddKey] = useState("");
  const [addVec, setAddVec] = useState("");
  const [addMeta, setAddMeta] = useState("{}");

  const refresh = useCallback(async () => {
    if (handle === null) return;
    setLoading(true);
    setError(null);
    try {
      const cols = await vectorListCollections(handle, branch, space);
      setCollections(cols);
      setSelected((prev) => (cols.find((c) => c.name === prev) ? prev : (cols[0]?.name ?? null)));
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, [handle, branch, space]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    setMatches(null);
    setDetail(null);
    setOpErr(null);
  }, [selected]);

  const current = collections.find((c) => c.name === selected) ?? null;

  async function search() {
    if (handle === null || !current) return;
    setOpErr(null);
    const q = parseVec(queryText);
    if (q.length !== current.dimension) {
      setOpErr(`Query needs ${current.dimension} numbers (got ${q.length}).`);
      return;
    }
    try {
      setMatches(await vectorQuery(handle, current.name, q, k, branch, space));
      setDetail(null);
    } catch (e) {
      setOpErr(String(e));
    }
  }

  async function showMatch(key: string) {
    if (handle === null || !current) return;
    try {
      setDetail(await vectorGet(handle, current.name, key, branch, space));
    } catch {
      setDetail(null);
    }
  }

  async function createCollection() {
    if (handle === null || !newName.trim()) return;
    setOpErr(null);
    try {
      await vectorCreateCollection(handle, newName.trim(), newDim, newMetric, branch, space);
      const name = newName.trim();
      setNewName("");
      await refresh();
      setSelected(name);
    } catch (e) {
      setOpErr(String(e));
    }
  }

  async function deleteCollection() {
    if (handle === null || !current) return;
    try {
      await vectorDeleteCollection(handle, current.name, branch, space);
      await refresh();
    } catch (e) {
      setOpErr(String(e));
    }
  }

  async function addVector() {
    if (handle === null || !current || !addKey.trim()) return;
    setOpErr(null);
    const v = parseVec(addVec);
    if (v.length !== current.dimension) {
      setOpErr(`Vector needs ${current.dimension} numbers (got ${v.length}).`);
      return;
    }
    let meta: StrataValue | null = null;
    try {
      const parsed = JSON.parse(addMeta || "{}");
      meta = fromPlain(parsed);
    } catch (e) {
      setOpErr(`Invalid metadata JSON: ${String(e)}`);
      return;
    }
    try {
      await vectorUpsert(handle, current.name, addKey.trim(), v, meta, branch, space);
      setAddOpen(false);
      setAddKey("");
      setAddVec("");
      setAddMeta("{}");
      await refresh();
    } catch (e) {
      setOpErr(String(e));
    }
  }

  return (
    <div className="feature">
      <header className="feature-head">
        <h2>Vectors</h2>
        <span className="muted">
          {collections.length} collections · <code>{branch}</code> / <code>{space}</code>
        </span>
        <span className="grow" />
        <button className="ghost" onClick={refresh}>
          Refresh
        </button>
      </header>

      <div className="split">
        <div className="list-pane">
          <div className="tree-scroll" style={{ padding: 8 }}>
            {loading && <div className="muted pad">Loading…</div>}
            {error && <div className="error pad">{error}</div>}
            {!loading && collections.length === 0 && (
              <div className="muted pad">No collections</div>
            )}
            {collections.map((c) => (
              <button
                key={c.name}
                className={`coll-item ${selected === c.name ? "active" : ""}`}
                onClick={() => setSelected(c.name)}
              >
                <div className="coll-name">{c.name}</div>
                <div className="coll-meta">
                  {c.dimension}d · {c.metric} · {c.count} vec
                </div>
              </button>
            ))}
          </div>
          <form
            className="coll-new"
            onSubmit={(e) => {
              e.preventDefault();
              createCollection();
            }}
          >
            <input
              placeholder="new collection"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
            />
            <div className="coll-new-row">
              <input
                type="number"
                min={1}
                value={newDim}
                onChange={(e) => setNewDim(parseInt(e.target.value, 10) || 1)}
                title="dimension"
              />
              <select value={newMetric} onChange={(e) => setNewMetric(e.target.value as DistanceMetric)}>
                <option value="cosine">cosine</option>
                <option value="euclidean">euclidean</option>
                <option value="dot_product">dot</option>
              </select>
              <button type="submit" disabled={!newName.trim()}>
                Create
              </button>
            </div>
          </form>
        </div>

        <div className="detail-pane">
          {!current ? (
            <div className="muted pad">Select or create a collection</div>
          ) : (
            <>
              <div className="detail-row">
                <span className="dk">collection</span>
                <code>{current.name}</code>
              </div>
              <div className="detail-row">
                <span className="dk">config</span>
                <span>
                  {current.dimension}-dim · {current.metric} · {current.count} vectors ·{" "}
                  {current.index_type}
                </span>
              </div>
              <div className="detail-actions">
                <button className="ghost" onClick={() => setAddOpen((o) => !o)}>
                  {addOpen ? "Cancel" : "Add vector"}
                </button>
                <button className="ghost danger-text" onClick={deleteCollection}>
                  Delete collection
                </button>
              </div>

              {addOpen && (
                <div className="editor">
                  <input
                    placeholder="key"
                    value={addKey}
                    onChange={(e) => setAddKey(e.target.value)}
                  />
                  <input
                    placeholder={`vector — ${current.dimension} comma-separated floats`}
                    value={addVec}
                    onChange={(e) => setAddVec(e.target.value)}
                  />
                  <textarea
                    className="value-edit"
                    style={{ minHeight: 70 }}
                    spellCheck={false}
                    placeholder="metadata JSON (optional)"
                    value={addMeta}
                    onChange={(e) => setAddMeta(e.target.value)}
                  />
                  <div className="editor-actions">
                    <button onClick={addVector} disabled={!addKey.trim()}>
                      Add
                    </button>
                  </div>
                </div>
              )}

              <div className="vec-search">
                <span className="dk">nearest-neighbour search</span>
                <div className="op-row">
                  <input
                    className="grow"
                    placeholder={`query — ${current.dimension} comma-separated floats`}
                    value={queryText}
                    onChange={(e) => setQueryText(e.target.value)}
                  />
                  <input
                    type="number"
                    min={1}
                    value={k}
                    onChange={(e) => setK(parseInt(e.target.value, 10) || 1)}
                    title="k (neighbours)"
                    style={{ width: 60 }}
                  />
                  <button onClick={search}>Search</button>
                </div>
              </div>

              {opErr && <div className="error pad">{opErr}</div>}

              {matches && (
                <div className="vec-matches">
                  {matches.length === 0 && <div className="muted pad">No matches</div>}
                  {matches.map((m) => (
                    <div key={m.key} className="vec-match" onClick={() => showMatch(m.key)}>
                      <div className="vec-match-head">
                        <code>{m.key}</code>
                        <span className="grow" />
                        <span className="muted">{m.score.toFixed(4)}</span>
                      </div>
                      <div className="score-bar">
                        <div
                          className="score-fill"
                          style={{ width: `${Math.max(0, Math.min(1, m.score)) * 100}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {detail && (
                <div className="json-view">
                  <div className="dk">
                    vector <code>{detail.key}</code> · v{detail.version}
                  </div>
                  <div className="vec-embedding">[{detail.embedding.join(", ")}]</div>
                  {detail.metadata && <JsonTree value={detail.metadata} />}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
