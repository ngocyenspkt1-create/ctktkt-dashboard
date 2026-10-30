import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {createRequire} from 'node:module';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';
import ts from 'typescript';
import ExcelJS from 'exceljs';
import {CTKTKT_SAMPLE_2DAYS} from '../lib/ctktkt-sample-data.ts';
import {SHIFT_TIME_SLOTS} from '../lib/bcsx.ts';
import {mirrorWorkbookTabs} from '../lib/google-mirror-workbook.ts';
import {indexMirrorReadings} from '../lib/google-mirror-readings.ts';

const root=path.resolve(import.meta.dirname,'..'),require=createRequire(import.meta.url);
const plain=value=>JSON.parse(JSON.stringify(value));
const digest=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
function compareFiles(actual,expected) {
  assert.equal(actual.length,expected.length);
  for(let i=0;i<actual.length;i++) {
    assert.equal(actual[i].key,expected[i].key);
    const a=actual[i].tabs,b=expected[i].tabs;
    assert.equal(a.length,b.length,actual[i].key+' tab count');
    for(let j=0;j<a.length;j++) {
      if(digest(a[j])!==digest(b[j])) {
        const x=a[j],y=b[j];
        assert.equal(x.rows.length,y.rows.length,`${actual[i].key}/${x.name} row count`);
        for(let r=0;r<x.rows.length;r++)assert.equal(JSON.stringify(x.rows[r]),JSON.stringify(y.rows[r]),`${actual[i].key}/${x.name} row ${r+1}`);
        assert.deepEqual(plain({...x,rows:[]}),plain({...y,rows:[]}));
      }
    }
    assert.equal(actual[i].hash,expected[i].hash,actual[i].key+' hash');
  }
}
function load(relative, overrides, baseline=false, modules=new Map(), env={}) {
  const filename=path.resolve(root,relative);
  if(modules.has(filename))return modules.get(filename).exports;
  if(filename.endsWith('.json'))return JSON.parse(fs.readFileSync(filename,'utf8'));
  const m={exports:{}};modules.set(filename,m);
  const resolver=name=>{
    if(name in overrides)return overrides[name];
    if(!name.startsWith('.')&&!name.startsWith('@/'))return require(name);
    const base=name.startsWith('@/')?path.join(root,name.slice(2)):path.resolve(path.dirname(filename),name);
    const target=[base,base+'.ts',base+'/index.ts'].find(p=>fs.existsSync(p)&&/\.(ts|json)$/.test(p));
    if(!target)throw Error('Missing dependency: '+name);
    return load(path.relative(root,target),overrides,baseline,modules,env);
  };
  const isBaseline=baseline&&['lib/google-mirror-snapshot.ts','lib/report-exports/ctktkt.ts','lib/report-exports/water.ts'].includes(path.relative(root,filename).replaceAll('\\','/'));
  const source=isBaseline?execFileSync('git',['show',`a1cfe95:${path.relative(root,filename).replaceAll('\\','/')}`],{cwd:root,encoding:'utf8',maxBuffer:8_000_000}):fs.readFileSync(filename,'utf8');
  const code=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText;
  try { vm.runInNewContext(code,{module:m,exports:m.exports,require:resolver,process:{env},Buffer,structuredClone,console,Date,Intl,Response,Request,URL,atob,Uint8Array,ArrayBuffer}); }
  catch(error) { console.error('Module failure:',relative,error.stack);throw error; }
  return m.exports;
}
function fixture(t) {
  const db=new DatabaseSync(':memory:');t.after(()=>db.close());
  db.exec(`CREATE TABLE daily_inputs(operating_date TEXT,field_code TEXT,value TEXT);
    CREATE TABLE shift_readings(operating_date TEXT,unit TEXT,time_slot TEXT,metric TEXT,value TEXT);
    CREATE TABLE water_shift_logs(id INTEGER PRIMARY KEY,log_date TEXT,shift_time TEXT,shift_team TEXT,shift_leader TEXT,elec_rec_s1 REAL,elec_rec_s2 REAL,elec_gen_s1 REAL,elec_gen_s2 REAL,water_rec_s1 REAL,water_rec_s2 REAL,water_used_s1 REAL,water_used_s2 REAL,water_ratio_s1 REAL,water_ratio_s2 REAL,condenser_rec_s1 REAL,condenser_rec_s2 REAL,condenser_used_s1 REAL,condenser_used_s2 REAL,resin_water_s1_24h REAL,resin_water_s2_24h REAL,note TEXT,water_adj_s1 REAL,water_adj_s2 REAL,condenser_adj_s1 REAL,condenser_adj_s2 REAL);
    CREATE TABLE ppa_heat_rate_daily(operating_date TEXT,source_data TEXT,net_s1_kwh REAL,net_s2_kwh REAL,ppa_plant REAL,ppa_s1 REAL,ppa_s2 REAL,note_s1 TEXT,note_s2 TEXT);
    CREATE TABLE chemical_usage_logs(id INTEGER,usage_date TEXT,chemical_code TEXT,chemical_name TEXT,material_code TEXT,unit TEXT,quantity REAL,purpose TEXT,plant_unit TEXT,reference TEXT,deleted_at TEXT);
    CREATE TABLE operating_events(operating_date TEXT,unit TEXT,start_at TEXT,end_at TEXT,event_type TEXT,description TEXT);`);
  const put=db.prepare('INSERT INTO daily_inputs VALUES(?,?,?)');
  for(const [index,day] of Object.values(CTKTKT_SAMPLE_2DAYS).entries()) {
    const date=`2026-10-${String(index+1).padStart(2,'0')}`;
    for(const entry of day.manualEntries)put.run(date,'KTKT:'+entry.cell,entry.value);
    for(const entry of day.shiftReadings)db.prepare('INSERT INTO shift_readings VALUES(?,?,?,?,?)').run(date,entry.unit,entry.timeSlot,entry.metric,entry.value);
    put.run(date,'F','24');put.run(date,'L','12');
  }
  // A representative populated month, with the second unit stopped. No live DB.
  const reading=db.prepare('INSERT INTO shift_readings VALUES(?,?,?,?,?)');
  for(let day=3;day<=30;day++)for(const unit of ['S1','S2'])for(const time of SHIFT_TIME_SLOTS)for(const metric of ['P','Q','D','E'])
    reading.run(`2026-10-${String(day).padStart(2,'0')}`,unit,time,metric,unit==='S2'?'0':metric==='P'?'500':metric==='Q'?'40':metric==='D'?'230':'220');
  put.run('2026-01-01','F','24');put.run('2026-01-01','L','24');
  put.run('2026-09-30','KTKT:W86','123.45');
  db.exec(`INSERT INTO water_shift_logs(id,log_date,shift_time,water_rec_s1,water_rec_s2,elec_rec_s1,elec_rec_s2,elec_gen_s1,elec_gen_s2) VALUES
    (1,'2026-09-30','22h00',100,200,1000,2000,3000,4000),
    (2,'2026-10-01','06h00',110,220,1100,2200,3300,4400),
    (3,'2026-10-01','14h00',120,240,1200,2400,3600,4800),
    (4,'2026-10-01','22h00',130,260,1300,2600,3900,5200);
    INSERT INTO operating_events VALUES('2026-10-01','S1','01:00','02:00','test','Synthetic event');
    INSERT INTO chemical_usage_logs VALUES(1,'2026-10-01','test','Synthetic','M1','kg',12,'=text','S1','test',NULL);`);
  const queries=[];
  const prepare=(sql,args=[])=>({bind:(...values)=>prepare(sql,values),all:async()=>{queries.push(sql);return {results:db.prepare(sql).all(...args)};},first:async()=>{queries.push(sql);return db.prepare(sql).get(...args)||null;}});
  const store=new Map(),metrics={builds:0};
  const versions={daily_inputs:1,shift_readings:1,water_shift_logs:1,ppa_heat_rate_daily:1,chemical_usage_logs:1,operating_events:1};
  const overrides={'@/db':{getRawDb:()=>({prepare}),getOperationalReadVersions:async()=>versions},
    '@/lib/water-report/schema':{ensureWaterSchema:async()=>{}},
    'next/cache':{unstable_cache:(build,key)=>async()=>{const k=JSON.stringify(key);if(store.has(k))return store.get(k);metrics.builds++;const data=await build();store.set(k,data);return data;}}};
  return {db,queries,overrides,store,metrics,versions};
}
async function measure(fn) {
  const start=process.cpuUsage(),time=performance.now();
  let value;
  try { value=await fn(); } catch(error) { console.error(error.stack);throw error; }
  const cpu=process.cpuUsage(start);
  return {value,cpuMs:Math.round((cpu.user+cpu.system)/1000),wallMs:Math.round(performance.now()-time)};
}

test('direct workbook projection equals serialized XLSX for formulas, shared formulas, merges, dates, rich text and bounds',async()=>{
  const w=new ExcelJS.Workbook(),s=w.addWorksheet('Synthetic');
  s.getCell('A1').value={richText:[{text:'Xin '},{text:'chào'}]};s.getCell('B1').value=new Date('2026-10-01T00:00:00Z');
  s.getCell('A2').value={formula:'SUM(1,2)',result:3};s.getCell('B2').value={sharedFormula:'A2',result:3};
  s.mergeCells('C2:D3');s.getCell('C2').value='merged';s.getCell('A4').value=false;s.getCell('B4').value=0;
  s.getCell('AW210').value='edge';s.getCell('AX211').value='outside';s.getCell('A5').value={error:'#DIV/0!'};
  const restored=new ExcelJS.Workbook();await restored.xlsx.load(await w.xlsx.writeBuffer());
  assert.deepEqual(mirrorWorkbookTabs(w),mirrorWorkbookTabs(restored));
});

test('indexed readings retain first match, zero, empty, missing, 24:00 and date/unit boundaries',()=>{
  const rows=[{operating_date:'2026-12-31',unit:'S1',time_slot:'24:00',metric:'P',value:'0'},
    {operating_date:'2026-12-31',unit:'S1',time_slot:'24:00',metric:'P',value:'99'},
    {operating_date:'2027-01-01',unit:'S2',time_slot:'00:00',metric:'Q',value:''}];
  const find=indexMirrorReadings(rows);
  for(const date of ['2026-12-31','2027-01-01'])for(const unit of ['S1','S2'])for(const time of ['24:00','00:00'])for(const metric of ['P','Q','D','E'])
    assert.equal(find(date,unit,time,metric),rows.find(r=>r.operating_date===date&&r.unit===unit&&r.time_slot===time&&r.metric===metric));
});

test('all nine mirror files match pre-optimization cells/formulas/hashes; independent caches survive unrelated writes',async t=>{
  const f=fixture(t),modules=new Map(),old=load('lib/google-mirror-snapshot.ts',f.overrides,true),fresh=load('lib/google-mirror-snapshot.ts',f.overrides,false,modules);
  // Remove test-only TypeScript transpilation from both sides of the benchmark.
  // The old implementation eagerly imports these modules; the new one defers them.
  load('lib/report-exports/ctktkt.ts',f.overrides,false,modules);
  load('lib/report-exports/water.ts',f.overrides,false,modules);
  const before=await measure(()=>old.buildMirrorSnapshot('2026-10'));
  const after=await measure(()=>fresh.buildMirrorSnapshot('2026-10',f.versions));
  assert.equal(after.value.files.length,9);
  compareFiles(after.value.files,before.value.files);
  assert.equal(f.store.size,2);
  for(const packed of f.store.values())assert.ok(Buffer.byteLength(JSON.stringify(packed))<1_800_000);
  const next=await measure(()=>load('lib/google-mirror-snapshot.ts',f.overrides).buildMirrorSnapshot('2026-10',{...f.versions,chemical_usage_logs:2}));
  assert.equal(f.metrics.builds,2,'chemical update must not rebuild CTKTKT or water');
  compareFiles(next.value.files,after.value.files);
  f.db.exec("DELETE FROM daily_inputs WHERE operating_date='2026-10-01' AND field_code='KTKT:X16'; INSERT INTO daily_inputs VALUES('2026-10-01','KTKT:X16','123456');");
  f.versions.daily_inputs++;
  const edited=await fresh.buildMirrorSnapshot('2026-10',f.versions);
  assert.equal(f.metrics.builds,3,'daily input edit rebuilds CTKTKT only');
  const file=(snapshot,key)=>snapshot.files.find(f=>f.key===key);
  assert.equal(file(edited,'ctktkt').tabs.find(t=>t.name==='01').rows[15][23],123456);
  assert.notEqual(file(edited,'ctktkt').hash,file(after.value,'ctktkt').hash);
  assert.equal(file(edited,'water').hash,file(after.value,'water').hash);
  f.db.exec("UPDATE water_shift_logs SET water_rec_s1=150,resin_water_s1_24h=17 WHERE id=4");f.versions.water_shift_logs++;
  const waterEdit=await fresh.buildMirrorSnapshot('2026-10',f.versions);
  assert.equal(f.metrics.builds,5,'water edit invalidates CTKTKT links AND water report');
  assert.equal(file(waterEdit,'ctktkt').tabs.find(t=>t.name==='01').rows[71][25],17);
  assert.notEqual(file(waterEdit,'ctktkt').hash,file(edited,'ctktkt').hash);
  assert.notEqual(file(waterEdit,'water').hash,file(edited,'water').hash);
  console.log(JSON.stringify({scope:'local synthetic nine-file mirror; not Vercel billing',before:{cpuMs:before.cpuMs,wallMs:before.wallMs},after:{cpuMs:after.cpuMs,wallMs:after.wallMs},unrelatedUpdate:{cpuMs:next.cpuMs,wallMs:next.wallMs},cacheBytes:[...f.store.values()].map(x=>Buffer.byteLength(JSON.stringify(x)))}));
});

test('Excel download retains all sheets, cell values, merges, print layout and attachment headers',async t=>{
  const f=fixture(t);
  for(const name of ['ctktkt','water']) {
    const query=name==='ctktkt'?'period=2026-10':'month=2026-10';
    const request=new Request('https://synthetic.test/?'+query);
    const baseline=await load(`lib/report-exports/${name}.ts`,f.overrides,true).exportReport(request);
    const updated=await load(`lib/report-exports/${name}.ts`,f.overrides).exportReport(request);
    assert.equal(updated.status,200);assert.deepEqual([...updated.headers],[...baseline.headers]);
    const shape=async response=>{
      const w=new ExcelJS.Workbook();await w.xlsx.load(await response.arrayBuffer());
      return w.worksheets.map(s=>({name:s.name,merges:s.model.merges,pageSetup:s.pageSetup,rows:s.model.rows,columns:s.model.cols,views:s.views}));
    };
    const a=await shape(updated),b=await shape(baseline);
    assert.equal(a.length,b.length);
    for(let i=0;i<a.length;i++)assert.equal(digest(a[i]),digest(b[i]),`${name}/${a[i].name} Excel content/layout`);
  }
});

test('cache revisions cover historical carryovers, source edits, midnight, namespace and release; concurrent requests build once',async()=>{
  const store=new Map(),env={TURSO_DATABASE_URL:'synthetic-a',VERCEL_GIT_COMMIT_SHA:'release-a'};
  const overrides={'next/cache':{unstable_cache:(fn,key)=>async()=>{const k=JSON.stringify(key);if(!store.has(k))store.set(k,await fn());return store.get(k);}}};
  const c=load('lib/google-mirror-report-cache.ts',overrides,false,new Map(),env);
  const v={daily_inputs:1,shift_readings:1,water_shift_logs:1,chemical_usage_logs:1};
  const rev=(report='ctktkt',versions=v,day='2026-10-30',period='2026-10')=>c.mirrorReportRevision(report,period,day,versions);
  const original=rev();assert.equal(original,rev('ctktkt',{...v,chemical_usage_logs:2}));
  for(const source of ['daily_inputs','shift_readings','water_shift_logs'])assert.notEqual(original,rev('ctktkt',{...v,[source]:2}));
  assert.equal(rev('water'),rev('water',{...v,daily_inputs:2}));assert.notEqual(rev('water'),rev('water',{...v,water_shift_logs:2}));
  assert.notEqual(original,rev('ctktkt',v,'2026-10-31'));assert.notEqual(original,rev('ctktkt',v,'2026-10-30','2026-09'));
  env.TURSO_DATABASE_URL='synthetic-b';assert.notEqual(original,rev());env.TURSO_DATABASE_URL='synthetic-a';env.VERCEL_GIT_COMMIT_SHA='release-b';assert.notEqual(original,rev());
  let builds=0;const build=async()=>{builds++;await Promise.resolve();return [{name:'t',rows:[[0,{formula:'SUM(1,2)'},null]]}];};
  const [a,b]=await Promise.all([c.cachedMirrorReport(original,build),c.cachedMirrorReport(original,build)]);assert.equal(builds,1);
  a[0].rows[0][0]=99;assert.equal(b[0].rows[0][0],0);assert.equal((await c.cachedMirrorReport(original,build))[0].rows[0][0],0);
  env.CTKTKT_READ_CACHE='off';await c.cachedMirrorReport(original,build);assert.equal(builds,2);
});

test('cache failures keep successful output, build failures are not cached, and missing runtime falls back once',async()=>{
  let builds=0;const build=async()=>{builds++;return [{name:'t',rows:[[1]]}];};
  for(const cache of [()=>async()=>{throw Error('Invariant: incrementalCache missing');},fn=>async()=>{await fn();throw Error('store failed');}]) {
    const c=load('lib/google-mirror-report-cache.ts',{'next/cache':{unstable_cache:cache}});
    const before=builds;assert.equal((await c.cachedMirrorReport('key',build))[0].rows[0][0],1);assert.equal(builds,before+1);
  }
  const c=load('lib/google-mirror-report-cache.ts',{'next/cache':{unstable_cache:fn=>fn}});
  await assert.rejects(()=>c.cachedMirrorReport('key',async()=>{throw Error('source failed');}),/source failed/);
  assert.equal((await c.cachedMirrorReport('key',build))[0].rows[0][0],1);
});

test('snapshot authenticates before metadata/cache access and returns 304 without loading report builders',async()=>{
  let allowed=false,reads=0,builds=0;
  const versions={daily_inputs:1};
  const route=load('app/api/google-mirror/snapshot/route.ts',{
    '@/lib/google-mirror-auth':{mirrorAuthorized:async()=>allowed},
    '@/db':{getOperationalReadVersions:async()=>{reads++;return versions;}},
    '@/lib/google-mirror-snapshot':{buildMirrorSnapshot:async(period,actual)=>{builds++;assert.equal(actual,versions);return {period,files:[]};}},
  });
  const request=headers=>new Request('https://synthetic.test/?period=2026-10',{headers});
  assert.equal((await route.GET(request())).status,401);assert.equal(reads,0);assert.equal(builds,0);
  allowed=true;const response=await route.GET(request());assert.equal(response.status,200);assert.equal(builds,1);
  const etag=response.headers.get('etag');assert.ok(etag);
  assert.equal((await route.GET(request({'if-none-match':etag}))).status,304);assert.equal(builds,1);
  versions.daily_inputs=2;assert.equal((await route.GET(request({'if-none-match':etag}))).status,200);assert.equal(builds,2);
  allowed=false;assert.equal((await route.GET(request({'if-none-match':etag}))).status,401);
});
