import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync,existsSync} from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {createRequire} from 'node:module';
import ts from 'typescript';
import {waterMeterUsage,normalizeWaterAdjustment,waterAdjustmentsFromRow} from '../lib/water-report/adjustments.ts';
import {recalculateWaterShiftChain,calculateDailyWaterUsages} from '../lib/water-report/calculations.ts';

test('explicit reset correction replaces automatic rollover; zero and null have distinct meanings',()=>{
  assert.equal(waterMeterUsage(100,24900,null,25000),200);
  assert.equal(waterMeterUsage(100,24900,25000,25000),200);
  assert.equal(waterMeterUsage(100,24900,0,25000),-24800);
  assert.equal(waterMeterUsage(0,24900,25000,25000),100);
  assert.equal(waterMeterUsage(0,24900,null,25000),0);
  assert.equal(waterMeterUsage(50,9950,10000),100);
  assert.equal(waterMeterUsage(100,0,25000),0,'no previous reading means no guessed consumption');
  for(const bad of [-1,Infinity,NaN,'bad',true,{},1000000001])assert.throws(()=>normalizeWaterAdjustment(bad));
  assert.equal(normalizeWaterAdjustment(''),null);assert.equal(normalizeWaterAdjustment(0),0);
  assert.equal(waterAdjustmentsFromRow({water_adjustment_s1:25000}).waterAdjustmentS1,25000);
});

test('a reset belongs only to its shift; daily totals include its correction once',()=>{
  const base={shiftTeam:'A',shiftLeader:'Synthetic',elecRecS1:1000,elecRecS2:1000,elecGenS1:0,elecGenS2:0,waterRecS1:24900,waterRecS2:24900,waterUsedS1:0,waterUsedS2:0,waterRatioS1:0,waterRatioS2:0,condenserRecS1:9950,condenserRecS2:9950,condenserUsedS1:0,condenserUsedS2:0,resinWaterS1_24h:0,resinWaterS2_24h:0};
  const readings=[{...base,logDate:'2026-09-30',shiftTime:'22h00'},
    {...base,logDate:'2026-10-01',shiftTime:'06h00',elecRecS1:1100,waterRecS1:100,waterAdjustmentS1:25000,condenserRecS1:50,condenserAdjustmentS1:10000},
    {...base,logDate:'2026-10-01',shiftTime:'22h00',elecRecS1:1200,waterRecS1:250,condenserRecS1:200}];
  const chain=recalculateWaterShiftChain(readings);
  assert.equal(chain[1].waterUsedS1,200);assert.equal(chain[1].waterRatioS1,2);
  assert.equal(chain[1].condenserUsedS1,100);assert.equal(chain[2].waterUsedS1,150);
  assert.equal(chain[2].condenserUsedS1,150);
  assert.equal(calculateDailyWaterUsages(readings).get('2026-10-01').totalWaterUsedS1,350);
});

const require=createRequire(import.meta.url),root=path.resolve(import.meta.dirname,'..');
function loader(overrides){
  const cache=new Map();
  function load(file){
    if(cache.has(file))return cache.get(file).exports;
    const cjsModule={exports:{}};cache.set(file,cjsModule);
    const code=ts.transpileModule(readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText;
    const localRequire=name=>{
      if(name in overrides)return overrides[name];
      if(!name.startsWith('.')&&!name.startsWith('@/'))return require(name);
      const base=name.startsWith('@/')?path.join(root,name.slice(2)):path.resolve(path.dirname(file),name);
      const target=[base,base+'.ts',path.join(base,'index.ts')].find(f=>f.endsWith('.ts')&&existsSync(f));
      if(!target)throw new Error('Missing dependency '+name);return load(target);
    };
    vm.runInThisContext('(function(exports,require,module){'+code+'\n})')(cjsModule.exports,localRequire,cjsModule);return cjsModule.exports;
  }
  return relative=>load(path.join(root,relative));
}
function fixture(permissions=['water_water_intake']){
  const sqlite=new DatabaseSync(':memory:');
  const statement=(sql,args=[])=>({sql,args,bind:(...values)=>statement(sql,values),run:async()=>({meta:sqlite.prepare(sql).run(...args)}),all:async()=>({results:sqlite.prepare(sql).all(...args)}),first:async()=>sqlite.prepare(sql).get(...args)||null});
  const db={prepare:sql=>statement(sql)};
  const user={id:1,username:'synthetic',displayName:'Synthetic',role:'viewer',permissions};
  const load=loader({'@/db':{getRawDb:()=>db},'@/lib/auth/server':{getSessionUser:async()=>user,requireSession:async()=>({ok:true,user})}});
  const route=load('app/api/water-report/route.ts');
  const request=async(shift,changedFields)=>{
    const response=await route.POST(new Request('https://synthetic.test/api/water-report',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({shift,changedFields})}));
    return {status:response.status,body:await response.json()};
  };
  return {sqlite,db,load,route,request};
}
test('migration is repeatable; corrections persist through POST, readback and partial edit',async t=>{
  const f=fixture();t.after(()=>f.sqlite.close());
  const schema=f.load('lib/water-report/schema.ts');await schema.ensureWaterSchema(f.db);await schema.ensureWaterSchema(f.db);
  f.sqlite.exec("INSERT INTO water_shift_logs(log_date,shift_time,water_rec_s1,water_rec_s2,condenser_rec_s1) VALUES('2026-09-30','22h00',24900,1000,9950)");
  const shift={logDate:'2026-10-01',shiftTime:'06h00',waterRecS1:100,waterRecS2:1100,condenserRecS1:50,waterAdjustmentS1:25000,condenserAdjustmentS1:10000};
  const saved=await f.request(shift);assert.equal(saved.status,200,JSON.stringify(saved.body));
  const get=await f.route.GET(new Request('https://synthetic.test/?month=2026-10'));const data=await get.json();
  assert.equal(data.shifts[0].waterAdjustmentS1,25000);assert.equal(data.shifts[0].waterUsedS1,200);assert.equal(data.shifts[0].condenserUsedS1,100);
  assert.equal((await f.request({...shift,waterAdjustmentS1:null,waterRecS1:150},['waterRecS1'])).status,200);
  assert.equal(f.sqlite.prepare("SELECT water_adjustment_s1 AS adjustment FROM water_shift_logs WHERE log_date='2026-10-01'").get().adjustment,25000);
  assert.equal((await f.request({...shift,waterAdjustmentS1:0},['waterAdjustmentS1'])).status,200);
  assert.equal(f.sqlite.prepare("SELECT water_adjustment_s1 AS adjustment FROM water_shift_logs WHERE log_date='2026-10-01'").get().adjustment,0);
});
test('correction cannot be written by electricity-only accounts; invalid adjustment does not create a shift',async t=>{
  const denied=fixture(['water_electricity']);t.after(()=>denied.sqlite.close());
  const shift={logDate:'2026-10-01',shiftTime:'06h00',waterAdjustmentS1:25000};
  assert.equal((await denied.request(shift)).status,403);
  assert.equal(denied.sqlite.prepare('SELECT COUNT(*) AS count FROM water_shift_logs').get().count,0);
  const f=fixture();t.after(()=>f.sqlite.close());
  assert.equal((await f.request({...shift,waterAdjustmentS1:-1})).status,400);
  assert.equal(f.sqlite.prepare('SELECT COUNT(*) AS count FROM water_shift_logs').get().count,0);
});
test('exported workbook carries correction columns and formulas that keep the correction after Excel recalculates',async t=>{
  const f=fixture();t.after(()=>f.sqlite.close());
  await f.load('lib/water-report/schema.ts').ensureWaterSchema(f.db);
  f.sqlite.exec("INSERT INTO water_shift_logs(log_date,shift_time,water_rec_s1,water_rec_s2,condenser_rec_s1) VALUES('2026-09-30','22h00',24900,1000,9950)");
  await f.request({logDate:'2026-10-01',shiftTime:'06h00',waterRecS1:100,waterRecS2:1100,condenserRecS1:50,waterAdjustmentS1:25000,condenserAdjustmentS1:10000});
  const exported=await f.load('lib/report-exports/water.ts').exportReport(new Request('https://synthetic.test/?month=2026-10'));
  assert.equal(exported.status,200);
  const ExcelJS=require('exceljs'),book=new ExcelJS.Workbook();await book.xlsx.load(Buffer.from(await exported.arrayBuffer()));
  const correction=book.getWorksheet('Hieu chinh cong to');assert.ok(correction);
  assert.equal(correction.getCell('C2').value,25000,JSON.stringify(correction.getSheetValues()));assert.equal(correction.getCell('E2').value,10000);
  const main=book.worksheets[0];
  const formulas=[];main.eachRow(row=>row.eachCell(cell=>{if(cell.value?.formula)formulas.push(cell.value);}));
  assert.ok(formulas.some(cell=>cell.formula.includes('+25000')&&cell.result===200));
  assert.ok(formulas.some(cell=>cell.formula.includes('+10000')&&cell.result===100));
});
