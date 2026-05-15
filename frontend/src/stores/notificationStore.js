/**
 * In-app notifications (import/export, connection events).
 */
import { create } from "zustand";
export const useNotificationStore = create((set, get) => ({
    items: [],
    push: (n) => set({
        items: [
            {
                ...n,
                id: crypto.randomUUID().slice(0, 8),
                at: new Date().toISOString(),
            },
            ...get().items,
        ].slice(0, 50),
    }),
    clear: () => set({ items: [] }),
}));
