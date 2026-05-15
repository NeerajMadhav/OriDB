/**
 * Workspace tabs, inspector context, query status bar metrics.
 */
import { create } from "zustand";
import { persist } from "zustand/middleware";

export type QueryResultSet = {
  columns: { name: string }[];
  rows: Record<string, unknown>[];
};

export type EditorTab = {
  id: string;
  title: string;
  kind: "query" | "table" | "visual";
  sql?: string;
  table?: string;
  schema?: string;
  unsaved?: boolean;
  lastResults?: QueryResultSet[];
  lastMessages?: string[];
};

export type InspectorContext =
  | { type: "none" }
  | { type: "table"; table: string; stats?: Record<string, unknown> }
  | { type: "column"; table: string; column: string; stats?: Record<string, unknown> }
  | { type: "query"; durationMs?: number; rows?: number; status?: string };

type WorkspaceState = {
  tabs: EditorTab[];
  activeTabId: string | null;
  inspector: InspectorContext;
  lastQueryMs: number | null;
  lastRows: number | null;
  lastAffected: number | null;
  wsConnected: boolean;
  inTransaction: boolean;
  addTab: (tab: Omit<EditorTab, "id">) => string;
  closeTab: (id: string) => void;
  setActiveTab: (id: string) => void;
  updateTab: (id: string, patch: Partial<EditorTab>) => void;
  setInspector: (ctx: InspectorContext) => void;
  setQueryMetrics: (m: { durationMs?: number; rows?: number; affected?: number }) => void;
  setWsConnected: (v: boolean) => void;
  setInTransaction: (v: boolean) => void;
};

export const useWorkspaceStore = create<WorkspaceState>()(
  persist(
    (set, get) => ({
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
        const activeTabId =
          get().activeTabId === id ? (tabs[0]?.id ?? null) : get().activeTabId;
        set({ tabs: tabs.length ? tabs : [{ id: "default", title: "Query 1", kind: "query" }], activeTabId });
      },
      setActiveTab: (id) => set({ activeTabId: id }),
      updateTab: (id, patch) =>
        set({
          tabs: get().tabs.map((t) => (t.id === id ? { ...t, ...patch } : t)),
        }),
      setInspector: (inspector) => set({ inspector }),
      setQueryMetrics: (m) =>
        set({
          lastQueryMs: m.durationMs ?? get().lastQueryMs,
          lastRows: m.rows ?? get().lastRows,
          lastAffected: m.affected ?? get().lastAffected,
        }),
      setWsConnected: (wsConnected) => set({ wsConnected }),
      setInTransaction: (inTransaction) => set({ inTransaction }),
    }),
    {
      name: "oridb-workspace",
      partialize: (s) => ({ tabs: s.tabs, activeTabId: s.activeTabId }),
    },
  ),
);
