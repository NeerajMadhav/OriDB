/**
 * Active connection and workspace session.
 */
import { create } from "zustand";
import { persist } from "zustand/middleware";

export type ConnectionSummary = {
  id: string;
  name: string;
  engine: string;
  host?: string;
  database?: string;
};

type SessionState = {
  activeConnectionId: string | null;
  connectionName: string | null;
  engine: string | null;
  connected: boolean;
  selectedSchema: string;
  setActive: (
    id: string | null,
    connected?: boolean,
    meta?: { name?: string; engine?: string },
  ) => void;
  setSelectedSchema: (schema: string) => void;
};

export const useSessionStore = create<SessionState>()(
  persist(
    (set) => ({
      activeConnectionId: null,
      connectionName: null,
      engine: null,
      connected: false,
      selectedSchema: "public",
      setActive: (activeConnectionId, connected = false, meta) =>
        set({
          activeConnectionId,
          connected: !!connected,
          connectionName: meta?.name ?? null,
          engine: meta?.engine ?? null,
          selectedSchema:
            meta?.engine === "sqlite" ? "main" : "public",
        }),
      setSelectedSchema: (selectedSchema) => set({ selectedSchema }),
    }),
    {
      name: "oridb-session",
      partialize: (s) => ({
        activeConnectionId: s.activeConnectionId,
        connectionName: s.connectionName,
        engine: s.engine,
        selectedSchema: s.selectedSchema,
      }),
    },
  ),
);
