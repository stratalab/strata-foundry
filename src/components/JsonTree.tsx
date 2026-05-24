import { useState } from "react";
import type { StrataValue } from "../lib/types";

function isObject(v: StrataValue): v is { Object: Record<string, StrataValue> } {
  return typeof v === "object" && v !== null && "Object" in v;
}
function isArray(v: StrataValue): v is { Array: StrataValue[] } {
  return typeof v === "object" && v !== null && "Array" in v;
}

function Primitive({ v }: { v: StrataValue }) {
  if (v === "Null") return <span className="jv jv-null">null</span>;
  if ("Bool" in v) return <span className="jv jv-bool">{String(v.Bool)}</span>;
  if ("Int" in v) return <span className="jv jv-num">{v.Int}</span>;
  if ("Float" in v) return <span className="jv jv-num">{v.Float}</span>;
  if ("String" in v) return <span className="jv jv-str">"{v.String}"</span>;
  if ("Bytes" in v) return <span className="jv jv-bytes">bytes[{v.Bytes.length}]</span>;
  return <span className="jv">?</span>;
}

/** Collapsible, type-coloured renderer for a StrataValue. */
export function JsonTree({
  value,
  name,
  depth = 0,
}: {
  value: StrataValue;
  name?: string;
  depth?: number;
}) {
  const composite = isObject(value) || isArray(value);
  const [open, setOpen] = useState(depth < 2);
  const indent = { paddingLeft: depth * 14 };

  if (!composite) {
    return (
      <div className="json-row" style={indent}>
        {name !== undefined && <span className="jkey">{name}:</span>}
        <Primitive v={value} />
      </div>
    );
  }

  const entries: Array<[string, StrataValue]> = isObject(value)
    ? Object.entries(value.Object)
    : value.Array.map((v, i) => [String(i), v]);
  const openBrace = isArray(value) ? "[" : "{";
  const closeBrace = isArray(value) ? "]" : "}";

  return (
    <div>
      <div className="json-row" style={indent}>
        <button className="twisty" onClick={() => setOpen(!open)}>
          {open ? "▾" : "▸"}
        </button>
        {name !== undefined && <span className="jkey">{name}:</span>}
        <span className="jbrace">
          {openBrace}
          {!open && `…${closeBrace}`}
        </span>
        <span className="jcount">{entries.length}</span>
      </div>
      {open && (
        <>
          {entries.map(([k, v]) => (
            <JsonTree key={k} value={v} name={k} depth={depth + 1} />
          ))}
          <div className="json-row" style={indent}>
            <span className="jbrace">{closeBrace}</span>
          </div>
        </>
      )}
    </div>
  );
}
