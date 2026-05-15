/**
 * Shared UI primitives — buttons, inputs, cards, badges.
 */
import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode } from "react";

export function EngineBadge({ engine }: { engine: string }) {
  const colors: Record<string, string> = {
    postgresql: "bg-[#336791]/12 text-[#336791] dark:text-[#7eb8e8]",
    mysql: "bg-[#00758f]/12 text-[#00758f] dark:text-[#5bc0de]",
    mariadb: "bg-[#c0765a]/12 text-[#a0522d]",
    sqlite: "bg-text-muted/15 text-text-secondary",
    mongodb: "bg-[#4db33d]/12 text-[#3d8c31] dark:text-[#6ddf5c]",
    redis: "bg-[#dc382d]/12 text-[#dc382d] dark:text-[#f08080]",
  };
  const cls = colors[engine] ?? "bg-selection text-text-secondary";
  return (
    <span
      className={`inline-flex items-center rounded-md px-1.5 py-0.5 font-mono text-[10px] font-medium uppercase tracking-wide ${cls}`}
    >
      {engine}
    </span>
  );
}

export function Card({
  children,
  className = "",
  padding = "md",
}: {
  children: ReactNode;
  className?: string;
  padding?: "none" | "sm" | "md" | "lg";
}) {
  const pad =
    padding === "none"
      ? ""
      : padding === "sm"
        ? "p-3"
        : padding === "lg"
          ? "p-6"
          : "p-4";
  return (
    <motion
      className={`oridb-card ${pad} ${className}`}
    >
      {children}
    </motion>
  );
}

export function PanelHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <motion
      className="border-border flex items-start justify-between gap-2 border-b px-3 py-2.5"
    >
      <div>
        <h2 className="text-text-primary text-sm font-semibold tracking-tight">{title}</h2>
        {subtitle && (
          <p className="text-text-muted mt-0.5 text-[11px]">{subtitle}</p>
        )}
      </div>
      {action}
    </motion>
  );
}

export function Btn({
  variant = "secondary",
  size = "md",
  className = "",
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md";
}) {
  const base = "oridb-btn inline-flex items-center justify-center gap-1.5 font-medium transition-all duration-150 disabled:opacity-50 disabled:pointer-events-none";
  const variants = {
    primary: "oridb-btn-primary",
    secondary: "oridb-btn-secondary",
    ghost: "oridb-btn-ghost",
    danger: "oridb-btn-danger",
  };
  const sizes = size === "sm" ? "h-7 px-2.5 text-xs rounded-md" : "h-9 px-3.5 text-sm rounded-lg";
  return (
    <button
      type="button"
      className={`${base} ${variants[variant]} ${sizes} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input className="oridb-input" {...props} />;
}

export function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className="oridb-input oridb-select" {...props} />;
}

export function Label({ children }: { children: ReactNode }) {
  return (
    <span className="text-text-muted mb-1.5 block text-[11px] font-medium uppercase tracking-wider">
      {children}
    </span>
  );
}

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <motion
      className="flex flex-col items-center justify-center px-6 py-12 text-center"
    >
      {icon && (
        <motion className="text-text-muted/40 mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-selection/40">
          {icon}
        </motion>
      )}
      <p className="text-text-primary text-sm font-medium">{title}</p>
      {description && (
        <p className="text-text-muted mt-1.5 max-w-xs text-xs leading-relaxed">{description}</p>
      )}
      {action && <motion className="mt-4">{action}</motion>}
    </motion>
  );
}

export function Kbd({ children }: { children: ReactNode }) {
  return <kbd className="oridb-kbd">{children}</kbd>;
}

/** Avoid typo: use div wrapper named motion for fragment-like layout blocks */
function motion({
  className = "",
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return <motion className={className}>{children}</motion>;
}
