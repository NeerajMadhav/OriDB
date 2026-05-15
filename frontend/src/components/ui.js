import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
export function EngineBadge({ engine }) {
    const colors = {
        postgresql: "bg-[#336791]/12 text-[#336791] dark:text-[#7eb8e8]",
        mysql: "bg-[#00758f]/12 text-[#00758f] dark:text-[#5bc0de]",
        mariadb: "bg-[#c0765a]/12 text-[#a0522d]",
        sqlite: "bg-text-muted/15 text-text-secondary",
        mongodb: "bg-[#4db33d]/12 text-[#3d8c31] dark:text-[#6ddf5c]",
        redis: "bg-[#dc382d]/12 text-[#dc382d] dark:text-[#f08080]",
    };
    const cls = colors[engine] ?? "bg-selection text-text-secondary";
    return (_jsx("span", { className: `inline-flex items-center rounded-md px-1.5 py-0.5 font-mono text-[10px] font-medium uppercase tracking-wide ${cls}`, children: engine }));
}
export function Card({ children, className = "", padding = "md", }) {
    const pad = padding === "none"
        ? ""
        : padding === "sm"
            ? "p-3"
            : padding === "lg"
                ? "p-6"
                : "p-4";
    return _jsx("div", { className: `oridb-card ${pad} ${className}`, children: children });
}
export function PanelHeader({ title, subtitle, action, }) {
    return (_jsxs("div", { className: "border-border flex items-start justify-between gap-2 border-b px-3 py-2.5", children: [_jsxs("div", { children: [_jsx("h2", { className: "text-text-primary text-sm font-semibold tracking-tight", children: title }), subtitle && (_jsx("p", { className: "text-text-muted mt-0.5 text-[11px]", children: subtitle }))] }), action] }));
}
export function Btn({ variant = "secondary", size = "md", className = "", children, ...props }) {
    const base = "oridb-btn inline-flex items-center justify-center gap-1.5 font-medium transition-all duration-150 disabled:opacity-50 disabled:pointer-events-none";
    const variants = {
        primary: "oridb-btn-primary",
        secondary: "oridb-btn-secondary",
        ghost: "oridb-btn-ghost",
        danger: "oridb-btn-danger",
    };
    const sizes = size === "sm" ? "h-7 px-2.5 text-xs rounded-md" : "h-9 px-3.5 text-sm rounded-lg";
    return (_jsx("button", { type: "button", className: `${base} ${variants[variant]} ${sizes} ${className}`, ...props, children: children }));
}
export function Input(props) {
    return _jsx("input", { className: "oridb-input", ...props });
}
export function Select(props) {
    return _jsx("select", { className: "oridb-input oridb-select", ...props });
}
export function Label({ children }) {
    return (_jsx("span", { className: "text-text-muted mb-1.5 block text-[11px] font-medium uppercase tracking-wider", children: children }));
}
export function EmptyState({ icon, title, description, action, }) {
    return (_jsxs("div", { className: "flex flex-col items-center justify-center px-6 py-12 text-center", children: [icon && (_jsx("div", { className: "text-text-muted/40 mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-selection/40", children: icon })), _jsx("p", { className: "text-text-primary text-sm font-medium", children: title }), description && (_jsx("p", { className: "text-text-muted mt-1.5 max-w-xs text-xs leading-relaxed", children: description })), action && _jsx("div", { className: "mt-4", children: action })] }));
}
export function Kbd({ children }) {
    return _jsx("kbd", { className: "oridb-kbd", children: children });
}
