import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {GOOGLE_MIRROR_ACCESS_SCRIPT} from '../lib/google-mirror-access-script.ts';
import {GOOGLE_MIRROR_FILES,mirrorUrl} from '../lib/google-mirror.ts';

function harness({parentEditor=false,failWrite=false,readerRestricted=false}={}) {
 const calls=[],files=new Map(GOOGLE_MIRROR_FILES.map(f=>[f.id,{metadata:{id:f.id,mimeType:'application/vnd.google-apps.spreadsheet',parents:['parent'],owners:[{emailAddress:'owner@example.test'}],writersCanShare:true,copyRequiresWriterPermission:true},permissions:[{id:'owner',type:'user',role:'owner'},{id:'editor',type:'user',role:'writer'}]}]));
 let unlocked=false;
 const ctx={CONFIG:{files:GOOGLE_MIRROR_FILES},Session:{getEffectiveUser:()=>({getEmail:()=> 'owner@example.test'})},LockService:{getScriptLock:()=>({tryLock:()=>true,releaseLock:()=>{unlocked=true;}})},ScriptApp:{getOAuthToken:()=> 'synthetic'},console:{log:()=>{}},
 UrlFetchApp:{fetch:(raw,options)=>{
 const url=new URL(raw),segments=url.pathname.split('/'),id=segments[4],permissionId=segments[6],method=options.method;
 calls.push({url:raw,method,payload:options.payload?JSON.parse(options.payload):null});
 const response=(body,code=200)=>({getResponseCode:()=>code,getContentText:()=>JSON.stringify(body)});
 if(id==='parent')return response({permissions:parentEditor?[{id:'inherited',type:'group',role:'writer'}]:[{id:'owner',type:'user',role:'owner'}]});
 const f=files.get(id);assert.ok(f,'must only access existing target files');
 if(failWrite&&method!=='get')return response({},403);
 const payload=options.payload?JSON.parse(options.payload):{};
 if(segments[5]==='permissions'){
 if(method==='patch')Object.assign(f.permissions.find(p=>p.id===permissionId),payload);
 if(method==='post')f.permissions.push({id:'public',...payload});
 return response(method==='get'?{permissions:f.permissions}:{});
 }
 if(method==='patch'){f.metadata.writersCanShare=payload.writersCanShare;f.metadata.copyRequiresWriterPermission=readerRestricted;assert.deepEqual(payload.downloadRestrictions,{itemDownloadRestriction:{restrictedForReaders:false,restrictedForWriters:false}});}
 return response(f.metadata);
 }} };
 vm.createContext(ctx);vm.runInContext(GOOGLE_MIRROR_ACCESS_SCRIPT,ctx);
 return {ctx,calls,files,unlocked:()=>unlocked};
}
test('nine existing Sheets become link-viewable and downloadable; owner retained and no data write or file creation',()=>{
 const h=harness();assert.equal(h.ctx.configureViewerAccess().verified,9);
 for(const f of h.files.values()){
 assert.equal(f.permissions.find(p=>p.id==='owner').role,'owner');assert.equal(f.permissions.find(p=>p.id==='editor').role,'reader');
 assert.ok(f.permissions.some(p=>p.type==='anyone'&&p.role==='reader'&&p.allowFileDiscovery===false));assert.equal(f.metadata.copyRequiresWriterPermission,false);
 }
 assert.equal(h.calls.some(c=>c.url.includes('sheets.googleapis.com')||c.url.includes('/snapshot')),false);
 const publicGrants=h.calls.filter(c=>c.method==='post').length;h.ctx.configureViewerAccess();assert.equal(h.calls.filter(c=>c.method==='post').length,publicGrants);
 assert.equal(h.unlocked(),true);assert.match(mirrorUrl(GOOGLE_MIRROR_FILES[0].id),/\/view$/);
});
test('inherited editor permissions are reported without changing folders or file permissions',()=>{
 const h=harness({parentEditor:true});assert.throws(()=>h.ctx.configureViewerAccess(),/Thư mục cha/);assert.ok(h.calls.every(c=>c.method==='get'));assert.equal(h.unlocked(),true);
});
test('a denied mutation or remaining download restriction never claims success',()=>{
 for(const config of [{failWrite:true},{readerRestricted:true}]){const h=harness(config);assert.throws(()=>h.ctx.configureViewerAccess(),/chưa hoàn tất/);assert.equal(h.unlocked(),true);}
});
