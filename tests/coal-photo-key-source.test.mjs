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
function harness(){
  const states=[],refs=[],calls=[];let cursor=0,refCursor=0;
  const hooks={...React,useState:initial=>{
    const i=cursor++;if(!(i in states))states[i]=typeof initial==='function'?initial():initial;
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
  vm.runInNewContext(code,{module:cjsModule,exports:cjsModule.exports,require:dependencies,fetch:request,AbortController,AbortSignal,Number,Intl,Map,Set},{filename:'coal-photo-import.cjs'});
  return {calls,SharedSettings,render(){cursor=0;refCursor=0;return cjsModule.exports.CoalMeterPhotoImport({open:true,onOpenChange:()=>{},reportDate:'2026-10-24',current:{},canEditCell:()=>true,onApply:()=>{},request});}};
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
