import { useEffect, useState, useCallback } from "react";
import { useDatabases } from "../../state/databases";
import { graphList, graphCreate, graphDelete, graphAddNode, graphAddEdge, graphLoad } from "../../lib/graph";
import type { GraphData } from "../../lib/graph";
import { GraphCanvas } from "../../components/GraphCanvas";
import { JsonTree } from "../../components/JsonTree";

export function GraphView() {
  const { active } = useDatabases();
  const handle = active?.handle ?? null;
  const branch = active?.currentBranch;
  const space = active?.currentSpace;

  const [graphs, setGraphs] = useState<string[]>([]);
  const [graph, setGraph] = useState<string | null>(null);
  const [data, setData] = useState<GraphData>({ nodes: [], edges: [] });
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [newGraph, setNewGraph] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [nodeId, setNodeId] = useState("");
  const [nodeType, setNodeType] = useState("");
  const [edgeSrc, setEdgeSrc] = useState("");
  const [edgeDst, setEdgeDst] = useState("");
  const [edgeType, setEdgeType] = useState("");

  const loadGraphs = useCallback(async () => {
    if (handle === null) return;
    try {
      const gs = await graphList(handle, branch, space);
      setGraphs(gs);
      setGraph((prev) => (prev && gs.includes(prev) ? prev : (gs[0] ?? null)));
    } catch (e) {
      setError(String(e));
    }
  }, [handle, branch, space]);

  const loadData = useCallback(async () => {
    if (handle === null || !graph) {
      setData({ nodes: [], edges: [] });
      return;
    }
    setLoading(true);
    setError(null);
    try {
      setData(await graphLoad(handle, graph, branch, space));
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, [handle, graph, branch, space]);

  useEffect(() => {
    loadGraphs();
  }, [loadGraphs]);
  useEffect(() => {
    setSelectedNode(null);
    loadData();
  }, [loadData]);

  async function createGraph() {
    if (handle === null || !newGraph.trim()) return;
    const g = newGraph.trim();
    try {
      await graphCreate(handle, g, branch, space);
      setNewGraph("");
      await loadGraphs();
      setGraph(g);
    } catch (e) {
      setError(String(e));
    }
  }
  async function delGraph() {
    if (handle === null || !graph) return;
    try {
      await graphDelete(handle, graph, branch, space);
      await loadGraphs();
    } catch (e) {
      setError(String(e));
    }
  }
  async function addNode() {
    if (handle === null || !graph || !nodeId.trim()) return;
    try {
      await graphAddNode(handle, graph, nodeId.trim(), nodeType.trim() || null, null, branch, space);
      setNodeId("");
      setNodeType("");
      await loadData();
    } catch (e) {
      setError(String(e));
    }
  }
  async function addEdge() {
    if (handle === null || !graph || !edgeSrc || !edgeDst || !edgeType.trim()) return;
    try {
      await graphAddEdge(handle, graph, edgeSrc, edgeDst, edgeType.trim(), branch, space);
      setEdgeType("");
      await loadData();
    } catch (e) {
      setError(String(e));
    }
  }

  const sel = data.nodes.find((n) => n.id === selectedNode) ?? null;
  const selEdges = data.edges.filter((e) => e.src === selectedNode || e.dst === selectedNode);

  return (
    <div className="feature">
      <header className="feature-head">
        <h2>Graph</h2>
        {graphs.length > 0 ? (
          <select value={graph ?? ""} onChange={(e) => setGraph(e.target.value)}>
            {graphs.map((g) => (
              <option key={g} value={g}>
                {g}
              </option>
            ))}
          </select>
        ) : (
          <span className="muted">no graphs</span>
        )}
        <input
          style={{ width: 110 }}
          placeholder="new graph"
          value={newGraph}
          onChange={(e) => setNewGraph(e.target.value)}
        />
        <button onClick={createGraph} disabled={!newGraph.trim()}>
          Create
        </button>
        {graph && (
          <span className="muted">
            {data.nodes.length} nodes · {data.edges.length} edges · <code>{branch}</code>/
            <code>{space}</code>
          </span>
        )}
        <span className="grow" />
        {graph && <button onClick={() => setShowAdd((s) => !s)}>{showAdd ? "Done" : "Add node/edge"}</button>}
        {graph && (
          <button className="ghost" onClick={loadData}>
            Refresh
          </button>
        )}
        {graph && (
          <button className="ghost danger-text" onClick={delGraph}>
            Delete graph
          </button>
        )}
      </header>

      {error && <div className="error pad">{error}</div>}

      <div className="graph-body">
        {!graph ? (
          <div className="empty">
            <p className="muted">Create a graph to begin.</p>
          </div>
        ) : (
          <>
            <GraphCanvas
              nodes={data.nodes.map((n) => ({ id: n.id, type: n.objectType }))}
              edges={data.edges}
              selected={selectedNode}
              onSelect={setSelectedNode}
            />
            {loading && <div className="graph-overlay muted">Loading…</div>}

            {showAdd && (
              <div className="graph-card graph-add">
                <div className="dk">add node</div>
                <div className="op-row">
                  <input placeholder="id" value={nodeId} onChange={(e) => setNodeId(e.target.value)} />
                  <input
                    placeholder="type (optional)"
                    value={nodeType}
                    onChange={(e) => setNodeType(e.target.value)}
                  />
                  <button onClick={addNode} disabled={!nodeId.trim()}>
                    Add
                  </button>
                </div>
                <div className="dk" style={{ marginTop: 10 }}>
                  add edge
                </div>
                <div className="op-row">
                  <select value={edgeSrc} onChange={(e) => setEdgeSrc(e.target.value)}>
                    <option value="">src</option>
                    {data.nodes.map((n) => (
                      <option key={n.id} value={n.id}>
                        {n.id}
                      </option>
                    ))}
                  </select>
                  <span className="arrow">→</span>
                  <select value={edgeDst} onChange={(e) => setEdgeDst(e.target.value)}>
                    <option value="">dst</option>
                    {data.nodes.map((n) => (
                      <option key={n.id} value={n.id}>
                        {n.id}
                      </option>
                    ))}
                  </select>
                  <input
                    style={{ width: 90 }}
                    placeholder="type"
                    value={edgeType}
                    onChange={(e) => setEdgeType(e.target.value)}
                  />
                  <button onClick={addEdge} disabled={!edgeSrc || !edgeDst || !edgeType.trim()}>
                    Add
                  </button>
                </div>
              </div>
            )}

            {sel && (
              <div className="graph-card graph-node-detail">
                <div className="op-row">
                  <code>{sel.id}</code>
                  {sel.objectType && <span className="badge">{sel.objectType}</span>}
                  <span className="grow" />
                  <button className="ghost tiny" onClick={() => setSelectedNode(null)}>
                    ×
                  </button>
                </div>
                {sel.properties && (
                  <div className="json-view">
                    <JsonTree value={sel.properties} />
                  </div>
                )}
                <div className="dk" style={{ marginTop: 8 }}>
                  edges ({selEdges.length})
                </div>
                {selEdges.map((e, i) => (
                  <div key={i} className="g-edge-row">
                    <code>{e.src}</code> <span className="muted">{e.type}</span> → <code>{e.dst}</code>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
