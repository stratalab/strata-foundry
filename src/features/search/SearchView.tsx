import { useState } from "react";
import { useDatabases } from "../../state/databases";
import { search } from "../../lib/search";
import type { SearchResults } from "../../lib/search";

export function SearchView() {
  const { active } = useDatabases();
  const handle = active?.handle ?? null;
  const branch = active?.currentBranch;
  const space = active?.currentSpace;

  const [query, setQuery] = useState("");
  const [recipe, setRecipe] = useState("default");
  const [k, setK] = useState(20);
  const [results, setResults] = useState<SearchResults | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    if (handle === null || !query.trim()) return;
    setBusy(true);
    setError(null);
    try {
      setResults(await search(handle, { query: query.trim(), recipe, k }, branch, space));
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="feature">
      <header className="feature-head">
        <h2>Search</h2>
        <span className="muted">
          across all primitives · <code>{branch}</code>/<code>{space}</code>
        </span>
      </header>

      <div className="search-body">
        <form
          className="search-bar"
          onSubmit={(e) => {
            e.preventDefault();
            run();
          }}
        >
          <input
            className="search-input"
            placeholder="Search KV, JSON, events, vectors, graph…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoFocus
          />
          <select value={recipe} onChange={(e) => setRecipe(e.target.value)} title="recipe">
            <option value="default">default</option>
            <option value="keyword">keyword</option>
            <option value="hybrid">hybrid</option>
          </select>
          <input
            type="number"
            value={k}
            onChange={(e) => setK(parseInt(e.target.value, 10) || 10)}
            style={{ width: 64 }}
            title="results"
          />
          <button type="submit" disabled={busy || !query.trim()}>
            {busy ? "…" : "Search"}
          </button>
        </form>

        {error && <div className="error pad">{error}</div>}

        {results && (
          <>
            <div className="muted search-stats">
              {results.hits.length} hits · {results.stats.mode}
              {results.stats.elapsed_ms ? ` · ${results.stats.elapsed_ms.toFixed(1)} ms` : ""}
              {results.stats.index_used ? " · indexed" : ""}
            </div>
            {results.hits.length === 0 && <div className="muted pad">No results.</div>}
            {results.hits.map((h) => (
              <div className="search-hit" key={`${h.kind}:${h.id}:${h.rank}`}>
                <div className="hit-head">
                  <span className="hit-rank">{h.rank}</span>
                  <span className="badge">{h.kind}</span>
                  <code>{h.id}</code>
                  {h.space && h.space !== "default" && <span className="muted">· {h.space}</span>}
                  <span className="grow" />
                  <span className="muted">{h.score.toFixed(3)}</span>
                </div>
                {h.snippet && <div className="hit-snippet">{h.snippet}</div>}
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  );
}
