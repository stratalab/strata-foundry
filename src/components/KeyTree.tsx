import { useState } from "react";
import { countKeys } from "../lib/keytree";
import type { KeyNode } from "../lib/keytree";

function Node({
  node,
  selected,
  onSelect,
  depth,
}: {
  node: KeyNode;
  selected: string | null;
  onSelect: (key: string) => void;
  depth: number;
}) {
  const [open, setOpen] = useState(depth < 2);
  const hasChildren = node.children.length > 0;
  const isKey = node.fullKey !== null;

  return (
    <li>
      <div className="tree-row" style={{ paddingLeft: 6 + depth * 14 }}>
        {hasChildren ? (
          <button className="twisty" onClick={() => setOpen(!open)}>
            {open ? "▾" : "▸"}
          </button>
        ) : (
          <span className="twisty-spacer" />
        )}
        <button
          className={`tree-label ${isKey ? "is-key" : "is-group"} ${
            selected === node.fullKey ? "active" : ""
          }`}
          onClick={() => (isKey ? onSelect(node.fullKey as string) : setOpen(!open))}
          title={node.fullKey ?? node.segment}
        >
          <span className="seg">{node.segment}</span>
          {hasChildren && <span className="count">{countKeys(node)}</span>}
        </button>
      </div>
      {hasChildren && open && (
        <ul className="tree-children">
          {node.children.map((c) => (
            <Node
              key={c.segment}
              node={c}
              selected={selected}
              onSelect={onSelect}
              depth={depth + 1}
            />
          ))}
        </ul>
      )}
    </li>
  );
}

export function KeyTree({
  nodes,
  selected,
  onSelect,
}: {
  nodes: KeyNode[];
  selected: string | null;
  onSelect: (key: string) => void;
}) {
  return (
    <ul className="tree">
      {nodes.map((n) => (
        <Node key={n.segment} node={n} selected={selected} onSelect={onSelect} depth={0} />
      ))}
    </ul>
  );
}
