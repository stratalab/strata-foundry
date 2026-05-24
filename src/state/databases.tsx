// Multiple open databases, each with its own handle. Tabs switch the active one.

import { createContext, useContext, useState, useCallback } from "react";
import type { ReactNode } from "react";
import { openMemory, open as openPath, close as closeHandle } from "../lib/strata";
import type { Handle } from "../lib/strata";
import { seedSample } from "../lib/sample";

export type DbKind = "scratch" | "disk";

export interface OpenDb {
  id: string;
  handle: Handle;
  label: string;
  kind: DbKind;
  /** Branching requires a disk-backed database; scratch DBs can't fork. */
  supportsBranching: boolean;
}

interface DatabasesCtx {
  dbs: OpenDb[];
  activeId: string | null;
  active: OpenDb | null;
  opening: boolean;
  error: string | null;
  openScratch: () => Promise<void>;
  openAtPath: (path: string) => Promise<void>;
  closeDb: (id: string) => Promise<void>;
  setActive: (id: string) => void;
}

const Ctx = createContext<DatabasesCtx | null>(null);

let seq = 0;
const nextId = () => `db-${++seq}`;

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

  const add = useCallback((db: OpenDb) => {
    setDbs((prev) => [...prev, db]);
    setActiveId(db.id);
  }, []);

  const openScratch = useCallback(async () => {
    setOpening(true);
    setError(null);
    try {
      const handle = await openMemory();
      await seedSample(handle);
      add({ id: nextId(), handle, label: "scratch", kind: "scratch", supportsBranching: false });
    } catch (e) {
      setError(String(e));
    } finally {
      setOpening(false);
    }
  }, [add]);

  const openAtPath = useCallback(async (path: string) => {
    setOpening(true);
    setError(null);
    try {
      const handle = await openPath(path);
      add({ id: nextId(), handle, label: basename(path), kind: "disk", supportsBranching: true });
    } catch (e) {
      setError(String(e));
    } finally {
      setOpening(false);
    }
  }, [add]);

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

  const active = dbs.find((d) => d.id === activeId) ?? null;

  return (
    <Ctx.Provider
      value={{ dbs, activeId, active, opening, error, openScratch, openAtPath, closeDb, setActive }}
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
