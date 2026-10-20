import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {mirrorAuthorized} from '../lib/google-mirror-auth.ts';
import {GOOGLE_MIRROR_FILES,validMirrorPeriod} from '../lib/google-mirror.ts';
import {GOOGLE_MIRROR_SCRIPT} from '../lib/google-mirror-script.ts';

test('mirror bearer cannot grant access with missing, short or wrong secret',async()=>{
 const old=process.env.GOOGLE_MIRROR_TOKEN;
 try{process.env.GOOGLE_MIRROR_TOKEN='x'.repeat(48);
 assert.equal(await mirrorAuthorized(new Request('https://test')),false);
 assert.equal(await mirrorAuthorized(new Request('https://test',{headers:{authorization:'Bearer '+'y'.repeat(48)}})),false);
 assert.equal(await mirrorAuthorized(new Request('https://test',{headers:{authorization:'Bearer '+'x'.repeat(48)}})),true);
 process.env.GOOGLE_MIRROR_TOKEN='short';assert.equal(await mirrorAuthorized(new Request('https://test',{headers:{authorization:'Bearer short'}})),false);
 }finally{if(old===undefined)delete process.env.GOOGLE_MIRROR_TOKEN;else process.env.GOOGLE_MIRROR_TOKEN=old;}
});
test('nine distinct targets, limited to operational modules and valid months',()=>{
 assert.equal(new Set(GOOGLE_MIRROR_FILES.map(f=>f.id)).size,9);
 assert.equal(GOOGLE_MIRROR_FILES.filter(f=>f.module==='bcsx').length,3);
 for(const p of ['2026-00','2026-13','2026-1','../2026-10'])assert.equal(validMirrorPeriod(p),false);
 assert.equal(validMirrorPeriod('2026-10'),true);
});
test('Apps Script treats user-entered formula-like text as text; failed writes never acknowledge success',()=>{
 const calls=[],properties=new Map([['token','x'.repeat(48)]]);
 const sheet={getSheetId:()=>7,getMaxRows:()=>1000,getMaxColumns:()=>26,getName:()=> 't',showSheet:()=>{}};
 let failWrite=false;
 const ctx={CONFIG:{token:'x'.repeat(48),base:'https://test',initialPeriod:'2026-10',files:[{key:'test',id:'allowed'}]},
 LockService:{getScriptLock:()=>({tryLock:()=>true,releaseLock:()=>{}})},
 PropertiesService:{getScriptProperties:()=>({getProperty:k=>properties.get(k),setProperty:(k,v)=>properties.set(k,v)})},
 SpreadsheetApp:{openById:()=>({getSheetByName:()=>sheet,getSheets:()=>[sheet],setActiveSheet:()=>{},rename:()=>{}}),flush:()=>{}},
 ScriptApp:{getOAuthToken:()=> 'opaque'},
 UrlFetchApp:{fetch:(url,opts)=>{calls.push({url,opts});if(url.endsWith('/snapshot'))return {getResponseCode:()=>200,getContentText:()=>JSON.stringify({period:'2026-10',generatedAt:'2026-10-20T00:00:00Z',files:[{key:'test',id:'allowed',hash:'abc',tabs:[{name:'t',rows:[['=HYPERLINK("bad")',{formula:'SUM(A1:A2)'},null]],clearColumns:3,clearRows:2}]}]})};return {getResponseCode:()=>failWrite&&url.includes('googleapis')?500:200};}}
 };
 vm.createContext(ctx);vm.runInContext(GOOGLE_MIRROR_SCRIPT,ctx);ctx.syncNow();
 const batch=JSON.parse(calls.find(c=>c.url.includes('googleapis')).opts.payload);
 const values=batch.requests[0].updateCells.rows[0].values;
 assert.equal(values[0].userEnteredValue.stringValue,'=HYPERLINK("bad")');assert.equal(values[1].userEnteredValue.formulaValue,'=SUM(A1:A2)');
 assert.ok(calls.some(c=>c.url.endsWith('/status')));
 calls.length=0;properties.delete('hash_test');failWrite=true;
 assert.throws(()=>ctx.syncNow(),/Google chưa xác nhận/);assert.equal(calls.some(c=>c.url.endsWith('/status')),false);assert.equal(properties.has('hash_test'),false);
});
test('existing export routes keep session guard after extraction',()=>{
 for(const p of ['ctktkt-report/export','water-report/export']){
 const code=fs.readFileSync(`app/api/${p}/route.ts`,'utf8');assert.match(code,/requireSession\(\)/);assert.ok(code.indexOf('if (!session.ok)')<code.indexOf('return exportReport(request)'));
 }
 new vm.Script(GOOGLE_MIRROR_SCRIPT);
});
