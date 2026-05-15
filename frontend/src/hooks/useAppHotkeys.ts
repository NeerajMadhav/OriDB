/**
 * Global keyboard shortcuts (Cmd/Ctrl normalized).
 */
import { useEffect } from "react";
import { useUiStore } from "../stores/uiStore";

export function useAppHotkeys(): void {
  const toggleSidebar = useUiStore((s) => s.toggleSidebar);
  const toggleInspector = useUiStore((s) => s.toggleInspector);
  const toggleCenterMax = useUiStore((s) => s.toggleCenterMax);
  const setCommandOpen = useUiStore((s) => s.setCommandOpen);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key.toLowerCase() === "b") {
        e.preventDefault();
        toggleSidebar();
      }
      if (mod && e.key.toLowerCase() === "j") {
        e.preventDefault();
        toggleInspector();
      }
      if (mod && e.shiftKey && e.key.toLowerCase() === "f") {
        e.preventDefault();
        toggleCenterMax();
      }
      if (mod && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setCommandOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [toggleSidebar, toggleInspector, toggleCenterMax, setCommandOpen]);
}
