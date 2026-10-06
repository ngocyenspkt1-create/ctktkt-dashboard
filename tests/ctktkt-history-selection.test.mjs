import test from 'node:test';
import assert from 'node:assert/strict';
import {validateCtktktHistoryRanges,selectCtktktHistoryDays} from '../lib/ctktkt-history-selection.ts';

test('range validation rejects empty, duplicate, reversed, invalid dates and another month',()=>{
 for(const ranges of [[],[{group:'unknown',from:'2026-09-01',to:'2026-09-02'}],[{group:'nh3_tank',from:'2026-09-03',to:'2026-09-02'}],[{group:'nh3_tank',from:'2026-09-01',to:'2026-09-31'}],[{group:'nh3_tank',from:'2026-08-01',to:'2026-09-02'}],[{group:'nh3_tank',from:'2026-09-01',to:'2026-09-02'},{group:'nh3_tank',from:'2026-09-03',to:'2026-09-04'}]]) assert.throws(()=>validateCtktktHistoryRanges(ranges,'2026-09'));
 assert.equal(validateCtktktHistoryRanges([{group:'nh3_tank',from:'2024-02-29',to:'2024-02-29'}],'2024-02').length,1);
});

test('selection preserves zero, normalizes numbers and leaves original input untouched',()=>{
 const days=[{date:'2026-09-02',manualEntries:[{cell:'P74',value:'0'},{cell:'P69',value:'1,25'},{cell:'W8',value:'bad'}]}];
 const snapshot=JSON.stringify(days);
 const result=selectCtktktHistoryDays(days,[{group:'nh3_tank',from:'2026-09-02',to:'2026-09-02'}]);
 assert.deepEqual(result[0].manualEntries,[{cell:'P74',value:'0'},{cell:'P69',value:'1.25'}]);
 assert.equal(JSON.stringify(days),snapshot);
});
