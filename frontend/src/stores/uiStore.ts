/**
 * UI shell state: theme, panel layout, toasts, command palette.
 */
import { create } from "zustand";
import { persist } from "zustand/middleware";

export type Toast = { id: string; type: "success" | "error" | "info"; message: string };

type UiState = {
  theme: "light" | "dark" | "system";
  sidebarCollapsed: boolean;
  inspectorCollapsed: boolean;
  centerMaximized: boolean;
  commandOpen: boolean;
  toasts: Toast[];
  setTheme: (t: UiState["theme"]) => void;
  toggleSidebar: () => void;
  toggleInspector: () => void;
  toggleCenterMax: () => void;
  setCommandOpen: (v: boolean) => void;
  pushToast: (t: Omit<Toast, "id">) => void;
  removeToast: (id: string) => void;
};

export const useUiStore = create<UiState>()(
  persist(
    (set, get) => ({
      theme: "system",
      sidebarCollapsed: false,
      inspectorCollapsed: false,
      centerMaximized: false,
      commandOpen: false,
      toasts: [],
      setTheme: (theme) => set({ theme }),
      toggleSidebar: () => set({ sidebarCollapsed: !get().sidebarCollapsed }),
      toggleInspector: () => set({ inspectorCollapsed: !get().inspectorCollapsed }),
      toggleCenterMax: () => set({ centerMaximized: !get().centerMaximized }),
      setCommandOpen: (commandOpen) => set({ commandOpen }),
      pushToast: (t) =>
        set({
          toasts: [
            ...get().toasts,
            { ...t, id: crypto.randomUUID().slice(0, 8) },
          ].slice(-5),
        }),
      removeToast: (id) =>
        set({ toasts: get().toasts.filter((x) => x.id !== id) }),
    }),
    { name: "oridb-ui" },
  ),
);
