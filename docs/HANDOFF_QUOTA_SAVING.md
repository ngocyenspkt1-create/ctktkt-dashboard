# CTKTKT read quota reduction — 2026-10-19

## Implemented
- PPA and BCSX request `scope=daily-links`; skip the annual operating-hours query they do not consume. Full CTKTKT and exports still use the same formulas and cumulative base 2026-01-01.
- BCSX reads daily inputs for the selected date and CTKTKT for that date plus the previous date (meter carryover). Existing monthly consumers retain their response shape/default range.
- PPA initially opens the operating month (based on D-1), with 15-day/all-history options available on click.
- Work PX polls at 5 minutes while visible; focus refresh only after 5 minutes since successful load. Manual refresh and post-save reload remain immediate. Session permission checks unchanged.
- Added field-first daily_inputs index to declared/new database schema, plus a repeatable standalone migration and `npm.cmd run storage:optimize`. No data deletion or new dependency.
- PPA/BCSX surface linked API failures instead of silently presenting empty linked values.

## Verified
- 406 tests pass, including 6 new scope/polling tests; real route handlers exercised against synthetic in-memory SQLite data.
- Full/scoped PPA and BCSX outputs yield identical derived daily values; annual cumulative totals still include January data. Bounds cover leap day/month/year transitions; auth/invalid ranges reject before data queries.
- Synthetic SQLite query plan chooses `idx_daily_inputs_field_date`, identical results before/after repeatable index migration. No measured production reduction claimed.

## Provider blocker / next step
- Live `storage:optimize` and `storage:check` both returned Turso quota BLOCKED on 2026-10-19. New index is NOT confirmed applied to production.
- User explicitly chose to retain Free and wait for the next quota cycle. Previously verified billing cycle ends 2026-11-01; exact reset hour not known. No paid plan/security changes.
- Once Turso unblocks: run `npm.cmd run storage:optimize`, then `npm.cmd run storage:check`; verify authenticated CTKTKT/PPA/BCSX/Work PX reads and compare analytics. Do not mark recovery complete based only on deployment success.
- Browser reinspection was unavailable this turn because local browser use is disabled in Work settings. Provider SQL blocker was confirmed directly; no current authenticated usage numbers inferred.
