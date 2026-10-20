import {createHash} from 'node:crypto';
import {unstable_cache} from 'next/cache';
import {operationalReadKeys} from './operational-query-policy';

type Rows = Record<string, unknown>[];
type Versions = Record<string, number>;
const pending = new Map<string, Promise<Rows>>();
const MAX_CACHE_BYTES = 1_800_000;

class UncachedResult extends Error {
  constructor(readonly rows: Rows) { super('Operating result exceeds cache entry budget.'); }
}

/** Revision keys come from the database, outside Next's cache. This keeps
 * caches coherent across Vercel instances without caching sessions or auth. */
export async function cachedOperationalRows(
  sql: string, args: unknown[], namespace: string,
  loadVersions: () => Promise<Versions>, loadRows: () => Promise<Rows>,
): Promise<Rows> {
  const keys = operationalReadKeys(sql, args);
  if (!keys || process.env.CTKTKT_READ_CACHE === 'off'
    || args.some(value => typeof value === 'bigint' || (value !== null && typeof value === 'object'))) return loadRows();
  const versions = await loadVersions();
  const revision = keys.map(key => [key, versions[key] || 0]);
  const key = createHash('sha256').update(JSON.stringify([namespace, sql, args, revision])).digest('hex');
  const active = pending.get(key);
  if (active) return structuredClone(await active);
  let started = false, completed: Rows | undefined;
  const read = unstable_cache(async () => {
    started = true;
    completed = await loadRows();
    if (Buffer.byteLength(JSON.stringify(completed), 'utf8') > MAX_CACHE_BYTES) throw new UncachedResult(completed);
    return completed;
  }, ['ctktkt-operational-rows-v1', key], {revalidate: 86_400});
  const promise = read().catch(async error => {
    if (error instanceof UncachedResult) return error.rows;
    // A cache-store failure must not repeat an already successful SQL read.
    if (completed) return completed;
    if (!started && /incrementalCache missing|invariant.*cache/i.test(String(error?.message))) return loadRows();
    throw error;
  });
  pending.set(key, promise);
  try { return structuredClone(await promise); }
  finally { if (pending.get(key) === promise) pending.delete(key); }
}
