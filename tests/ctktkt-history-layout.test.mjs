import test from 'node:test';
import assert from 'node:assert/strict';
import {ctktktHistoryHfoCellMap} from '../lib/ctktkt-history-layout.ts';

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
