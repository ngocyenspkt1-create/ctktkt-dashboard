// Use after source data is changed by a tool that bypasses getRawDb().
// Only revision counters change; no operating records are altered.
import {existsSync} from 'node:fs';
import {createClient} from '@libsql/client/http';
if(existsSync('.env.local'))process.loadEnvFile('.env.local');
const tables=['daily_inputs','shift_readings','water_shift_logs','ppa_heat_rate_daily','chemical_usage_logs','operating_events'];
if(!process.env.TURSO_DATABASE_URL)throw new Error('Missing database configuration.');
const client=createClient({url:process.env.TURSO_DATABASE_URL,authToken:process.env.TURSO_AUTH_TOKEN});
try {
 await client.execute('CREATE TABLE IF NOT EXISTS operational_read_versions (cache_key TEXT PRIMARY KEY, version INTEGER NOT NULL DEFAULT 0)');
 await client.batch(tables.flatMap(table=>[table,table+':all']).map(key=>({
  sql:'INSERT INTO operational_read_versions (cache_key, version) VALUES (?, 1) ON CONFLICT(cache_key) DO UPDATE SET version = version + 1',args:[key],
 })),'write');
 console.log(JSON.stringify({status:'OK',invalidatedTables:tables.length,operatingRowsChanged:0}));
} catch {console.error('CACHE_REFRESH_ERROR: could not refresh source versions; no success claimed.');process.exitCode=1;}
finally {client.close();}
