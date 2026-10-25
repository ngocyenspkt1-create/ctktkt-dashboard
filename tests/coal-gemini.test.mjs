import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {coalPhotoExpiry} from "../lib/coal-photo-retention.ts";
import {readCoalMeterGemini,checkCoalGeminiConnection} from "../lib/coal-meter-gemini.ts";
const reading={screen_type:"led_total",meter_label:"1A1",total_display:"8939.810",total_unit:"t",photo_timestamp:null,confidence:"high",note:""};
function mock(result,status=200){return async()=>new Response(JSON.stringify(result),{status,headers:{"Content-Type":"application/json"}});}
test("retention follows shift endpoints not upload time, across months and leap day",()=>{
  assert.equal(coalPhotoExpiry("2026-10-25","08"),Date.parse("2026-10-26T16:00:00+07:00"));
  assert.equal(coalPhotoExpiry("2026-10-31","24"),Date.parse("2026-11-02T08:00:00+07:00"));
  assert.equal(coalPhotoExpiry("2028-02-29","16"),Date.parse("2028-03-02T00:00:00+07:00"));
  for(const [date,slot] of [["2026-02-29","08"],["2026-10-25","06"],["bad","08"]]) assert.throws(()=>coalPhotoExpiry(date,slot));
});
test("Gemini keeps visible digits, uses header key, returns parsed JSON",async()=>{
  let called=false;
  const result=await readCoalMeterGemini({data:"test",mediaType:"image/jpeg"},"test-key","model-test",async(url,options)=>{
    called=true;assert.ok(!url.includes("test-key"));assert.equal(options.headers["x-goog-api-key"],"test-key");
    return mock({candidates:[{finishReason:"STOP",content:{parts:[{text:JSON.stringify(reading)}]}}]})();// response only
  });
  assert.ok(called);assert.equal(result.total_display,"8939.810");
});
test("Gemini rejects hallucinated units, invalid schema, truncated output and quota failure",async()=>{
  for(const value of [{...reading,total_unit:"t/h"},{...reading,confidence:"certain"}]) {
    await assert.rejects(()=>readCoalMeterGemini({data:"x",mediaType:"image/jpeg"},"key","test",mock({candidates:[{finishReason:"STOP",content:{parts:[{text:JSON.stringify(value)}]}}]})));
  }
  await assert.rejects(()=>readCoalMeterGemini({data:"x",mediaType:"image/jpeg"},"key","test",mock({candidates:[{finishReason:"MAX_TOKENS"}]})));
  await assert.rejects(()=>readCoalMeterGemini({data:"x",mediaType:"image/jpeg"},"key","test",mock({},429)),error=>error.status===429);
});
test("network errors and timeouts become actionable errors without leaking provider details",async()=>{
  for (const [name,status,word] of [["TimeoutError",504,"45 giây"],["AbortError",504,"45 giây"],["TypeError",502,"kết nối"]]) {
    await assert.rejects(()=>readCoalMeterGemini({data:"x",mediaType:"image/jpeg"},"private-key","test",async()=>{
      throw Object.assign(new Error("provider debug private-key"),{name});
    }),error=>error.status===status&&error.message.includes(word)&&!error.message.includes("private-key"));
  }
});
test("connection check uses only model metadata, keeps the key out of URL/body and does not claim image quota",async()=>{
  const result=await checkCoalGeminiConnection("private-key","gemini-test",async(url,options)=>{
    assert.equal(url,"https://generativelanguage.googleapis.com/v1beta/models/gemini-test");
    assert.equal(options.method,"GET");assert.equal(options.headers["x-goog-api-key"],"private-key");assert.equal(options.body,undefined);
    return mock({name:"models/gemini-test",supportedGenerationMethods:["generateContent"]})();
  });
  assert.match(result.message,/Chưa kiểm tra hạn mức/);assert.ok(!JSON.stringify(result).includes("private-key"));
});
test("connection probe rejects bad credentials, unsuitable models and unavailable network without exposing secrets",async()=>{
  await assert.rejects(()=>checkCoalGeminiConnection("private-key","gemini-test",mock({error:{message:"private-key",details:[{reason:"API_KEY_INVALID"}]}},400)),error=>error.message.includes("Khóa Gemini")&&error.message.includes("HTTP 400")&&!error.message.includes("private-key"));
  await assert.rejects(()=>checkCoalGeminiConnection("private-key","gemini-test",mock({name:"models/gemini-test",supportedGenerationMethods:["embedContent"]})),error=>error.status===422);
  await assert.rejects(()=>checkCoalGeminiConnection("private-key","gemini-test",mock({})),error=>error.status===502);
  await assert.rejects(()=>checkCoalGeminiConnection("private-key","gemini-test",async()=>{throw new Error("secret private-key");}),error=>error.status===504&&!error.message.includes("private-key"));
});
test("provider key, permission, model, quota and service errors stay distinct and redact raw messages",async()=>{
  for (const [status,reason,word] of [[400,"API_KEY_INVALID","Khóa Gemini"],[403,"","quyền"],[404,"","model"],[429,"","hạn mức"],[503,"","dịch vụ"]]) {
    await assert.rejects(()=>readCoalMeterGemini({data:"x",mediaType:"image/jpeg"},"private-key","test",mock({error:{message:"secret private-key",details:[{reason}]}},status)),
      error=>error.message.includes(word)&&!error.message.includes("private-key"));
  }
  await assert.rejects(()=>readCoalMeterGemini({data:"x",mediaType:"image/jpeg"},"private-key","test",async()=>new Response("upstream html")),error=>error.status===502&&error.message.includes("không hợp lệ"));
});
test("archive access is owner-scoped and expiry-gated; cleanup never deletes operating readings",()=>{
  const route=readFileSync(new URL("../app/api/coal-meter-photos/route.ts",import.meta.url),"utf8");
  assert.ok(route.includes("owner_id=? AND expires_at>?"));
  assert.ok(route.includes("getSessionUser()"));
  const store=readFileSync(new URL("../lib/coal-photo-store.ts",import.meta.url),"utf8");
  assert.ok(store.includes("DELETE FROM coal_meter_photos WHERE expires_at <= ?"));
  assert.ok(!store.includes("DELETE FROM daily_inputs"));
  const component=readFileSync(new URL("../components/coal-meter-photo-import.tsx",import.meta.url),"utf8");
  assert.ok(!component.includes("matchCoalMeter("));
  assert.ok(component.includes("write: false"));
  const routeOcr=readFileSync(new URL("../app/api/coal-meter-ocr/route.ts",import.meta.url),"utf8");
  assert.ok(routeOcr.includes("reserveCoalPhotoRead(user.id)"));
  assert.ok(routeOcr.includes("GEMINI_API_KEY"));
  assert.ok(!routeOcr.includes("ANTHROPIC_API_KEY"));
});
