import test from "node:test";
import assert from "node:assert/strict";
import {canReviewCoalPhotos,coalPhotoComparison} from "../lib/coal-photo-review.ts";
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
