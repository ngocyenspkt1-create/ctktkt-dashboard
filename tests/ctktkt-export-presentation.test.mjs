import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ExcelJS from 'exceljs';
import {CTKTKT_TEMPLATE_BASE64} from '../lib/ctktkt-template.generated.ts';
import {sanitizeCtktktTemplate} from '../lib/ctktkt-export-layout.ts';
import {applyCtktktOperationEventLayout} from '../lib/ctktkt-operation-events.ts';
import {applyCtktktExportPresentation} from '../lib/ctktkt-export-presentation.ts';

function canonical(value) {
 if(value instanceof Date) return value.getTime()/86400000+25569;
 if(Array.isArray(value)) return value.map(canonical);
 if(value && typeof value==='object') return Object.fromEntries(Object.entries(value).map(([k,v])=>[k,canonical(v)]));
 return value;
}
function contents(workbook) {
 const result=[];
 for(const sheet of workbook.worksheets) sheet.eachRow(row=>row.eachCell(cell=>{
  if(cell.value!==null) result.push([sheet.name,cell.address,JSON.stringify(canonical(cell.value)),cell.numFmt]);
 }));
 return result;
}

test('presentation formats all sheets and preserves every value, formula, cache, number format and merge after reopening', async()=>{
 const w=new ExcelJS.Workbook();await w.xlsx.load(Buffer.from(CTKTKT_TEMPLATE_BASE64,'base64'));
 sanitizeCtktktTemplate(w);
 for(const sheet of w.worksheets) if(/^\d{2}$/.test(sheet.name)) applyCtktktOperationEventLayout(sheet);
 const s=w.getWorksheet('03');s.getCell('C61').value=123.456;s.getCell('E83').value={formula:'E81-C81',result:4};
 const baseline=contents(w);const merges=w.worksheets.map(sheet=>[sheet.name,[...(sheet.model.merges||[])]]);
 applyCtktktExportPresentation(w);
 assert.deepEqual(contents(w),baseline);
 assert.deepEqual(w.worksheets.map(sheet=>[sheet.name,[...(sheet.model.merges||[])]]),merges);
 for(const sheet of w.worksheets) sheet.eachRow({includeEmpty:true},row=>row.eachCell({includeEmpty:true},cell=>{
  assert.equal(cell.font.name,'Times New Roman',`${sheet.name}!${cell.address}`);
  assert.equal(cell.font.scheme,undefined);
  if(cell.value===null && !(/^\d{2}$/.test(sheet.name)&&cell.row===59&&cell.col>=2&&cell.col<=10)) assert.equal(cell.fill.fgColor?.argb,'FFFFFFFF',`${sheet.name}!${cell.address}`);
 }));
 for(const sheet of w.worksheets.filter(sheet=>/^\d{2}$/.test(sheet.name))) {
  for(let row=59;row<=83;row++) for(let column=2;column<=10;column++) {
   const cell=sheet.getRow(row).getCell(column);
   assert.equal(cell.fill.fgColor.argb,row===59?'FFFFFF00':'FFFFFFFF');
   for(const side of ['top','bottom','left','right']) assert.equal(cell.border[side].style,'thin');
   assert.equal(cell.font.color.argb,'FF000000');
   assert.equal(cell.font.bold,row===59||column===2);
  }
 }
 const reopened=new ExcelJS.Workbook();await reopened.xlsx.load(await w.xlsx.writeBuffer());
 const restored=contents(reopened);
 assert.equal(restored.length,baseline.length);
 const mismatch=restored.findIndex((row,index)=>JSON.stringify(row)!==JSON.stringify(baseline[index]));
 assert.equal(mismatch,-1,mismatch<0?'':`Changed content: ${JSON.stringify(baseline[mismatch])} => ${JSON.stringify(restored[mismatch])}`);
 assert.equal(Boolean(reopened.getWorksheet('03').getCell('C61').font.bold),false);
 assert.equal(reopened.getWorksheet('03').getCell('E83').value.result,4);
});

test('rich text keeps its text and emphasis while adopting Times New Roman',()=>{
 const w=new ExcelJS.Workbook();const s=w.addWorksheet('Summary');
 s.getCell('A1').value={richText:[{text:'Tiêu đề',font:{name:'Arial',bold:true}},{text:' báo cáo',font:{name:'Calibri',italic:true}}]};
 applyCtktktExportPresentation(w);
 assert.deepEqual(s.getCell('A1').value.richText.map(run=>run.text),['Tiêu đề',' báo cáo']);
 assert.equal(s.getCell('A1').value.richText[0].font.bold,true);
 assert.equal(s.getCell('A1').value.richText[1].font.italic,true);
 assert.ok(s.getCell('A1').value.richText.every(run=>run.font.name==='Times New Roman'));
});

test('export applies presentation after writing data and before serializing workbook',()=>{
 const source=readFileSync(new URL('../app/api/ctktkt-report/export/route.ts',import.meta.url),'utf8');
 assert.match(source,/applyCtktktExportPresentation\(workbook\);\s*const output = new Uint8Array\(await workbook\.xlsx\.writeBuffer\(\)\)/);
});
