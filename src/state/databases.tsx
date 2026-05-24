// Multiple open databases, each with its own handle, current branch, and space.

import { createContext, useContext, useState, useCallback } from "react";
import type { ReactNode } from "react";
import { openMemory, open as openPath, init as dbInit, close as closeHandle } from "../lib/strata";
import type { Handle } from "../lib/strata";
import { seedSample, seedDiskSample } from "../lib/sample";

export type DbKind = "scratch" | "disk";

export interface OpenDb {
  id: string;
  handle: Handle;
  label: string;
  kind: DbKind;
  /** Branching requires a disk-backed database; scratch DBs can't fork. */
  supportsBranching: boolean;
  /** The branch currently being viewed. */
  currentBranch: string;
  /** The space (key grouping) currently being viewed. */
  currentSpace: string;
}

interface DatabasesCtx {
  dbs: OpenDb[];
  activeId: string | null;
  active: OpenDb | null;
  opening: boolean;
  error: string | null;
  notice: string | null;
  recents: string[];
  openScratch: () => Promise<void>;
  openDiskDemo: () => Promise<void>;
  openAtPath: (path: string) => Promise<void>;
  initDatabase: (path: string, seed: boolean) => Promise<void>;
  closeDb: (id: string) => Promise<void>;
  setActive: (id: string) => void;
  setBranch: (branch: string) => void;
  setSpace: (space: string) => void;
  dismissNotice: () => void;
}

const Ctx = createContext<DatabasesCtx | null>(null);

let seq = 0;
const nextId = () => `db-${++seq}`;

const RECENTS_KEY = "strata.recents";
function loadRecents(): string[] {
  try {
    const v = JSON.parse(localStorage.getItem(RECENTS_KEY) ?? "[]");
    return Array.isArray(v) ? (v as string[]) : [];
  } catch {
    return [];
  }
}

/** ".../myproj/.strata" -> "myproj"; otherwise the last path segment. */
function basename(path: string): string {
  const parts = path.replace(/\/+$/, "").split("/");
  const last = parts[parts.length - 1] ?? path;
  if (last === ".strata" && parts.length >= 2) return parts[parts.length - 2];
  return last || path;
}

export function DatabasesProvider({ children }: { children: ReactNode }) {
  const [dbs, setDbs] = useState<OpenDb[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [opening, setOpening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [recents, setRecents] = useState<string[]>(loadRecents);

  const add = useCallback((db: OpenDb) => {
    setDbs((prev) => [...prev, db]);
    setActiveId(db.id);
  }, []);

  const addRecent = useCallback((path: string) => {
    setRecents((prev) => {
      const next = [path, ...prev.filter((p) => p !== path)].slice(0, 8);
      try {
        localStorage.setItem(RECENTS_KEY, JSON.stringify(next));
      } catch {
        // ignore storage failures
      }
      return next;
    });
  }, []);

  const openScratch = useCallback(async () => {
    setOpening(true);
    setError(null);
    try {
      const handle = await openMemory();
      await seedSample(handle);
      add({ id: nextId(), handle, label: "scratch", kind: "scratch", supportsBranching: false, currentBranch: "default", currentSpace: "default" });
    } catch (e) {
      setError(String(e));
    } finally {
      setOpening(false);
    }
  }, [add]);

  const openDiskDemo = useCallback(async () => {
    setOpening(true);
    setError(null);
    try {
      const path = `/tmp/strata-foundry-demo/db-${Date.now()}/.strata`;
      const handle = await openPath(path);
      await seedDiskSample(handle);
      add({ id: nextId(), handle, label: basename(path), kind: "disk", supportsBranching: true, currentBranch: "default", currentSpace: "default" });
    } catch (e) {
      setError(String(e));
    } finally {
      setOpening(false);
    }
  }, [add]);

  const openAtPath = useCallback(
    async (path: string) => {
      setOpening(true);
      setError(null);
      try {
        const handle = await openPath(path);
        addRecent(path);
        add({ id: nextId(), handle, label: basename(path), kind: "disk", supportsBranching: true, currentBranch: "default", currentSpace: "default" });
      } catch (e) {
        setError(String(e));
      } finally {
        setOpening(false);
      }
    },
    [add, addRecent],
  );

  const initDatabase = useCallback(
    async (path: string, seed: boolean) => {
      setOpening(true);
      setError(null);
      try {
        const info = await dbInit(path);
        if (seed) await seedSample(info.handle);
        addRecent(path);
        add({ id: nextId(), handle: info.handle, label: basename(path), kind: "disk", supportsBranching: true, currentBranch: "default", currentSpace: "default" });
        setNotice(
          `Created ${basename(path)} · ${info.profile} profile · ${info.cores} cores · ${info.ram_gb.toFixed(0)} GB RAM`,
        );
      } catch (e) {
        setError(String(e));
      } finally {
        setOpening(false);
      }
    },
    [add, addRecent],
  );

  const closeDb = useCallback(
    async (id: string) => {
      const db = dbs.find((d) => d.id === id);
      if (db) {
        try {
          await closeHandle(db.handle);
        } catch {
          // closing a stale handle is harmless
        }
      }
      const remaining = dbs.filter((d) => d.id !== id);
      setDbs(remaining);
      if (activeId === id) setActiveId(remaining[remaining.length - 1]?.id ?? null);
    },
    [dbs, activeId],
  );

  const setActive = useCallback((id: string) => setActiveId(id), []);

  const setBranch = useCallback(
    (branch: string) => {
      setDbs((prev) =>
        prev.map((d) => (d.id === activeId ? { ...d, currentBranch: branch, currentSpace: "default" } : d)),
      );
    },
    [activeId],
  );

  const setSpace = useCallback(
    (space: string) => {
      setDbs((prev) => prev.map((d) => (d.id === activeId ? { ...d, currentSpace: space } : d)));
    },
    [activeId],
  );

  const dismissNotice = useCallback(() => setNotice(null), []);

  const active = dbs.find((d) => d.id === activeId) ?? null;

  return (
    <Ctx.Provider
      value={{
        dbs,
        activeId,
        active,
        opening,
        error,
        notice,
        recents,
        openScratch,
        openDiskDemo,
        openAtPath,
        initDatabase,
        closeDb,
        setActive,
        setBranch,
        setSpace,
        dismissNotice,
      }}
    >
      {children}
    </Ctx.Provider>
  );
}

export function useDatabases(): DatabasesCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useDatabases must be used within a DatabasesProvider");
  return ctx;
}
