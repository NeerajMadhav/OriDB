/**
 * Toast notifications (top-right).
 */
import { useEffect } from "react";
import { X } from "lucide-react";
import { useUiStore } from "../stores/uiStore";

export function ToastHost() {
  const toasts = useUiStore((s) => s.toasts);
  const remove = useUiStore((s) => s.removeToast);

  useEffect(() => {
    const timers = toasts.map((t) =>
      window.setTimeout(() => remove(t.id), 4000),
    );
    return () => timers.forEach(clearTimeout);
  }, [toasts, remove]);

  return (
    <div className="fixed right-4 top-4 z-[60] flex flex-col gap-2">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={
            "border-border flex min-w-[240px] max-w-sm items-start gap-2 rounded-lg border px-3 py-2 text-sm shadow " +
            (t.type === "success"
              ? "border-success/40 bg-surface-elevated"
              : t.type === "error"
                ? "border-error/40 bg-surface-elevated"
                : "bg-surface-elevated")
          }
        >
          <span className="text-text-primary flex-1">{t.message}</span>
          <button
            type="button"
            className="text-text-muted hover:text-text-primary"
            aria-label="Dismiss"
            onClick={() => remove(t.id)}
          >
            <X size={16} />
          </button>
        </div>
      ))}
    </div>
  );
}
