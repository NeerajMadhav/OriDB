/**
 * Typed fetch helper for OriDB API.
 */
const base = () => import.meta.env.VITE_API_BASE ?? "/api";
export async function api(path, init) {
    const isForm = typeof FormData !== "undefined" && init?.body instanceof FormData;
    const res = await fetch(`${base()}${path}`, {
        ...init,
        headers: {
            ...(isForm ? {} : { "Content-Type": "application/json" }),
            ...(init?.headers ?? {}),
        },
        credentials: "include",
    });
    const text = await res.text();
    const data = text ? JSON.parse(text) : {};
    if (!res.ok) {
        const msg = data?.error?.message ?? data?.message ?? res.statusText ?? "Request failed";
        throw new Error(msg);
    }
    return data;
}
