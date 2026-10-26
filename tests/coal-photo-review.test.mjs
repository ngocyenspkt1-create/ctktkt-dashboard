import test from "node:test";
import assert from "node:assert/strict";
import {canReviewCoalPhotos,coalPhotoComparison,filterCoalReviewPhotos} from "../lib/coal-photo-review.ts";

test('review filters intersect unit, shift and meter; all meters retains unreadable labels for manual checking',()=>{
  const photos=[
    {id:'a08',slot:'08',reading:{meter_label:'1A1'}},
    {id:'a16',slot:'16',reading:{meter_label:'1A1'}},
    {id:'d24',slot:'24',reading:{meter_label:'1D1'}},
    {id:'s2',slot:'08',reading:{meter_label:'2A1'}},
    {id:'unknown',slot:'08',reading:{meter_label:null}},
  ];
  const filter={date:'2026-10-25',unit:'S1',slot:'all',meter:'all'};
  const ids=values=>values.map(photo=>photo.id);
  assert.deepEqual(ids(filterCoalReviewPhotos(photos,filter)),['a08','a16','d24','unknown']);
  assert.deepEqual(ids(filterCoalReviewPhotos(photos,{...filter,slot:'08'})),['a08','unknown']);
  assert.deepEqual(ids(filterCoalReviewPhotos(photos,{...filter,meter:'S1-A1',slot:'16'})),['a16']);
  assert.deepEqual(ids(filterCoalReviewPhotos(photos,{...filter,unit:'S2',meter:'S2-A1'})),['s2']);
  assert.deepEqual(ids(filterCoalReviewPhotos(photos,{...filter,meter:'S1-F2'})),[]);
  assert.equal(photos.length,5);
});
test("TKD explicit grant can review other operators' photos, general viewers/coal-only operators cannot",()=>{
  assert.equal(canReviewCoalPhotos(null),false);
  assert.equal(canReviewCoalPhotos({role:"viewer",position:"Trưởng kíp điện",permissions:["view_all"]}),false);
  assert.equal(canReviewCoalPhotos({role:"viewer",permissions:["ctktkt_tkd_trend"]}),true);
  assert.equal(canReviewCoalPhotos({role:"viewer",permissions:["edit_ctktkt"]}),true);
  assert.equal(canReviewCoalPhotos({role:"admin",permissions:[]}),true);
  assert.equal(canReviewCoalPhotos({role:"viewer",permissions:["ctktkt_may_nghien_coal_s1"]}),false);
});
test("review compares truncated image value with correct unit/shift cell without changing readings",()=>{
  const current={X16:"8939.81",Z16:"9000",AL27:"123.45"},snapshot={...current};
  const result=coalPhotoComparison({meter_label:"1A1",total_display:"8939.810"},"08",current);
  assert.equal(result.cell,"X16");assert.equal(result.status,"match");
  assert.equal(coalPhotoComparison({meter_label:"1A1",total_display:"8939.810"},"16",current).status,"different");
  assert.equal(coalPhotoComparison({meter_label:"2F2",total_display:"123.456"},"24",current).status,"match");
  assert.deepEqual(current,snapshot);
});
test("missing labels/values and empty cells never look like a correct match",()=>{
  assert.equal(coalPhotoComparison({meter_label:null,total_display:"100"},"08",{X16:"100"}).status,"unmapped");
  assert.equal(coalPhotoComparison({meter_label:"1A1",total_display:null},"08",{X16:"0"}).status,"unreadable");
  assert.equal(coalPhotoComparison({meter_label:"1A1",total_display:"100"},"08",{}).status,"empty");
  assert.equal(coalPhotoComparison({meter_label:"1A1",total_display:"100"},"08",{X16:"100"},null).status,"unmapped");
  assert.equal(coalPhotoComparison({meter_label:null,total_display:"100"},"08",{Z16:"100"},"S1-A1").status,"empty");
});
