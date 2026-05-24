// Typed graph operations. Wire shapes verified against stratadb 0.6.1:
//   GraphList/GraphListNodes -> { Keys: string[] }
//   GraphAddNode -> { GraphWriteResult }, GraphAddEdge -> { GraphEdgeWriteResult }
//   GraphGetNode -> { Maybe: { Object: { properties, object_type } } } | null
//   GraphNeighbors(outgoing) -> { GraphNeighbors: [{ node_id, edge_type, weight }] }

import { execute } from "./strata";
import type { Handle } from "./strata";
import type { StrataValue } from "./types";

export interface GraphNode {
  id: string;
  objectType: string | null;
  properties: StrataValue | null;
}
export interface GraphEdge {
  src: string;
  dst: string;
  type: string;
}
export interface GraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

function rec(o: unknown): Record<string, unknown> {
  return o !== null && typeof o === "object" ? (o as Record<string, unknown>) : {};
}
function scoped(args: Record<string, unknown>, branch?: string, space?: string) {
  if (branch) args.branch = branch;
  if (space) args.space = space;
  return args;
}
function asStr(v: unknown): string | null {
  const r = rec(v);
  return typeof r.String === "string" ? r.String : null;
}

export async function graphList(handle: Handle, branch?: string, space?: string): Promise<string[]> {
  const out = rec(await execute(handle, { GraphList: scoped({}, branch, space) }));
  return Array.isArray(out.Keys) ? (out.Keys as string[]) : [];
}

export async function graphCreate(handle: Handle, graph: string, branch?: string, space?: string): Promise<void> {
  await execute(handle, { GraphCreate: scoped({ graph }, branch, space) });
}

export async function graphDelete(handle: Handle, graph: string, branch?: string, space?: string): Promise<void> {
  await execute(handle, { GraphDelete: scoped({ graph }, branch, space) });
}

export async function graphAddNode(
  handle: Handle,
  graph: string,
  nodeId: string,
  objectType: string | null,
  properties: StrataValue | null,
  branch?: string,
  space?: string,
): Promise<void> {
  const args = scoped({ graph, node_id: nodeId }, branch, space);
  if (objectType) args.object_type = objectType;
  if (properties) args.properties = properties;
  await execute(handle, { GraphAddNode: args });
}

export async function graphAddEdge(
  handle: Handle,
  graph: string,
  src: string,
  dst: string,
  edgeType: string,
  branch?: string,
  space?: string,
): Promise<void> {
  await execute(handle, {
    GraphAddEdge: scoped({ graph, src, dst, edge_type: edgeType }, branch, space),
  });
}

async function listNodes(handle: Handle, graph: string, branch?: string, space?: string): Promise<string[]> {
  const out = rec(await execute(handle, { GraphListNodes: scoped({ graph }, branch, space) }));
  return Array.isArray(out.Keys) ? (out.Keys as string[]) : [];
}

async function getNode(
  handle: Handle,
  graph: string,
  nodeId: string,
  branch?: string,
  space?: string,
): Promise<{ objectType: string | null; properties: StrataValue | null }> {
  const out = rec(await execute(handle, { GraphGetNode: scoped({ graph, node_id: nodeId }, branch, space) }));
  if (!out.Maybe) return { objectType: null, properties: null };
  const obj = rec(rec(out.Maybe).Object); // { properties: <Value>, object_type: <Value> }
  return {
    objectType: asStr(obj.object_type),
    properties: (obj.properties as StrataValue) ?? null,
  };
}

async function neighbors(
  handle: Handle,
  graph: string,
  nodeId: string,
  branch?: string,
  space?: string,
): Promise<Array<{ node_id: string; edge_type: string }>> {
  const out = rec(
    await execute(handle, { GraphNeighbors: scoped({ graph, node_id: nodeId, direction: "outgoing" }, branch, space) }),
  );
  return Array.isArray(out.GraphNeighbors)
    ? (out.GraphNeighbors as Array<{ node_id: string; edge_type: string }>)
    : [];
}

/** Load the whole graph: node ids + types/properties, and directed edges. */
export async function graphLoad(handle: Handle, graph: string, branch?: string, space?: string): Promise<GraphData> {
  const ids = await listNodes(handle, graph, branch, space);
  const nodes = await Promise.all(
    ids.map(async (id) => {
      const info = await getNode(handle, graph, id, branch, space);
      return { id, objectType: info.objectType, properties: info.properties };
    }),
  );
  const edgeGroups = await Promise.all(
    ids.map(async (id) => {
      const ns = await neighbors(handle, graph, id, branch, space);
      return ns.map((n) => ({ src: id, dst: n.node_id, type: n.edge_type }));
    }),
  );
  return { nodes, edges: edgeGroups.flat() };
}
