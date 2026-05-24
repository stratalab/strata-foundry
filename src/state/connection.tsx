// Active database connection, shared across the app via context.

import { createContext, useContext, useState, useCallback } from "react";
import type { ReactNode } from "react";
import { openMemory, open as openPath, close as closeHandle } from "../lib/strata";
import type { Handle } from "../lib/strata";

type Status = "disconnected" | "connecting" | "connected";

interface ConnectionCtx {
  status: Status;
  handle: Handle | null;
  label: string | null;
  error: string | null;
  openScratch: () => Promise<void>;
  openAtPath: (path: string) => Promise<void>;
  disconnect: () => Promise<void>;
}

const Ctx = createContext<ConnectionCtx | null>(null);

export function ConnectionProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<Status>("disconnected");
  const [handle, setHandle] = useState<Handle | null>(null);
  const [label, setLabel] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const openScratch = useCallback(async () => {
    setStatus("connecting");
    setError(null);
    try {
      const h = await openMemory();
      setHandle(h);
      setLabel("scratch (in-memory)");
      setStatus("connected");
    } catch (e) {
      setError(String(e));
      setStatus("disconnected");
    }
  }, []);

  const openAtPath = useCallback(async (path: string) => {
    setStatus("connecting");
    setError(null);
    try {
      const h = await openPath(path);
      setHandle(h);
      setLabel(path);
      setStatus("connected");
    } catch (e) {
      setError(String(e));
      setStatus("disconnected");
    }
  }, []);

  const disconnect = useCallback(async () => {
    if (handle !== null) {
      try {
        await closeHandle(handle);
      } catch {
        // ignore — closing a stale handle is harmless
      }
    }
    setHandle(null);
    setLabel(null);
    setStatus("disconnected");
  }, [handle]);

  return (
    <Ctx.Provider
      value={{ status, handle, label, error, openScratch, openAtPath, disconnect }}
    >
      {children}
    </Ctx.Provider>
  );
}

export function useConnection(): ConnectionCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useConnection must be used within a ConnectionProvider");
  return ctx;
}
