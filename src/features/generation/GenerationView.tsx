import { useEffect, useState } from "react";
import { useDatabases } from "../../state/databases";
import { generate, modelsLocal } from "../../lib/inference";
import type { GenerationResult, ModelInfo } from "../../lib/inference";

export function GenerationView() {
  const { active } = useDatabases();
  const handle = active?.handle ?? null;

  const [models, setModels] = useState<ModelInfo[]>([]);
  const [model, setModel] = useState("");
  const [prompt, setPrompt] = useState("");
  const [maxTokens, setMaxTokens] = useState(256);
  const [temperature, setTemperature] = useState(0.7);
  const [topP, setTopP] = useState(0.95);
  const [result, setResult] = useState<GenerationResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (handle === null) return;
    modelsLocal(handle)
      .then((ms) => setModels(ms.filter((m) => m.task === "Generate")))
      .catch(() => {});
  }, [handle]);

  async function run() {
    if (handle === null || !model.trim() || !prompt.trim()) return;
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      setResult(await generate(handle, { model: model.trim(), prompt, maxTokens, temperature, topP }));
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="feature">
      <header className="feature-head">
        <h2>Generate</h2>
        <span className="muted">local text generation (llama.cpp)</span>
      </header>
      <div className="io-body">
        <div className="io-field">
          <span className="dk">model</span>
          <input
            list="gen-models"
            placeholder="e.g. qwen3:8b"
            value={model}
            onChange={(e) => setModel(e.target.value)}
          />
          <datalist id="gen-models">
            {models.map((m) => (
              <option key={m.name} value={m.name} />
            ))}
          </datalist>
        </div>
        <textarea
          className="value-edit"
          style={{ minHeight: 150 }}
          placeholder="Prompt…"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
        />
        <div className="op-row" style={{ marginTop: 8 }}>
          <label className="io-mini">
            max tokens
            <input
              type="number"
              value={maxTokens}
              onChange={(e) => setMaxTokens(parseInt(e.target.value, 10) || 0)}
              style={{ width: 80 }}
            />
          </label>
          <label className="io-mini">
            temp
            <input
              type="number"
              step="0.1"
              value={temperature}
              onChange={(e) => setTemperature(parseFloat(e.target.value) || 0)}
              style={{ width: 70 }}
            />
          </label>
          <label className="io-mini">
            top-p
            <input
              type="number"
              step="0.05"
              value={topP}
              onChange={(e) => setTopP(parseFloat(e.target.value) || 0)}
              style={{ width: 70 }}
            />
          </label>
          <span className="grow" />
          <button onClick={run} disabled={busy || !model.trim() || !prompt.trim()}>
            {busy ? "Generating…" : "Generate"}
          </button>
        </div>

        {error && <div className="error pad">{error}</div>}
        {!error && models.length === 0 && (
          <div className="muted pad">
            No local generation models. Pull one in <b>Inference → Models</b> first.
          </div>
        )}

        {result && (
          <div className="gen-output">
            <div className="muted">
              stop: {result.stop_reason} · {result.prompt_tokens} prompt /{" "}
              {result.completion_tokens} completion tokens
            </div>
            <pre className="value-box">{result.text}</pre>
          </div>
        )}
      </div>
    </div>
  );
}
