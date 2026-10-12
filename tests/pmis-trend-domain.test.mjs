import assert from "node:assert/strict";
import {test} from "node:test";
import {pmisTrendDomain} from "../lib/pmis-trend-domain.ts";
test("NH3 fractional ranges stay readable instead of rounding to a multi-unit axis",()=>{
  const [min,max]=pmisTrendDomain([.125,.17,.14]);
  assert.ok(min<.125 && max>.17 && max-min<.1);
});
test("domains enclose both units, negative vacuum and real zeros; nulls never become zeros",()=>{
  const [min,max]=pmisTrendDomain([-94,-92,null,NaN]);
  assert.ok(min<-94 && max>-92 && max<0);
  const [low,high]=pmisTrendDomain([0,620]);
  assert.ok(low<0 && high>620);
  assert.deepEqual(pmisTrendDomain([null]),[0,1]);
  const [constantMin,constantMax]=pmisTrendDomain([0,0]);
  assert.ok(constantMin<0 && constantMax>0);
});
