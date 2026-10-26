import test from 'node:test';
import assert from 'node:assert/strict';
import {loadReportPeriods,reportPeriodQuery,reportPage} from '../lib/report-loading.ts';

test('long ranges issue one month at a time and preserve response order',async()=>{
  let active=0,peak=0;
  const result=await loadReportPeriods(['01','02','03'],async period=>{
    active++;peak=Math.max(peak,active);await new Promise(resolve=>setImmediate(resolve));active--;return period;
  },new AbortController().signal);
  assert.equal(peak,1);assert.deepEqual(result,['01','02','03']);
});
test('superseded loads stop before another month starts or stale results can be returned',async()=>{
  const controller=new AbortController();const calls=[];
  await assert.rejects(loadReportPeriods(['01','02'],async period=>{calls.push(period);controller.abort();return period;},controller.signal),{name:'AbortError'});
  assert.deepEqual(calls,['01']);
});
test('month queries clip both endpoints and respect leap years',()=>{
  assert.equal(reportPeriodQuery('2028-02','2028-01-31','2028-03-03'),'period=2028-02&from=2028-02-01&to=2028-02-29');
  assert.equal(reportPeriodQuery('2026-10','2026-10-24','2026-10-26'),'period=2026-10&from=2026-10-24&to=2026-10-26');
});
test('table pages bound DOM size without dropping source data; last and empty pages are safe',()=>{
  const source=Array.from({length:365},(_,i)=>i);
  const first=reportPage(source,0),last=reportPage(source,99);
  assert.equal(first.items.length,30);assert.deepEqual(first.items,[...source].slice(0,30));
  assert.equal(last.items.length,5);assert.equal(last.page,12);assert.equal(last.end,365);assert.equal(last.start,361);
  assert.equal(source.length,365);assert.deepEqual(Array.from({length:first.pages},(_,p)=>reportPage(source,p).items).flat(),source);
  assert.deepEqual(reportPage([],99),{items:[],page:0,pages:1,total:0,start:0,end:0});
});
