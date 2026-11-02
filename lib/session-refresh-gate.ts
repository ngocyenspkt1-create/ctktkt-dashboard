/** Coalesce focus/visibility/timer requests without changing the 60s permission
 * refresh interval. Explicit permission updates get a fresh trailing request. */
export function createSessionRefreshGate(refresh: () => Promise<void>, now = Date.now) {
  let active = true, pending: Promise<void> | undefined, trailing = false;
  let completedAt = -Infinity;
  const request = (force = false): Promise<void> => {
    if (!active) return Promise.resolve();
    if (pending) { if (force) trailing = true; return pending; }
    if (!force && now() - completedAt < 1000) return Promise.resolve();
    pending = (async () => {
      do {
        trailing = false;
        await refresh();
        completedAt = now();
      } while (active && trailing);
    })().finally(() => { pending = undefined; });
    return pending;
  };
  return {request, cancel: () => { active = false; trailing = false; }};
}
