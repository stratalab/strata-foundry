import { useEffect, useRef, useState, useCallback } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";

export interface GNode {
  id: string;
  type: string | null;
}
export interface GEdge {
  src: string;
  dst: string;
  type: string;
}

interface P {
  x: number;
  y: number;
  vx: number;
  vy: number;
}

const W = 900;
const H = 640;
const R = 12;
const PALETTE = ["#4f6bed", "#2ec27e", "#e0a82e", "#b35309", "#8250df", "#c0392b", "#0a7c5a", "#d6336c"];

function colorFor(type: string | null): string {
  if (!type) return "#8a93a3";
  let h = 0;
  for (let i = 0; i < type.length; i++) h = (h * 31 + type.charCodeAt(i)) >>> 0;
  return PALETTE[h % PALETTE.length];
}

/** Dependency-free force-directed graph with draggable nodes. */
export function GraphCanvas({
  nodes,
  edges,
  selected,
  onSelect,
}: {
  nodes: GNode[];
  edges: GEdge[];
  selected: string | null;
  onSelect: (id: string) => void;
}) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const posRef = useRef<Map<string, P>>(new Map());
  const alphaRef = useRef(1);
  const runningRef = useRef(false);
  const dragRef = useRef<string | null>(null);
  const dataRef = useRef({ nodes, edges });
  const [, setTick] = useState(0);
  dataRef.current = { nodes, edges };

  const tickOnce = useCallback(() => {
    const { nodes, edges } = dataRef.current;
    const pos = posRef.current;
    const ids = nodes.map((n) => n.id);
    const a = alphaRef.current;
    for (let i = 0; i < ids.length; i++) {
      const p = pos.get(ids[i]);
      if (!p) continue;
      for (let j = i + 1; j < ids.length; j++) {
        const q = pos.get(ids[j]);
        if (!q) continue;
        let dx = p.x - q.x;
        let dy = p.y - q.y;
        let d2 = dx * dx + dy * dy;
        if (d2 < 0.01) d2 = 0.01;
        const d = Math.sqrt(d2);
        const f = ((6000 / d2) * a);
        const fx = (dx / d) * f;
        const fy = (dy / d) * f;
        p.vx += fx;
        p.vy += fy;
        q.vx -= fx;
        q.vy -= fy;
      }
    }
    for (const e of edges) {
      const p = pos.get(e.src);
      const q = pos.get(e.dst);
      if (!p || !q) continue;
      const dx = q.x - p.x;
      const dy = q.y - p.y;
      const d = Math.sqrt(dx * dx + dy * dy) || 0.01;
      const f = 0.03 * (d - 140) * a;
      const fx = (dx / d) * f;
      const fy = (dy / d) * f;
      p.vx += fx;
      p.vy += fy;
      q.vx -= fx;
      q.vy -= fy;
    }
    for (const id of ids) {
      const p = pos.get(id);
      if (!p) continue;
      p.vx += (W / 2 - p.x) * 0.005 * a;
      p.vy += (H / 2 - p.y) * 0.005 * a;
      p.vx *= 0.9;
      p.vy *= 0.9;
      if (dragRef.current !== id) {
        p.x += p.vx;
        p.y += p.vy;
      }
    }
  }, []);

  const start = useCallback(() => {
    if (runningRef.current) return;
    runningRef.current = true;
    const loop = () => {
      tickOnce();
      alphaRef.current *= 0.98;
      setTick((t) => (t + 1) % 1_000_000);
      if (alphaRef.current > 0.02 || dragRef.current) {
        requestAnimationFrame(loop);
      } else {
        runningRef.current = false;
      }
    };
    requestAnimationFrame(loop);
  }, [tickOnce]);

  useEffect(() => {
    const pos = posRef.current;
    nodes.forEach((n, i) => {
      if (!pos.has(n.id)) {
        const ang = (i / Math.max(1, nodes.length)) * Math.PI * 2;
        pos.set(n.id, {
          x: W / 2 + Math.cos(ang) * 150 + (Math.random() - 0.5) * 30,
          y: H / 2 + Math.sin(ang) * 150 + (Math.random() - 0.5) * 30,
          vx: 0,
          vy: 0,
        });
      }
    });
    for (const id of [...pos.keys()]) if (!nodes.find((n) => n.id === id)) pos.delete(id);
    alphaRef.current = 1;
    start();
  }, [nodes, edges, start]);

  function toLocal(e: ReactPointerEvent): { x: number; y: number } {
    const svg = svgRef.current;
    const ctm = svg?.getScreenCTM();
    if (!ctm) return { x: 0, y: 0 };
    const pt = new DOMPoint(e.clientX, e.clientY).matrixTransform(ctm.inverse());
    return { x: pt.x, y: pt.y };
  }
  function onDown(e: ReactPointerEvent, id: string) {
    e.stopPropagation();
    dragRef.current = id;
    alphaRef.current = Math.max(alphaRef.current, 0.4);
    start();
  }
  function onMove(e: ReactPointerEvent) {
    if (!dragRef.current) return;
    const { x, y } = toLocal(e);
    const p = posRef.current.get(dragRef.current);
    if (p) {
      p.x = x;
      p.y = y;
      p.vx = 0;
      p.vy = 0;
    }
    setTick((t) => t + 1);
  }
  function onUp() {
    dragRef.current = null;
  }

  const pos = posRef.current;

  return (
    <svg
      ref={svgRef}
      className="graph-canvas"
      viewBox={`0 0 ${W} ${H}`}
      onPointerMove={onMove}
      onPointerUp={onUp}
      onPointerLeave={onUp}
    >
      <defs>
        <marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
          <path d="M0,0 L10,5 L0,10 z" fill="#b3b9c5" />
        </marker>
      </defs>
      {edges.map((e, i) => {
        const a = pos.get(e.src);
        const b = pos.get(e.dst);
        if (!a || !b) return null;
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const d = Math.sqrt(dx * dx + dy * dy) || 1;
        const ex = b.x - (dx / d) * (R + 6);
        const ey = b.y - (dy / d) * (R + 6);
        return (
          <g key={`${e.src}-${e.dst}-${e.type}-${i}`}>
            <line x1={a.x} y1={a.y} x2={ex} y2={ey} className="g-edge" markerEnd="url(#arrow)" />
            <text x={(a.x + b.x) / 2} y={(a.y + b.y) / 2} className="g-edge-label">
              {e.type}
            </text>
          </g>
        );
      })}
      {nodes.map((n) => {
        const p = pos.get(n.id);
        if (!p) return null;
        const sel = selected === n.id;
        return (
          <g
            key={n.id}
            transform={`translate(${p.x},${p.y})`}
            className="g-node"
            onPointerDown={(e) => onDown(e, n.id)}
            onClick={(e) => {
              e.stopPropagation();
              onSelect(n.id);
            }}
          >
            <circle r={sel ? R + 3 : R} fill={colorFor(n.type)} className={`g-circle ${sel ? "sel" : ""}`} />
            <text y={-R - 6} className="g-node-label">
              {n.id}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
