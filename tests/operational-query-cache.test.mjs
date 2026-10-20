import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync,existsSync} from 'node:fs';
import {createRequire} from 'node:module';
import path from 'node:path';
import vm from 'node:vm';
import ts from 'typescript';
import {operationalReadKeys,operationalWriteKeys} from '../lib/operational-query-policy.ts';

const root=path.resolve(import.meta.dirname,'..'),require=createRequire(import.meta.url);
function loadTs(relative,overrides,modules=new Map()) {
 const filename=path.resolve(root,relative);
 if(modules.has(filename))return modules.get(filename).exports;
 const compiled={exports:{}};modules.set(filename,compiled);
 const localRequire=name=>{
  if(name in overrides)return overrides[name];
  if(!name.startsWith('.')&&!name.startsWith('@/'))return require(name);
  const base=name.startsWith('@/')?path.join(root,name.slice(2)):path.resolve(path.dirname(filename),name);
  const target=[base,base+'.ts',base+'/index.ts'].find(p=>existsSync(p)&&p.endsWith('.ts'));
  if(!target)throw new Error('Missing test module '+name);
  return loadTs(target,overrides,modules);
 };
 const code=ts.transpileModule(readFileSync(filename,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText;
 vm.runInNewContext(code,{module:compiled,exports:compiled.exports,require:localRequire,process:{env:{TURSO_DATABASE_URL:'https://synthetic.test/database'}},Buffer,structuredClone,console,Date,Intl,Response,Request,URL});
 return compiled.exports;
}
function fixture(t) {
 const sqlite=new DatabaseSync(':memory:');t.after(()=>sqlite.close());
 sqlite.exec(`CREATE TABLE daily_inputs (operating_date TEXT,field_code TEXT,value TEXT,UNIQUE(operating_date,field_code));
 CREATE TABLE users (id INTEGER PRIMARY KEY,role TEXT);INSERT INTO users VALUES(1,'admin');
 INSERT INTO daily_inputs VALUES('2026-01-01','F','24'),('2026-10-19','F','12');`);
 const metrics={sourceReads:0,metadataReads:0},store=new Map();
 const execute=async statement=>{
  const {sql,args=[]}=typeof statement==='string'?{sql:statement}:statement;
  if(/^SELECT/i.test(sql)&&/FROM daily_inputs/i.test(sql))metrics.sourceReads++;
  if(/^SELECT/i.test(sql)&&/FROM operational_read_versions/i.test(sql))metrics.metadataReads++;
  const query=sqlite.prepare(sql),columns=query.columns().map(c=>c.name);
  if(columns.length) {
   const rows=query.all(...args).map(row=>Object.assign(columns.map(c=>row[c]),row));
   return {columns,rows,rowsAffected:0};
  }
  const result=query.run(...args);return {columns:[],rows:[],rowsAffected:result.changes,lastInsertRowid:result.lastInsertRowid};
 };
 const client={execute,async batch(statements){
  sqlite.exec('BEGIN IMMEDIATE');
  try{const results=[];for(const s of statements)results.push(await execute(s));sqlite.exec('COMMIT');return results;}
  catch(e){sqlite.exec('ROLLBACK');throw e;}
 }};
 const overrides={
  '@libsql/client/http':{createClient:()=>client},'drizzle-orm/libsql':{drizzle:()=>({})},'./schema':{},
  'next/cache':{unstable_cache:(read,key)=>async()=>{
   const k=JSON.stringify(key);if(store.has(k))return structuredClone(store.get(k));
   const result=await read();store.set(k,structuredClone(result));return result;
  }},
 };
 const instance=()=>loadTs('db/index.ts',overrides);
 return {sqlite,metrics,store,instance};
}
const monthSql='SELECT operating_date,field_code,value FROM daily_inputs WHERE operating_date >= ? AND operating_date < ? ORDER BY operating_date,field_code';

test('only operating SELECTs are cached; conservative fallback for complex SQL',()=>{
 assert.deepEqual(operationalReadKeys(monthSql,['2026-09-30','2026-11-01']),['daily_inputs:all','daily_inputs:2026-09','daily_inputs:2026-10']);
 assert.deepEqual(operationalReadKeys(monthSql,['2026-12-31','2027-01-02']),['daily_inputs:all','daily_inputs:2026-12','daily_inputs:2027-01']);
 assert.deepEqual(operationalReadKeys(monthSql,['2026-02-30','2026-03-01']),['daily_inputs']);
 for(const sql of ['SELECT * FROM users','SELECT * FROM position_permissions','SELECT * FROM google_mirror_credentials','SELECT * FROM daily_input_audit','SELECT * FROM px_work_items','SELECT * FROM daily_inputs JOIN users ON 1=1','SELECT random() FROM daily_inputs','SELECT * FROM daily_inputs; DELETE FROM daily_inputs'])assert.equal(operationalReadKeys(sql,[]),null);
});
test('point writes invalidate their month; ranges, date moves and unbounded writes invalidate every month',()=>{
 assert.deepEqual(operationalWriteKeys('INSERT INTO daily_inputs (operating_date, field_code, value) VALUES (?, ?, ?)',['2026-10-19','F','24']),['daily_inputs','daily_inputs:2026-10']);
 assert.deepEqual(operationalWriteKeys('DELETE FROM daily_inputs WHERE operating_date = ? AND field_code = ?',['2026-10-19','F']),['daily_inputs','daily_inputs:2026-10']);
 for(const [sql,args] of [
  ['DELETE FROM daily_inputs',[]],
  ['DELETE FROM daily_inputs WHERE operating_date >= ?',['2026-10-01']],
  ['UPDATE daily_inputs SET operating_date = ? WHERE id = ?',['2026-10-01',1]],
  ['UPDATE daily_inputs SET operating_date = ? WHERE operating_date = ?',['2026-10-01','2026-09-01']],
  ['INSERT INTO daily_inputs (operating_date, field_code, value) VALUES (?, ?, ?)',['2026-02-30','F','2026-01-01']],
  ['UPDATE daily_inputs SET value = ? WHERE operating_date = ?',['2026-01-01','2026-02-30']],
  ["UPDATE daily_inputs SET value = ? WHERE operating_date = ? OR field_code = ?",['2','2026-10-01','F']],
 ])assert.deepEqual(operationalWriteKeys(sql,args),['daily_inputs','daily_inputs:all']);
});
test('100 repeated reads and a second server instance use one operating SQL read; results are isolated',async t=>{
 const f=fixture(t),a=f.instance().getRawDb(),b=f.instance().getRawDb();
 const first=await a.prepare(monthSql).bind('2026-10-01','2026-11-01').all();first.results[0].value='mutated client copy';
 for(let i=0;i<100;i++)assert.equal((await b.prepare(monthSql).bind('2026-10-01','2026-11-01').all()).results[0].value,'12');
 assert.equal(f.metrics.sourceReads,1);assert.ok(f.metrics.metadataReads>0);
});
test('concurrent identical requests collapse to one SQL read and metadata check',async t=>{
 const f=fixture(t),a=f.instance().getRawDb();
 await Promise.all(Array.from({length:20},()=>a.prepare(monthSql).bind('2026-10-01','2026-11-01').all()));
 assert.equal(f.metrics.sourceReads,1);assert.equal(f.metrics.metadataReads,1);
});
test('writes commit revisions atomically; other instances see edits immediately and closed months remain cached',async t=>{
 const f=fixture(t),a=f.instance().getRawDb(),b=f.instance().getRawDb();
 const read=(db,month)=>db.prepare(monthSql).bind(`2026-${month}-01`,`2026-${String(Number(month)+1).padStart(2,'0')}-01`).all();
 await read(a,'01');await read(a,'10');assert.equal(f.metrics.sourceReads,2);
 await b.prepare('UPDATE daily_inputs SET value = ? WHERE operating_date = ? AND field_code = ?').bind('20','2026-10-19','F').run();
 assert.equal((await read(a,'10')).results[0].value,'20');await read(a,'01');
 assert.equal(f.metrics.sourceReads,3);
 assert.equal(f.sqlite.prepare("SELECT version FROM operational_read_versions WHERE cache_key='daily_inputs:2026-10'").get().version,1);
});
test('failed transaction rolls back both source and versions; auth reads are never cached',async t=>{
 const f=fixture(t),a=f.instance().getRawDb();await a.prepare(monthSql).bind('2026-10-01','2026-11-01').all();
 const update=a.prepare('UPDATE daily_inputs SET value=? WHERE operating_date = ?').bind('9','2026-10-19');
 const invalid=a.prepare('INSERT INTO no_such_table VALUES (?)').bind('x');
 await assert.rejects(a.batch([update,invalid]));
 assert.equal((await a.prepare(monthSql).bind('2026-10-01','2026-11-01').all()).results[0].value,'12');
 assert.equal(f.metrics.sourceReads,1);assert.equal(f.sqlite.prepare('SELECT count(*) AS n FROM operational_read_versions').get().n,0);
 assert.equal((await a.prepare('SELECT role FROM users WHERE id = ?').bind(1).first()).role,'admin');
 f.sqlite.exec("UPDATE users SET role='viewer' WHERE id=1");
 assert.equal((await a.prepare('SELECT role FROM users WHERE id = ?').bind(1).first()).role,'viewer');
});
test('snapshot conditional GET authenticates first and skips all exporters when revisions are unchanged',async()=>{
 let allowed=true,version=0,day='2026-10-20',built=0,metadata=0;
 const route=loadTs('app/api/google-mirror/snapshot/route.ts',{
  '@/lib/google-mirror-auth':{mirrorAuthorized:async()=>allowed},
  '@/lib/google-mirror-snapshot':{buildMirrorSnapshot:async()=>{built++;return {files:[]};}},
  '@/lib/google-mirror':{validMirrorPeriod:p=>/^2026-\d{2}$/.test(p)},
  '@/lib/operating-date':{vietnamDateIso:()=>day},
  '@/db':{getOperationalReadVersions:async()=>{metadata++;return {daily_inputs:version};}},
 });
 const request=etag=>new Request('https://synthetic.test/api/google-mirror/snapshot',{headers:etag?{'If-None-Match':etag}:{}});
 const first=await route.GET(request());assert.equal(first.status,200);const etag=first.headers.get('etag');
 for(let i=0;i<10;i++)assert.equal((await route.GET(request(etag))).status,304);
 assert.equal(built,1);version++;assert.equal((await route.GET(request(etag))).status,200);assert.equal(built,2);
 day='2026-10-21';assert.equal((await route.GET(request(etag))).status,200);
 allowed=false;const before=metadata;assert.equal((await route.GET(request(etag))).status,401);assert.equal(metadata,before);
});
test('an old in-flight read cannot poison the cache used after a committed edit',async()=>{
 const store=new Map();let version=0,value='old',resolveOld,signal;
 const started=new Promise(resolve=>{signal=resolve;});
 const oldGate=new Promise(resolve=>{resolveOld=resolve;});
 const cache=loadTs('lib/operational-query-cache.ts',{'next/cache':{unstable_cache:(read,key)=>async()=>{
  const k=JSON.stringify(key);if(store.has(k))return store.get(k);const result=await read();store.set(k,result);return result;
 }}});
 const versions=async()=>({'daily_inputs:2026-10':version});
 let first=true;
 const load=async()=>{const captured=value;if(first){first=false;signal();await oldGate;}return [{value:captured}];};
 const read=()=>cache.cachedOperationalRows(monthSql,['2026-10-01','2026-11-01'],'test',versions,load);
 const old=read();await started;version++;value='new';
 assert.equal((await read())[0].value,'new');resolveOld();assert.equal((await old)[0].value,'old');
 assert.equal((await read())[0].value,'new');
});
test('cache-store failures and oversized entries do not duplicate successful SQL; database errors are not cached',async()=>{
 let reads=0;
 const broken=loadTs('lib/operational-query-cache.ts',{'next/cache':{unstable_cache:()=>async()=>{throw new Error('Invariant: incrementalCache missing in unstable_cache');}}});
 assert.equal((await broken.cachedOperationalRows(monthSql,['2026-10-01','2026-11-01'],'test',async()=>({}),async()=>{reads++;return [{value:'ok'}];}))[0].value,'ok');
 assert.equal(reads,1);
 const normal=loadTs('lib/operational-query-cache.ts',{'next/cache':{unstable_cache:read=>read}});
 assert.equal((await normal.cachedOperationalRows('SELECT value FROM daily_inputs WHERE id = ?',[1n],'bigint',async()=>{throw new Error('Must bypass metadata for unsupported cache key types');},async()=>[{value:'supported SQL binding'}]))[0].value,'supported SQL binding');
 const large='x'.repeat(1_800_001);reads=0;
 assert.equal((await normal.cachedOperationalRows(monthSql,['2026-10-01','2026-11-01'],'large',async()=>({}),async()=>{reads++;return [{value:large}];}))[0].value.length,large.length);
 assert.equal(reads,1);
 await assert.rejects(normal.cachedOperationalRows(monthSql,['2026-10-01','2026-11-01'],'failed',async()=>({}),async()=>{throw new Error('Database unavailable');}),/Database unavailable/);
});
