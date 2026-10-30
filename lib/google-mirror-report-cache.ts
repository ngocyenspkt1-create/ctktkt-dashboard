import {createHash} from 'node:crypto';
import {gzipSync, gunzipSync} from 'node:zlib';
import {unstable_cache} from 'next/cache';
import type {MirrorTab} from './google-mirror';

type Versions = Record<string, number>;
const pending = new Map<string, Promise<MirrorTab[]>>();
const MAX_CACHE_BYTES = 1_800_000;
class LargeReport extends Error {
  constructor(readonly tabs: MirrorTab[]) { super('Mirror report exceeds cache budget.'); }
}

export function mirrorReportRevision(report: 'ctktkt' | 'water', period: string, day: string, versions: Versions) {
  // CTKTKT includes year-to-date operating hours and previous-day carryovers;
  // water includes the latest baseline BEFORE this month. Global source revisions
  // deliberately cover historical edits, rather than only the displayed month.
  const sources = report === 'ctktkt' ? ['daily_inputs', 'shift_readings', 'water_shift_logs'] : ['water_shift_logs'];
  return createHash('sha256').update(JSON.stringify([
    'mirror-report-v1', process.env.TURSO_DATABASE_URL || '', process.env.VERCEL_GIT_COMMIT_SHA || 'local',
    report, period, day, sources.map(source => [source, versions[source] || 0]),
  ])).digest('hex');
}

/** Cache only operational mirror matrices. Callers must authenticate first and
 * supply freshly read source revisions; never use this for sessions or ACLs. */
export async function cachedMirrorReport(revision: string, build: () => Promise<MirrorTab[]>): Promise<MirrorTab[]> {
  if (process.env.CTKTKT_READ_CACHE === 'off') return build();
  const active = pending.get(revision);
  if (active) return structuredClone(await active);
  let started = false, completed: MirrorTab[] | undefined;
  const read = unstable_cache(async () => {
    started = true;
    completed = await build();
    // Repeated template formulas compress well. Store a bounded JSON projection,
    // never a live mutable workbook or a second XLSX serialization.
    const packed = gzipSync(JSON.stringify(completed), {level: 1}).toString('base64');
    if (Buffer.byteLength(JSON.stringify(packed), 'utf8') > MAX_CACHE_BYTES) throw new LargeReport(completed);
    return packed;
  }, ['ctktkt-mirror-report-v1', revision], {revalidate: 86_400});
  const promise = (async () => {
    try { return JSON.parse(gunzipSync(Buffer.from(await read(), 'base64')).toString('utf8')) as MirrorTab[]; }
    catch (error) {
      if (error instanceof LargeReport) return error.tabs;
      if (completed) return completed; // Cache-store failure: do not build twice.
      if (!started && /incrementalCache missing|invariant.*cache/i.test(String((error as Error)?.message))) return build();
      throw error;
    }
  })();
  pending.set(revision, promise);
  try { return structuredClone(await promise); }
  finally { if (pending.get(revision) === promise) pending.delete(revision); }
}
