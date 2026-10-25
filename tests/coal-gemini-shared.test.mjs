import test from "node:test";
import assert from "node:assert/strict";
import {DatabaseSync} from "node:sqlite";
import {readFileSync} from "node:fs";
import {sealCoalGeminiKey,openCoalGeminiKey} from "../lib/coal-gemini-secret.ts";
import {sharedGeminiStatus,saveSharedGemini,loadSharedGemini,SharedGeminiConflict} from "../lib/coal-gemini-shared-store.ts";
const secret="test-root-secret-"+"a".repeat(32),key="dummy-gemini-key-"+"b".repeat(32);
function memoryDb(){
  const sqlite=new DatabaseSync(":memory:");
  const statement=(sql,args=[])=>({sql,args,bind:(...values)=>statement(sql,values),first:async()=>sqlite.prepare(sql).get(...args)||null,all:async()=>({results:sqlite.prepare(sql).all(...args)}),run:async()=>{const r=sqlite.prepare(sql).run(...args);return {meta:{changes:Number(r.changes)}};}});
  return {sqlite,db:{prepare:sql=>statement(sql),batch:async statements=>{
    sqlite.exec("BEGIN IMMEDIATE");
    try{const results=statements.map(({sql,args=[]})=>({meta:{changes:Number(sqlite.prepare(sql).run(...args).changes)}}));sqlite.exec("COMMIT");return results;}catch(error){sqlite.exec("ROLLBACK");throw error;}
  }}};
}
test("shared key uses random authenticated encryption and fails closed on corruption/root rotation",()=>{
  const a=sealCoalGeminiKey(key,secret),b=sealCoalGeminiKey(key,secret);
  assert.notEqual(a,b);assert.ok(!a.includes(key));assert.equal(openCoalGeminiKey(a,secret),key);
  assert.throws(()=>openCoalGeminiKey(a,secret+"rotated"));
  const parts=a.split(".");parts[3]=(parts[3][0]==="A"?"B":"A")+parts[3].slice(1);
  assert.throws(()=>openCoalGeminiKey(parts.join("."),secret));
  assert.throws(()=>sealCoalGeminiKey(key,undefined));
});
test("one operator saves, another reads same shared key without plaintext in metadata/audit",async()=>{
  const {sqlite,db}=memoryDb();
  try{
    assert.equal((await sharedGeminiStatus(db)).configured,false);
    await saveSharedGemini(db,secret,{key,model:"gemini-test",expectedVersion:0,actorId:1,actorName:"VHV A"});
    assert.deepEqual(await loadSharedGemini(db,secret),{key,model:"gemini-test"});
    const status=await sharedGeminiStatus(db);assert.equal(status.version,1);assert.equal(status.updatedBy,"VHV A");
    assert.ok(!JSON.stringify(status).includes(key));assert.ok(!Object.hasOwn(status,"cipher"));
    await assert.rejects(()=>saveSharedGemini(db,secret,{key:key+"x",model:"gemini-test",expectedVersion:0,actorId:2,actorName:"VHV B"}),SharedGeminiConflict);
    assert.equal(sqlite.prepare("SELECT COUNT(*) AS n FROM coal_gemini_settings_events").get().n,1);
    await saveSharedGemini(db,secret,{key:key+"new",model:"gemini-new",expectedVersion:1,actorId:2,actorName:"VHV B"});
    assert.equal((await loadSharedGemini(db,secret)).key,key+"new");
    const rows=sqlite.prepare("SELECT * FROM coal_gemini_settings_events").all();assert.equal(rows.length,2);assert.ok(!JSON.stringify(rows).includes(key));
    assert.ok(!sqlite.prepare("SELECT cipher FROM coal_gemini_settings").get().cipher.includes(key));
  }finally{sqlite.close();}
});
test("settings route checks coal edit permission, origin, version; never sends saved key",()=>{
  const route=readFileSync(new URL("../app/api/coal-gemini-settings/route.ts",import.meta.url),"utf8");
  assert.ok(route.includes("getSessionUser()"));assert.ok(route.includes('canEditCtktktGroup(user,"may_nghien_coal_s1")'));assert.ok(route.includes('canEditCtktktGroup(user,"may_nghien_coal_s2")'));
  assert.ok(route.includes('request.headers.get("origin")!==new URL(request.url).origin'));assert.ok(route.includes("body.expectedVersion"));assert.ok(!route.includes("loadSharedGemini"));
  const ocr=readFileSync(new URL("../app/api/coal-meter-ocr/route.ts",import.meta.url),"utf8");assert.ok(ocr.includes("loadSharedGemini(getRawDb(),process.env.AUTH_SECRET)"));
});
