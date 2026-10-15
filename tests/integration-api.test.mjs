import test from "node:test";
import assert from "node:assert/strict";
import {createHash} from "node:crypto";
import {integrationAuthorized,integrationPeriod} from "../lib/integration-api.ts";
test("integration auth fails closed and only accepts matching Bearer header",()=>{
  const key="x".repeat(43),hash=createHash("sha256").update(key).digest("hex");
  const request=new Request("https://example.test/?key="+key,{headers:{authorization:`Bearer ${key}`}});
  assert.equal(integrationAuthorized(request,hash),true);
  for(const config of [undefined,"bad","0".repeat(64)]) assert.equal(integrationAuthorized(request,config),false);
  assert.equal(integrationAuthorized(new Request(request.url),hash),false);
});
test("monthly range rejects unbounded requests and rolls over December",()=>{
  for(const v of [null,"2026-00","2026-13","2026-01' OR 1=1"]) assert.equal(integrationPeriod(v),null);
  assert.equal(integrationPeriod("2026-12").next,"2027-01-01");
});
