/**
 * Active connection and workspace session.
 */
import { create } from "zustand";
import { persist } from "zustand/middleware";
/** Default schema name for an engine when none is configured. */
export function defaultSchemaForEngine(engine, override) {
    if (override?.trim())
        return override.trim();
    if (engine === "sqlite")
        return "main";
    if (engine === "snowflake")
        return "PUBLIC";
    return "public";
}
export const useSessionStore = create()(persist((set) => ({
    activeConnectionId: null,
    connectionName: null,
    engine: null,
    connected: false,
    selectedSchema: "public",
    setActive: (activeConnectionId, connected = false, meta) => set({
        activeConnectionId,
        connected: !!connected,
        connectionName: meta?.name ?? null,
        engine: meta?.engine ?? null,
        selectedSchema: defaultSchemaForEngine(meta?.engine ?? null, meta?.defaultSchema),
    }),
    setSelectedSchema: (selectedSchema) => set({ selectedSchema }),
}), {
    name: "oridb-session",
    partialize: (s) => ({
        activeConnectionId: s.activeConnectionId,
        connectionName: s.connectionName,
        engine: s.engine,
        selectedSchema: s.selectedSchema,
    }),
}));
