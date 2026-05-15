/**
 * Toast notifications (top-right).
 */
import { useEffect } from "react";
import { CheckCircle2, AlertCircle, Info, X } from "lucide-react";
import { useUiStore } from "../stores/uiStore";

const icons = {
  success: CheckCircle2,
  error: AlertCircle,
  info: Info,
};

export function ToastHost() {
  const toasts = useUiStore((s) => s.toasts);
  const remove = useUiStore((s) => s.removeToast);

  useEffect(() => {
    const timers = toasts.map((t) =>
      window.setTimeout(() => remove(t.id), 4500),
    );
    return () => timers.forEach(clearTimeout);
  }, [toasts, remove]);

  return (
    <div className="pointer-events-none fixed top-16 right-4 z-[60] flex flex-col gap-2">
      {toasts.map((t) => {
        const Icon = icons[t.type] ?? Info;
        return (
          <div
            key={t.id}
            className={
              "oridb-card pointer-events-auto flex min-w-[280px] max-w-sm items-start gap-3 border px-4 py-3 text-sm shadow-lg " +
              (t.type === "success"
                ? "border-success/30"
                : t.type === "error"
                  ? "border-error/30"
                  : "border-border")
            }
            role="status"
          >
            <Icon
              className={
                "mt-0.5 h-4 w-4 shrink-0 " +
                (t.type === "success"
                  ? "text-success"
                  : t.type === "error"
                    ? "text-error"
                    : "text-text-muted")
              }
            />
            <span className="text-text-primary flex-1 leading-snug">{t.message}</span>
            <button
              type="button"
              className="text-text-muted hover:text-text-primary shrink-0 rounded p-0.5"
              aria-label="Dismiss"
              onClick={() => remove(t.id)}
            >
              <X size={16} />
            </button>
          </div>
        );
      })}
    </div>
  );
}
