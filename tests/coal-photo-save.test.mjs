import test from 'node:test';
import assert from 'node:assert/strict';
import {saveReviewedCoalEntries} from '../lib/coal-photo-save.ts';
test('save targets the chosen date, sends only coal cells and reads back before success',async()=>{
  const calls=[];
  const result=await saveReviewedCoalEntries(async(url,options)=>{
    calls.push({url,options});
    if(options?.method==='POST')return Response.json({saved:1});
    return Response.json({entries:[{operatingDate:'2026-10-24',cell:'X16',value:'123.45'},{operatingDate:'2026-10-25',cell:'X16',value:'999'},{operatingDate:'2026-10-24',cell:'D1',value:'42'}]});
  },'2026-10-24',[{cell:'X16',value:'123.45'}]);
  assert.deepEqual(JSON.parse(calls[0].options.body),{operatingDate:'2026-10-24',entries:[{cell:'X16',value:'123.45'}]});
  assert.equal(calls[1].options.cache,'no-store');assert.deepEqual(result,[{cell:'X16',value:'123.45'}]);
});
test('reject invalid date, duplicate or non-coal cells before sending',async()=>{
  for(const [date,entries] of [['2026-02-30',[{cell:'X16',value:'1'}]],['2026-10-24',[{cell:'D1',value:'1'}]],['2026-10-24',[{cell:'X16',value:'-1'}]],['2026-10-24',[{cell:'X16',value:'1'},{cell:'X16',value:'2'}]]]){
    await assert.rejects(()=>saveReviewedCoalEntries(async()=>{assert.fail('must not send');},date,entries));
  }
});
test('failed save and mismatched readback never report success',async()=>{
  await assert.rejects(()=>saveReviewedCoalEntries(async()=>Response.json({error:'No permission'},{status:403}),'2026-10-24',[{cell:'X16',value:'1'}]),/No permission/);
  await assert.rejects(()=>saveReviewedCoalEntries(async(url,options)=>options?.method==='POST'?Response.json({saved:1}):Response.json({entries:[{operatingDate:'2026-10-25',cell:'X16',value:'1'}]}),'2026-10-24',[{cell:'X16',value:'1'}]),/chưa khớp/);
});
