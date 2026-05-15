/**
 * In-app notifications (import/export, connection events).
 */
import { create } from "zustand";

export type AppNotification = {
  id: string;
  at: string;
  type: "info" | "success" | "error";
  title: string;
  body?: string;
};

type NState = {
  items: AppNotification[];
  push: (n: Omit<AppNotification, "id" | "at">) => void;
  clear: () => void;
};

export const useNotificationStore = create<NState>((set, get) => ({
  items: [],
  push: (n) =>
    set({
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
