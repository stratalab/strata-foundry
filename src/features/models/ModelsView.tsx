import { useEffect, useState, useCallback } from "react";
import { useDatabases } from "../../state/databases";
import { modelsList, modelsPull } from "../../lib/inference";
import type { ModelInfo } from "../../lib/inference";

const fmtBytes = (b: number) => (b >= 1e9 ? `${(b / 1e9).toFixed(1)} GB` : `${Math.round(b / 1e6)} MB`);
const TASK_ORDER: Array<[string, string]> = [
  ["Embed", "Embedding"],
  ["Rank", "Reranking"],
  ["Generate", "Generation"],
];

export function ModelsView() {
  const { active } = useDatabases();
  const handle = active?.handle ?? null;
  const [models, setModels] = useState<ModelInfo[]>([]);
  const [pulling, setPulling] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (handle === null) return;
    try {
      setModels(await modelsList(handle));
    } catch (e) {
      setError(String(e));
    }
  }, [handle]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  async function download(name: string) {
    if (handle === null) return;
    setPulling(name);
    setError(null);
    setMsg(null);
    try {
      await modelsPull(handle, name);
      setMsg(`Downloaded ${name}.`);
      await refresh();
    } catch (e) {
      setError(String(e));
    } finally {
      setPulling(null);
    }
  }

  const localCount = models.filter((m) => m.is_local).length;

  return (
    <div className="feature">
      <header className="feature-head">
        <h2>Models</h2>
        <span className="muted">
          {localCount} of {models.length} downloaded · from Strata's model hub
        </span>
        <span className="grow" />
        <button className="ghost" onClick={refresh}>
          Refresh
        </button>
      </header>

      <div className="io-body">
        {error && <div className="error pad">{error}</div>}
        {msg && <div className="op-msg">{msg}</div>}

        {TASK_ORDER.map(([task, label]) => {
          const list = models.filter((m) => m.task === task);
          if (list.length === 0) return null;
          return (
            <section className="op-card" key={task}>
              <h3>{label}</h3>
              <table className="model-table">
                <thead>
                  <tr>
                    <th>name</th>
                    <th>arch</th>
                    <th>size</th>
                    <th>{task === "Embed" ? "dim" : ""}</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {list.map((m) => (
                    <tr key={m.name}>
                      <td>
                        <code>{m.name}</code>
                      </td>
                      <td className="muted">{m.architecture}</td>
                      <td className="muted">{fmtBytes(m.size_bytes)}</td>
                      <td className="muted">{task === "Embed" ? m.embedding_dim : ""}</td>
                      <td>
                        {pulling === m.name ? (
                          <div className="progress-bar" title="downloading…">
                            <div className="progress-indeterminate" />
                          </div>
                        ) : m.is_local ? (
                          <span className="badge">downloaded</span>
                        ) : (
                          <button
                            className="ghost tiny"
                            disabled={pulling !== null}
                            onClick={() => download(m.name)}
                          >
                            Download
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          );
        })}

        {pulling && (
          <div className="muted pad">
            Downloading {pulling}
            {(() => {
              const m = models.find((x) => x.name === pulling);
              return m ? ` (${fmtBytes(m.size_bytes)})` : "";
            })()}{" "}
            — the engine doesn't stream progress, so this is a busy indicator; large models
            take a while.
          </div>
        )}
      </div>
    </div>
  );
}
