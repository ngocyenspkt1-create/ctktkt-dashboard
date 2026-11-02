import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
function load(file) {
 const m={exports:{}};
 const code=ts.transpileModule(fs.readFileSync(new URL('../lib/'+file,import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 vm.runInNewContext(code,{module:m,exports:m.exports,Date,Promise,Error});return m.exports;
}
const {storedPpaMeterSource}=load('ppa-stored-source.ts');
test('notes-only PPA source is absent, not 48 invented zero readings',()=>{
 for(const raw of [null,undefined,'','{}','null',{}])assert.equal(storedPpaMeterSource(raw),null);
 const source={grossS1:Array(48).fill(100),netS1:Array(48).fill(90),grossS2:Array(48).fill(0),netS2:Array(48).fill(0)};
 assert.deepEqual(JSON.parse(JSON.stringify(storedPpaMeterSource(JSON.stringify(source)))),source);
 for(const invalid of ['{','[]','1','{"grossS1":[]}',{...source,netS1:Array(47).fill(90)},{...source,netS1:Array(48).fill(-1)},{...source,netS1:Array(48).fill(NaN)}])assert.throws(()=>storedPpaMeterSource(invalid),/PPA_METER_SOURCE_INVALID/);
});
test('mirror revision includes all six sources and ignores unrelated revisions',()=>{
 const {mirrorSourceVersions}=load('google-mirror-revision.ts');
 const base=JSON.stringify(mirrorSourceVersions({}));
 assert.equal(JSON.stringify(mirrorSourceVersions({users:4,monthly_kpi:8,'daily_inputs:2026-11':2})),base);
 for(const key of ['daily_inputs','shift_readings','water_shift_logs','ppa_heat_rate_daily','chemical_usage_logs','operating_events'])assert.notEqual(JSON.stringify(mirrorSourceVersions({[key]:1})),base,key);
});
test('focus, visibility and timer share one request; next minute remains fresh',async()=>{
 const {createSessionRefreshGate}=load('session-refresh-gate.ts');
 let calls=0,finish,time=0;
 const gate=createSessionRefreshGate(()=>{calls++;return new Promise(resolve=>{finish=resolve;});},()=>time);
 const a=gate.request(),b=gate.request();assert.equal(a,b);assert.equal(calls,1);
 finish();await a;await gate.request();assert.equal(calls,1);
 time=60_000;const c=gate.request();assert.equal(calls,2);finish();await c;
 gate.cancel();time=120_000;await gate.request();assert.equal(calls,2);
});
test('explicit permission change during a request causes fresh follow-up, not stale grants',async()=>{
 const {createSessionRefreshGate}=load('session-refresh-gate.ts');
 let calls=0,finish;
 const gate=createSessionRefreshGate(()=>{calls++;return new Promise(resolve=>{finish=resolve;});});
 const a=gate.request();gate.request(true);gate.request(true);finish();await new Promise(setImmediate);
 assert.equal(calls,2);finish();await a;
});
test('failed refresh can retry and cleanup suppresses pending follow-up',async()=>{
 const {createSessionRefreshGate}=load('session-refresh-gate.ts');let calls=0;
 const gate=createSessionRefreshGate(async()=>{if(++calls===1)throw Error('offline');},()=>0);
 await assert.rejects(gate.request(),/offline/);await gate.request();assert.equal(calls,2);
 let finish;const canceled=createSessionRefreshGate(()=>new Promise(resolve=>{finish=resolve;}));
 const a=canceled.request();canceled.request(true);canceled.cancel();finish();await a;
});
