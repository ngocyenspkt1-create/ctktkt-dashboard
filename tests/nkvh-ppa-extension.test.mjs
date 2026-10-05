import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const root = new URL("../browser-extension/nkvh-ppa/", import.meta.url);
const source = name => readFileSync(new URL(name, root), "utf8");

test("NKVH calendar filter excludes out-of-day and invalid events", () => {
  const context = vm.createContext({}); vm.runInContext(source("filter.js"), context);
  const { inDay } = context.NkvhFilter, day = "2026-10-04";
  assert.equal(inDay({ start:"04/10/2026 00:00", end:"" }, day), true);
  assert.equal(inDay({ start:"05/10/2026 00:00", end:"" }, day), false);
  assert.equal(inDay({ start:"03/10/2026 22:00", end:"04/10/2026 00:00" }, day), false);
  assert.equal(inDay({ start:"03/10/2026 23:00", end:"04/10/2026 01:00" }, day), true);
  assert.equal(inDay({ start:"04/10/2026 23:00", end:"05/10/2026 01:00" }, day), true);
  assert.equal(inDay({ start:"", end:"04/10/2026 06:00" }, day), false);
  assert.equal(inDay({ start:"04/10/2026 14:00", end:"04/10/2026 06:00" }, day), false);
});

function background() {
  let handler; const data = {}, sent = [];
  const chrome = {
    action:{onClicked:{addListener(){}}},
    runtime:{id:"test",getURL:name=>"chrome-extension://test/"+name,onMessage:{addListener(fn){handler=fn;}}},
    tabs:{create:async()=>({id:9}),update:async()=>{},get:async()=>({url:"https://ctktkt-dashboard.vercel.app/ppa-heat-rate"}),
      sendMessage:async(id,message)=>{sent.push({id,message});return {ok:true};},onRemoved:{addListener(){}}},
    storage:{session:{set:async value=>Object.assign(data,value),get:async key=>({[key]:data[key]}),remove:async key=>{delete data[key];}}}
  };
  vm.runInNewContext(source("background.js"),{chrome,URL});
  const call=(message,sender)=>new Promise(resolve=>handler(message,sender,resolve));
  return {call,sent,data};
}
const web={tab:{id:4},url:"https://ctktkt-dashboard.vercel.app/ppa-heat-rate"};
const picker={id:"test",url:"chrome-extension://test/app.html"};
const open={type:"OPEN_NKVH",requestId:"test-123",operatingDate:"2026-10-04"};

test("background rejects unauthorized origins and retains only request metadata",async()=>{
  const bg=background();
  assert.equal((await bg.call(open,{...web,url:"https://example.com/ppa-heat-rate"})).ok,false);
  assert.equal((await bg.call(open,web)).ok,true);
  assert.deepEqual(Object.keys(bg.data["picker:9"]).sort(),["date","requestId","webTab"]);
  assert.equal((await bg.call({type:"NKVH_CONTEXT",pickerTabId:9},picker)).context.date,"2026-10-04");
});
test("apply validates date, length, nonempty result and exact picker source",async()=>{
  const bg=background();await bg.call(open,web);
  const apply={type:"NKVH_APPLY",pickerTabId:9,operatingDate:"2026-10-04",eventS1:"Sự kiện thử",eventS2:""};
  assert.equal((await bg.call({...apply,operatingDate:"2026-10-05"},picker)).ok,false);
  assert.equal((await bg.call({...apply,eventS1:"x".repeat(1001)},picker)).ok,false);
  assert.equal((await bg.call({...apply,eventS1:""},picker)).ok,false);
  assert.equal((await bg.call(apply,web)).ok,false);
  assert.equal(bg.sent.length,0);
  assert.equal((await bg.call(apply,picker)).ok,true);
  assert.equal(bg.sent[0].id,4);
  assert.equal(bg.sent[0].message.requestId,"test-123");
  assert.equal(bg.sent[0].message.eventS1,"Sự kiện thử");
  assert.equal((await bg.call(apply,picker)).ok,false);
});

test("web bridge rejects foreign and stale messages",async()=>{
  let receive, fromRuntime; const posted=[]; let calls=0;
  const location={pathname:"/ppa-heat-rate",origin:"https://ctktkt-dashboard.vercel.app"};
  const window={addEventListener(type,fn){receive=fn;},postMessage(message){posted.push(message);}};
  const chrome={runtime:{id:"test",sendMessage:async()=>{calls++;return {ok:true};},onMessage:{addListener(fn){fromRuntime=fn;}}}};
  vm.runInNewContext(source("web-bridge.js"),{window,location,chrome});
  const data={channel:"ctktkt-nkvh-ppa",sender:"ctktkt-web",type:"OPEN",requestId:"test-123",operatingDate:"2026-10-04"};
  await receive({source:window,origin:"https://example.com",data});assert.equal(calls,0);
  await receive({source:window,origin:location.origin,data});assert.equal(calls,1);
  fromRuntime({type:"NKVH_APPLIED",requestId:"wrong",operatingDate:"2026-10-04"},{id:"test"},()=>{});
  assert.equal(posted.length,1);
  fromRuntime({type:"NKVH_APPLIED",requestId:"test-123",operatingDate:"2026-10-04",eventS1:"A",eventS2:"B"},{id:"test"},()=>{});
  assert.equal(posted[1].type,"APPLY");assert.equal(posted[1].eventS2,"B");
});

test("published extension files match source",()=>{
  for(const name of ["manifest.json","background.js","filter.js","page.js","app.html","app.css","app.js","web-bridge.js","README.md"]) {
    assert.equal(readFileSync(new URL("../public/nkvh-ppa-extension/"+name,import.meta.url),"utf8"),source(name),name);
  }
});
