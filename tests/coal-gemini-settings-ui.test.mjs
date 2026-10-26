import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import * as React from 'react';
import {createRequire} from 'node:module';
import * as config from '../lib/coal-gemini-config.ts';
const require=createRequire(import.meta.url);
function nodes(root){const result=[];function visit(n){if(Array.isArray(n))return n.forEach(visit);if(!n||typeof n!=='object')return;result.push(n);visit(n.props?.children);}visit(root);return result;}
function text(n){if(Array.isArray(n))return n.map(text).join('');if(typeof n==='string'||typeof n==='number')return String(n);return text(n?.props?.children??'');}
const button=(tree,name)=>nodes(tree).find(n=>n.type==='button'&&text(n).trim()===name);
const flush=async()=>{for(let i=0;i<4;i++)await new Promise(resolve=>setImmediate(resolve));};
test('model-only save never transmits a filled replacement password and uses current version',async()=>{
  const states=[],posts=[];let cursor=0,saved=0;
  let status={configured:true,model:'gemini-3.8-flash',version:7,updatedAt:null,updatedBy:null};
  const hooks={...React,useEffect:()=>{},useState:initial=>{
    const i=cursor++;if(!(i in states))states[i]=typeof initial==='function'?initial():initial;
    return [states[i],value=>{states[i]=typeof value==='function'?value(states[i]):value;}];
  }};
  const request=async(url,options)=>{
    if(options?.method==='PUT'){const body=JSON.parse(options.body);posts.push(body);status={...status,model:body.model,version:status.version+1};}
    return Response.json({shared:status});
  };
  const dependencies=name=>name==='react'?hooks:name==='@/lib/coal-gemini-config'?config:name.endsWith('.module.css')?{__esModule:true,default:{}}:
    name==='lucide-react'?new Proxy({},{get:()=>function Icon(){}}):require(name);
  const code=ts.transpileModule(fs.readFileSync(new URL('../components/coal-gemini-shared-settings.tsx',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2020,esModuleInterop:true}}).outputText;
  const cjsModule={exports:{}};
  vm.runInNewContext(code,{module:cjsModule,exports:cjsModule.exports,require:dependencies,fetch:request,AbortController,Date},{filename:'shared-gemini.cjs'});
  function render(){cursor=0;return cjsModule.exports.CoalGeminiSharedSettings({request,onSaved:()=>saved++});}
  let tree=render();button(tree,'Cấu hình Gemini').props.onClick();tree=render();
  button(tree,'Tải lại trạng thái').props.onClick();await flush();tree=render();
  nodes(tree).find(n=>n.type==='input'&&n.props.type==='password').props.onChange({target:{value:'synthetic-unsubmitted-password'}});
  tree=render();button(tree,'Chọn model đọc nhanh').props.onClick();tree=render();
  assert.equal(button(tree,'Lưu model, giữ nguyên khóa').props.disabled,false);
  button(tree,'Lưu model, giữ nguyên khóa').props.onClick();await flush();
  assert.deepEqual(posts,[{key:'',model:config.DEFAULT_COAL_GEMINI_MODEL,expectedVersion:7}]);
  assert.equal(saved,1);assert.ok(text(render()).includes('giữ nguyên khóa dùng chung'));
});
