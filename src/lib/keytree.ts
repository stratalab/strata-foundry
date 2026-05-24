// Build a namespace tree from flat keys split on a delimiter (default ":").
// e.g. ["user:alice", "user:bob", "config:max"] becomes
//   user (2) ─ alice, bob
//   config (1) ─ max

export interface KeyNode {
  /** This level's label (one path segment). */
  segment: string;
  /** The full key if a real key terminates here, else null (group-only). */
  fullKey: string | null;
  children: KeyNode[];
}

export function buildKeyTree(keys: string[], sep = ":"): KeyNode[] {
  const root: KeyNode = { segment: "", fullKey: null, children: [] };
  const keySet = new Set(keys);

  for (const key of keys) {
    const parts = key.split(sep);
    let node = root;
    let path = "";
    for (let i = 0; i < parts.length; i++) {
      path = i === 0 ? parts[i] : `${path}${sep}${parts[i]}`;
      let child = node.children.find((c) => c.segment === parts[i]);
      if (!child) {
        child = { segment: parts[i], fullKey: keySet.has(path) ? path : null, children: [] };
        node.children.push(child);
      } else if (keySet.has(path)) {
        child.fullKey = path;
      }
      node = child;
    }
  }

  const sortRec = (n: KeyNode) => {
    n.children.sort((a, b) => a.segment.localeCompare(b.segment));
    n.children.forEach(sortRec);
  };
  sortRec(root);
  return root.children;
}

/** Total number of real keys under (and including) a node. */
export function countKeys(n: KeyNode): number {
  return (n.fullKey ? 1 : 0) + n.children.reduce((sum, c) => sum + countKeys(c), 0);
}
