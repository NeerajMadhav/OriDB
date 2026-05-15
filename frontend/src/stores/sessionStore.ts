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
  defaultSchema?: string;
};

/** Default schema name for an engine when none is configured. */
export function defaultSchemaForEngine(
  engine: string | null | undefined,
  override?: string,
): string {
  if (override?.trim()) return override.trim();
  if (engine === "sqlite") return "main";
  if (engine === "snowflake") return "PUBLIC";
  return "public";
}

type SessionState = {
  activeConnectionId: string | null;
  connectionName: string | null;
  engine: string | null;
  connected: boolean;
  selectedSchema: string;
  setActive: (
    id: string | null,
    connected?: boolean,
    meta?: { name?: string; engine?: string; defaultSchema?: string },
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
          selectedSchema: defaultSchemaForEngine(
            meta?.engine ?? null,
            meta?.defaultSchema,
          ),
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
