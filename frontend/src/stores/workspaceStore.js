/**
 * Workspace tabs, inspector context, query status bar metrics.
 */
import { create } from "zustand";
import { persist } from "zustand/middleware";
export const useWorkspaceStore = create()(persist((set, get) => ({
    tabs: [{ id: "default", title: "Query 1", kind: "query", sql: "SELECT 1 AS one;" }],
    activeTabId: "default",
    inspector: { type: "none" },
    lastQueryMs: null,
    lastRows: null,
    lastAffected: null,
    wsConnected: false,
    inTransaction: false,
    addTab: (tab) => {
        const id = crypto.randomUUID().slice(0, 8);
        set({
            tabs: [...get().tabs, { ...tab, id }],
            activeTabId: id,
        });
        return id;
    },
    closeTab: (id) => {
        const tabs = get().tabs.filter((t) => t.id !== id);
        const activeTabId = get().activeTabId === id ? (tabs[0]?.id ?? null) : get().activeTabId;
        set({ tabs: tabs.length ? tabs : [{ id: "default", title: "Query 1", kind: "query" }], activeTabId });
    },
    setActiveTab: (id) => set({ activeTabId: id }),
    updateTab: (id, patch) => set({
        tabs: get().tabs.map((t) => (t.id === id ? { ...t, ...patch } : t)),
    }),
    setInspector: (inspector) => set({ inspector }),
    setQueryMetrics: (m) => set({
        lastQueryMs: m.durationMs ?? get().lastQueryMs,
        lastRows: m.rows ?? get().lastRows,
        lastAffected: m.affected ?? get().lastAffected,
    }),
    setWsConnected: (wsConnected) => set({ wsConnected }),
    setInTransaction: (inTransaction) => set({ inTransaction }),
}), {
    name: "oridb-workspace",
    partialize: (s) => ({ tabs: s.tabs, activeTabId: s.activeTabId }),
}));
