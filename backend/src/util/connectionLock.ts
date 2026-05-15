/**
 * Serializes connect/disconnect per connection id to avoid overlapping pool lifecycle.
 */
const chains = new Map<string, Promise<unknown>>();

export function withConnectionLock<T>(
  id: string,
  op: () => Promise<T>,
): Promise<T> {
  const prev = chains.get(id) ?? Promise.resolve();
  const next = prev.catch(() => undefined).then(op);
  chains.set(id, next);
  return next.finally(() => {
    if (chains.get(id) === next) chains.delete(id);
  }) as Promise<T>;
}
