/**
 * UI shell state: theme, panel layout, toasts, command palette.
 */
import { create } from "zustand";
import { persist } from "zustand/middleware";
export const useUiStore = create()(persist((set, get) => ({
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
    pushToast: (t) => set({
        toasts: [
            ...get().toasts,
            { ...t, id: crypto.randomUUID().slice(0, 8) },
        ].slice(-5),
    }),
    removeToast: (id) => set({ toasts: get().toasts.filter((x) => x.id !== id) }),
}), { name: "oridb-ui" }));
