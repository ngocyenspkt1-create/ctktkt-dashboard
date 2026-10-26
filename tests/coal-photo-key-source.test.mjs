import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import * as React from 'react';
import {createRequire} from 'node:module';
import * as config from '../lib/coal-gemini-config.ts';
import * as meter from '../lib/coal-meter-ocr.ts';
const require=createRequire(import.meta.url);
function harness(options={}){
  const states=[],refs=[],calls=[];let cursor=0,refCursor=0;
  let reportDate=options.date||'2026-10-24';
  const hooks={...React,useState:initial=>{
    const i=cursor++;if(!(i in states))states[i]=i===0&&options.rows?structuredClone(options.rows):typeof initial==='function'?initial():initial;
    return [states[i],value=>{states[i]=typeof value==='function'?value(states[i]):value;}];
  },useRef:initial=>{const i=refCursor++;return refs[i]??(refs[i]={current:initial});},useEffect:()=>{},useMemo:fn=>fn()};
  const SharedSettings=function SharedSettings(){};
  const dependencies=name=>name==='react'?hooks:name==='@/lib/coal-gemini-config'?config:name==='@/lib/coal-meter-ocr'?meter:
    name==='@/components/coal-gemini-shared-settings'?{CoalGeminiSharedSettings:SharedSettings}:
    name==='@/components/ui/coal-dialog'?{Dialog:'Dialog',DialogContent:'DialogContent',DialogDescription:'p',DialogTitle:'h2'}:
    name.endsWith('.module.css')?{__esModule:true,default:{}}:name==='lucide-react'?new Proxy({},{get:()=>function Icon(){}}):require(name);
  const code=ts.transpileModule(fs.readFileSync(new URL('../components/coal-meter-photo-import.tsx',import.meta.url),'utf8'),{
    compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2020,esModuleInterop:true}
  }).outputText;
  const cjsModule={exports:{}};
  const request=async(url,options)=>{calls.push({url,headers:new Headers(options.headers)});return Response.json({message:'Synthetic probe result'});};
  vm.runInNewContext(code,{module:cjsModule,exports:cjsModule.exports,require:dependencies,fetch:request,AbortController,AbortSignal,Number,Intl,Map,Set,Error},{filename:'coal-photo-import.cjs'});
  return {calls,SharedSettings,render(){cursor=0;refCursor=0;return cjsModule.exports.CoalMeterPhotoImport({open:true,onOpenChange:()=>{},reportDate,current:{},initialUnit:options.unit||'S1',canEditCell:options.canEditCell||(()=>true),onApply:()=>{},request,onSave:options.onSave,onDateChange:date=>{reportDate=date;}});}};
}
function nodes(root){const all=[];function visit(n){if(Array.isArray(n))return n.forEach(visit);if(!n||typeof n!=='object')return;all.push(n);visit(n.props?.children);}visit(root);return all;}
function text(n){if(Array.isArray(n))return n.map(text).join('');if(typeof n==='string'||typeof n==='number')return String(n);return text(n?.props?.children??'');}
const button=(tree,name)=>nodes(tree).find(n=>n.type==='button'&&text(n).trim()===name);
const password=tree=>nodes(tree).find(n=>n.type==='input'&&n.props.type==='password');
const flush=async()=>{for(let i=0;i<4;i++)await new Promise(resolve=>setImmediate(resolve));};

test('shared is default and no temporary password field exists until explicitly enabled',async()=>{
  const h=harness();let tree=h.render();
  assert.equal(password(tree),undefined);
  assert.ok(text(tree).includes('Đang dùng khóa chung / cấu hình máy chủ'));
  button(tree,'Kiểm tra Gemini').props.onClick();await flush();
  assert.equal(h.calls.length,1);assert.equal(h.calls[0].headers.has('x-coal-gemini-key'),false);
  tree=h.render();button(tree,'Chọn dùng khóa tạm').props.onClick();tree=h.render();
  assert.ok(password(tree));button(tree,'Kiểm tra Gemini').props.onClick();await flush();
  assert.equal(h.calls.length,1,'empty temporary mode must not silently fall back or send a probe');
  assert.ok(text(h.render()).includes('Nhập khóa tạm hoặc bấm Dùng khóa chung'));
});

test('temporary probe uses explicit key; switching, saving shared and closing discard the override',async()=>{
  const h=harness();let tree=h.render();
  button(tree,'Chọn dùng khóa tạm').props.onClick();tree=h.render();
  password(tree).props.onChange({target:{value:'synthetic-key-for-test-only'}});tree=h.render();
  button(tree,'Kiểm tra Gemini').props.onClick();await flush();
  assert.equal(h.calls.at(-1).headers.get('x-coal-gemini-key'),'synthetic-key-for-test-only');
  tree=h.render();button(tree,'Dùng khóa chung').props.onClick();tree=h.render();
  assert.equal(password(tree),undefined);
  button(tree,'Kiểm tra Gemini').props.onClick();await flush();
  assert.equal(h.calls.at(-1).headers.has('x-coal-gemini-key'),false);
  for(const reset of ['save','close']){
    tree=h.render();button(tree,'Chọn dùng khóa tạm').props.onClick();tree=h.render();
    password(tree).props.onChange({target:{value:'synthetic-old-key-discarded'}});tree=h.render();
    if(reset==='save')nodes(tree).find(n=>n.type===h.SharedSettings).props.onSaved();
    else tree.props.onOpenChange(false);
    tree=h.render();assert.equal(password(tree),undefined);
    button(tree,'Kiểm tra Gemini').props.onClick();await flush();
    assert.equal(h.calls.at(-1).headers.has('x-coal-gemini-key'),false,reset);
  }
});

const photo=()=>({id:'test-photo',fileName:'synthetic.jpg',url:'blob:synthetic',state:'done',ocrValue:123.456,value:'123.45',label:'S1-A1',key:'S1-A1',slot:'08',photoDate:'2026-10-24',readDate:'2026-10-24',aiReasons:[],error:'',write:true});

test('import review table sorts by meter and shift instead of upload order, retaining row identity',()=>{
  const rows=[['f2','S1-F2','08'],['a2','S1-A2','08'],['late','S1-A1','24'],['early','S1-A1','08']]
    .map(([id,key,slot])=>({...photo(),id,key,label:key,slot}));
  const h=harness({rows});let tree=h.render();
  const table=nodes(tree).find(n=>n.type==='table');
  const body=nodes(table).find(n=>n.type==='tbody');
  assert.deepEqual(nodes(body).filter(n=>n.type==='tr').map(n=>n.key),['early','late','a2','f2']);
  const originalFourth=nodes(body).find(n=>n.props?.['aria-label']==='Xác nhận ảnh 4');
  originalFourth.props.onChange({target:{checked:false}});tree=h.render();
  assert.equal(nodes(tree).find(n=>n.props?.['aria-label']==='Xác nhận ảnh 4').props.checked,false);
  assert.equal(nodes(tree).find(n=>n.props?.['aria-label']==='Xác nhận ảnh 1').props.checked,true);
});
test('date defaults to the report date; changing date clears confirmation and blocks stale OCR save',()=>{
  const h=harness({rows:[photo()],onSave:async()=>assert.fail('not confirmed')});let tree=h.render();
  const date=nodes(tree).find(n=>n.type==='input'&&n.props.type==='date');
  assert.equal(date.props.value,'2026-10-24');assert.equal(button(tree,'Lưu 1 chỉ số').props.disabled,false);
  date.props.onChange({target:{value:'2026-10-25'}});tree=h.render();
  assert.equal(nodes(tree).find(n=>n.type==='input'&&n.props.type==='date').props.value,'2026-10-25');
  assert.equal(button(tree,'Lưu 0 chỉ số').props.disabled,true);
  assert.ok(text(tree).includes('Ngày ghi đã thay đổi'));
});
test('unclear AI values need manual re-entry and confirmation before save; success is shown only after callback',async()=>{
  const saved=[];const h=harness({rows:[{...photo(),needsManual:true,manual:false}],onSave:async values=>saved.push(values)});let tree=h.render();
  assert.equal(button(tree,'Lưu 0 chỉ số').props.disabled,true);assert.ok(text(tree).includes('Ảnh chưa đọc rõ'));
  button(tree,'Nhập tay từ ảnh').props.onClick();tree=h.render();
  const value=nodes(tree).find(n=>n.type==='input'&&n.props.placeholder==='Chưa có kết quả');assert.equal(value.props.value,'');
  value.props.onChange({target:{value:'124.56'}});tree=h.render();
  nodes(tree).find(n=>n.type==='input'&&n.props['aria-label']==='Xác nhận ảnh 1').props.onChange({target:{checked:true}});tree=h.render();
  button(tree,'Lưu 1 chỉ số').props.onClick();await flush();tree=h.render();
  assert.deepEqual(JSON.parse(JSON.stringify(saved)),[[{cell:'X16',value:'124.56'}]]);
  assert.ok(text(tree).includes('Đã lưu và kiểm tra lại 1 chỉ số ngày 24/10/2026'));
});
test('failed save retains the picture, values and confirmation for a deliberate retry',async()=>{
  const h=harness({rows:[photo()],onSave:async()=>{throw new Error('Synthetic save failure');}});let tree=h.render();
  button(tree,'Lưu 1 chỉ số').props.onClick();await flush();tree=h.render();
  assert.ok(text(tree).includes('Synthetic save failure'));assert.ok(text(tree).includes('synthetic.jpg'));
  assert.equal(button(tree,'Lưu 1 chỉ số').props.disabled,false);
  assert.ok(!text(tree).includes('Đã lưu và kiểm tra lại'));
});

test('1D1 belongs to S1 and 2D1 belongs to S2; changing destination does not erase observed unit',()=>{
  assert.equal(meter.parseMeterLabel('Máy cấp 1D1'),'S1-D1');
  assert.equal(meter.parseMeterLabel('Máy cấp 2D1'),'S2-D1');
  assert.equal(meter.coalPhotoUnitIssue('S1','S1-D1','S1-D1'),null);
  assert.match(meter.coalPhotoUnitIssue('S1','S1-D1','S2-D1'),/2D1 thuộc S2/);
  const h=harness({rows:[{...photo(),key:'S1-D1',label:'S2-D1'}],onSave:async()=>assert.fail('wrong unit')});
  const tree=h.render();assert.equal(button(tree,'Lưu 0 chỉ số').props.disabled,true);
  assert.ok(text(tree).includes('2D1 thuộc S2'));assert.ok(!nodes(tree).some(n=>n.props?.['aria-label']==='Xác nhận ảnh 1'));
});
test('mixed photos flag foreign rows; changing unit clears previous confirmations and disables other-unit options',()=>{
  const h=harness({rows:[photo(),{...photo(),id:'second',key:'S2-D1',label:'S2-D1'}],onSave:async()=>{}});let tree=h.render();
  assert.ok(text(tree).includes('Phát hiện lẫn công tơ S1 và S2'));
  assert.equal(button(tree,'Lưu 1 chỉ số').props.disabled,false);
  const select=nodes(tree).find(n=>n.type==='select'&&nodes(n).some(child=>child.type==='option'&&child.props.value==='S1'));
  assert.equal(select.props.value,'S1');select.props.onChange({target:{value:'S2'}});tree=h.render();
  assert.equal(button(tree,'Lưu 0 chỉ số').props.disabled,true);
  assert.ok(!nodes(tree).some(n=>n.props?.['aria-label']==='Xác nhận ảnh 1'));
  assert.ok(nodes(tree).some(n=>n.props?.['aria-label']==='Xác nhận ảnh 2'));
  assert.equal(nodes(tree).find(n=>n.type==='option'&&n.props.value==='S1-A1').props.disabled,true);
});
