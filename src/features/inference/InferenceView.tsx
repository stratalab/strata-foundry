import { useEffect, useState, useCallback } from "react";
import { useDatabases } from "../../state/databases";
import {
  embedStatus,
  setAutoEmbed,
  reindexEmbeddings,
  embed,
  configGet,
  configSet,
} from "../../lib/inference";
import type { EmbedStatusInfo } from "../../lib/inference";

const CONFIG_KEYS = [
  "provider",
  "default_model",
  "embed_model",
  "model_endpoint",
  "model_name",
  "model_api_key",
  "anthropic_api_key",
  "openai_api_key",
  "google_api_key",
];

export function InferenceView() {
  const { active } = useDatabases();
  const handle = active?.handle ?? null;
  const branch = active?.currentBranch;

  const [status, setStatus] = useState<EmbedStatusInfo | null>(null);
  const [config, setConfig] = useState<Record<string, string>>({});
  const [embedText, setEmbedText] = useState("");
  const [embedVec, setEmbedVec] = useState<number[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (handle === null) return;
    try {
      const [st, cfg] = await Promise.all([embedStatus(handle), configGet(handle)]);
      setStatus(st);
      const c: Record<string, string> = {};
      for (const k of CONFIG_KEYS) {
        const v = cfg[k];
        c[k] = v == null ? "" : String(v);
      }
      setConfig(c);
    } catch (e) {
      setErr(String(e));
    }
  }, [handle]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  async function withBusy(fn: () => Promise<string | void>) {
    if (handle === null) return;
    setBusy(true);
    setErr(null);
    setMsg(null);
    try {
      const m = await fn();
      if (typeof m === "string") setMsg(m);
      await refresh();
    } catch (e) {
      setErr(String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="feature">
      <header className="feature-head">
        <h2>Inference</h2>
        <span className="muted">embeddings · configuration</span>
        <span className="grow" />
        <button className="ghost" onClick={refresh}>
          Refresh
        </button>
      </header>

      <div className="io-body">
        <section className="op-card">
          <h3>Embedding</h3>
          {status ? (
            <>
              <label className="check-row">
                <input
                  type="checkbox"
                  checked={status.auto_embed}
                  onChange={(e) => withBusy(async () => void (await setAutoEmbed(handle!, e.target.checked)))}
                />
                Auto-embed on write
              </label>
              <div className="muted">
                batch {status.batch_size} · pending {status.pending} · embedded{" "}
                {status.total_embedded} · failed {status.total_failed}
              </div>
              <div className="op-row">
                <button
                  disabled={busy}
                  onClick={() => withBusy(async () => `Reindex: ${await reindexEmbeddings(handle!, branch)}`)}
                >
                  Reindex embeddings
                </button>
              </div>
            </>
          ) : (
            <div className="muted">Embedding status unavailable.</div>
          )}
          <div className="io-field">
            <span className="dk">embed text</span>
            <input
              value={embedText}
              onChange={(e) => setEmbedText(e.target.value)}
              placeholder="text to embed"
            />
            <button
              className="ghost"
              disabled={busy || !embedText.trim()}
              onClick={async () => {
                if (handle === null) return;
                setErr(null);
                try {
                  setEmbedVec(await embed(handle, embedText.trim()));
                } catch (e) {
                  setErr(String(e));
                }
              }}
            >
              Embed
            </button>
          </div>
          {embedVec && (
            <div className="vec-embedding">
              dim {embedVec.length}: [{embedVec.slice(0, 8).map((x) => x.toFixed(4)).join(", ")}
              {embedVec.length > 8 ? ", …" : ""}]
            </div>
          )}
        </section>

        <section className="op-card">
          <h3>Configuration</h3>
          {CONFIG_KEYS.map((k) => (
            <div className="io-field" key={k}>
              <span className="dk" style={{ width: 140 }}>
                {k}
              </span>
              <input
                type={k.includes("key") ? "password" : "text"}
                value={config[k] ?? ""}
                onChange={(e) => setConfig({ ...config, [k]: e.target.value })}
              />
            </div>
          ))}
          <button
            disabled={busy}
            onClick={() =>
              withBusy(async () => {
                for (const k of CONFIG_KEYS) {
                  if (config[k]) await configSet(handle!, k, config[k]);
                }
                return "Configuration saved.";
              })
            }
          >
            Save configuration
          </button>
        </section>

        {msg && <div className="op-msg">{msg}</div>}
        {err && <div className="op-msg error">{err}</div>}
      </div>
    </div>
  );
}
