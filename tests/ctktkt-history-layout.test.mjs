import test from 'node:test';
import assert from 'node:assert/strict';
import {ctktktHistoryHfoCellMap,ctktktHistoryCoalQualityCellMap} from '../lib/ctktkt-history-layout.ts';

test('canonical HFO layout stays aligned, incomplete label blocks do not read unrelated rows',()=>{
 const map=ctktktHistoryHfoCellMap({L52:{v:'Mực bồn dầu HFO 1'},L60:{v:'Bồn dầu HFO 1'}});
 assert.equal(map.get('M52'),'M52');
 assert.equal(map.get('N60'),'N60');
 assert.equal(map.get('M53'),null);
 assert.equal(ctktktHistoryHfoCellMap({M60:{v:12}}).size,0);
});
test('ambiguous duplicate tank labels are rejected instead of choosing a wrong row',()=>{
 assert.throws(()=>ctktktHistoryHfoCellMap({L60:{v:'Bồn dầu HFO 1'},L61:{v:'Bồn dầu HFO 1'}}),/nhiều dòng cùng nhãn/);
});

test('legacy shared quality table maps each shift to both units and leaves modern layouts alone',()=>{
 const sheet={AJ82:{v:'Ẩm toàn phần, Wtp (%)'},AL82:{v:'Nhiệt trị khô (Qk)'},AF83:{v:'0h-08h'},AF84:{v:'08h-16h'},AF85:{v:'16h-24h'},AJ87:{v:'Than tiêu thụ S1'}};
 const map=ctktktHistoryCoalQualityCellMap(sheet);
 assert.equal(map.size,12);
 for(let index=0;index<3;index++) for(const start of [87,90]) {
  assert.equal(map.get(`AJ${start+index}`),`AJ${83+index}`);
  assert.equal(map.get(`AK${start+index}`),`AL${83+index}`);
 }
 assert.equal(ctktktHistoryCoalQualityCellMap({AJ86:{v:'Wtp'},AK86:{v:'Qk'},AJ87:{v:8.3},AK87:{v:5225}}).size,0);
 assert.equal(ctktktHistoryCoalQualityCellMap({...sheet,AF84:{v:'S1'}}).size,0);
});
