import { useState } from "react";
import { useDatabases } from "../../state/databases";
import { dbExport, arrowImport } from "../../lib/arrow";
import type { ExportFormat, ExportPrimitive, ExportResult, ImportResult, ImportTarget } from "../../lib/arrow";

export function DataView() {
  const { active } = useDatabases();
  const handle = active?.handle ?? null;
  const branch = active?.currentBranch;
  const space = active?.currentSpace;

  // Export
  const [primitive, setPrimitive] = useState<ExportPrimitive>("kv");
  const [format, setFormat] = useState<ExportFormat>("jsonl");
  const [prefix, setPrefix] = useState("");
  const [limit, setLimit] = useState("");
  const [collection, setCollection] = useState("");
  const [graph, setGraph] = useState("");
  const [exportPath, setExportPath] = useState("");
  const [exportResult, setExportResult] = useState<ExportResult | null>(null);
  const [exportErr, setExportErr] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  // Import
  const [filePath, setFilePath] = useState("");
  const [target, setTarget] = useState<ImportTarget>("kv");
  const [keyCol, setKeyCol] = useState("");
  const [valCol, setValCol] = useState("");
  const [impFormat, setImpFormat] = useState("");
  const [impCollection, setImpCollection] = useState("");
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [importErr, setImportErr] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);

  async function runExport() {
    if (handle === null) return;
    setExportErr(null);
    setExportResult(null);
    if (format === "parquet" && !exportPath.trim()) {
      setExportErr("Parquet is binary — set a file path to export it.");
      return;
    }
    setExporting(true);
    try {
      const r = await dbExport(
        handle,
        {
          primitive,
          format,
          prefix: prefix.trim() || undefined,
          limit: limit.trim() ? parseInt(limit, 10) : undefined,
          path: exportPath.trim() || undefined,
          collection: primitive === "vector" ? collection.trim() || undefined : undefined,
          graph: primitive === "graph" ? graph.trim() || undefined : undefined,
        },
        branch,
        space,
      );
      setExportResult(r);
    } catch (e) {
      setExportErr(String(e));
    } finally {
      setExporting(false);
    }
  }

  async function runImport() {
    if (handle === null || !filePath.trim()) return;
    setImportErr(null);
    setImportResult(null);
    setImporting(true);
    try {
      const r = await arrowImport(
        handle,
        {
          filePath: filePath.trim(),
          target,
          keyColumn: keyCol.trim() || undefined,
          valueColumn: valCol.trim() || undefined,
          format: impFormat || undefined,
          collection: target === "vector" ? impCollection.trim() || undefined : undefined,
        },
        branch,
        space,
      );
      setImportResult(r);
    } catch (e) {
      setImportErr(String(e));
    } finally {
      setImporting(false);
    }
  }

  return (
    <div className="feature">
      <header className="feature-head">
        <h2>Import / Export</h2>
        <span className="muted">
          Arrow · Parquet / CSV / JSONL · <code>{branch}</code>/<code>{space}</code>
        </span>
      </header>

      <div className="io-body">
        <div className="ops-grid">
          <section className="op-card">
            <h3>Export</h3>
            <div className="io-field">
              <span className="dk">primitive</span>
              <select value={primitive} onChange={(e) => setPrimitive(e.target.value as ExportPrimitive)}>
                <option value="kv">kv</option>
                <option value="json">json</option>
                <option value="events">events</option>
                <option value="vector">vector</option>
                <option value="graph">graph</option>
              </select>
            </div>
            <div className="io-field">
              <span className="dk">format</span>
              <select value={format} onChange={(e) => setFormat(e.target.value as ExportFormat)}>
                <option value="jsonl">jsonl</option>
                <option value="json">json</option>
                <option value="csv">csv</option>
                <option value="parquet">parquet</option>
              </select>
            </div>
            {primitive === "vector" && (
              <div className="io-field">
                <span className="dk">collection</span>
                <input value={collection} onChange={(e) => setCollection(e.target.value)} />
              </div>
            )}
            {primitive === "graph" && (
              <div className="io-field">
                <span className="dk">graph</span>
                <input value={graph} onChange={(e) => setGraph(e.target.value)} />
              </div>
            )}
            <div className="io-field">
              <span className="dk">prefix</span>
              <input placeholder="(optional)" value={prefix} onChange={(e) => setPrefix(e.target.value)} />
            </div>
            <div className="io-field">
              <span className="dk">limit</span>
              <input placeholder="(optional)" value={limit} onChange={(e) => setLimit(e.target.value)} />
            </div>
            <div className="io-field">
              <span className="dk">file path</span>
              <input
                placeholder="(optional — inline if empty)"
                value={exportPath}
                onChange={(e) => setExportPath(e.target.value)}
              />
            </div>
            <button onClick={runExport} disabled={exporting}>
              Export
            </button>
            {exportErr && <div className="error">{exportErr}</div>}
            {exportResult && (
              <div className="io-result">
                <div className="muted">
                  {exportResult.row_count} rows · {exportResult.format}
                  {exportResult.path ? ` → ${exportResult.path}` : ""}
                </div>
                {exportResult.data && (
                  <textarea className="value-edit" readOnly value={exportResult.data} />
                )}
              </div>
            )}
          </section>

          <section className="op-card">
            <h3>Import</h3>
            <div className="io-field">
              <span className="dk">file path</span>
              <input
                placeholder="/path/to/data.csv | .jsonl | .parquet"
                value={filePath}
                onChange={(e) => setFilePath(e.target.value)}
              />
            </div>
            <div className="io-field">
              <span className="dk">target</span>
              <select value={target} onChange={(e) => setTarget(e.target.value as ImportTarget)}>
                <option value="kv">kv</option>
                <option value="json">json</option>
                <option value="vector">vector</option>
              </select>
            </div>
            <div className="io-field">
              <span className="dk">key column</span>
              <input placeholder="(auto)" value={keyCol} onChange={(e) => setKeyCol(e.target.value)} />
            </div>
            <div className="io-field">
              <span className="dk">value column</span>
              <input placeholder="(auto)" value={valCol} onChange={(e) => setValCol(e.target.value)} />
            </div>
            {target === "vector" && (
              <div className="io-field">
                <span className="dk">collection</span>
                <input value={impCollection} onChange={(e) => setImpCollection(e.target.value)} />
              </div>
            )}
            <div className="io-field">
              <span className="dk">format</span>
              <select value={impFormat} onChange={(e) => setImpFormat(e.target.value)}>
                <option value="">auto-detect</option>
                <option value="parquet">parquet</option>
                <option value="csv">csv</option>
                <option value="jsonl">jsonl</option>
              </select>
            </div>
            <button onClick={runImport} disabled={importing || !filePath.trim()}>
              Import
            </button>
            {importErr && <div className="error">{importErr}</div>}
            {importResult && (
              <div className="io-result muted">
                Imported {importResult.rows_imported} rows
                {importResult.rows_skipped ? `, skipped ${importResult.rows_skipped}` : ""} into{" "}
                {importResult.target}.
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
