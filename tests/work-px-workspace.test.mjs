import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import * as React from 'react';
import {createRequire} from 'node:module';
import * as domain from '../lib/work-px.ts';
const require=createRequire(import.meta.url);
const actor={id:2,username:'synthetic2',displayName:'Synthetic 2',role:'viewer',permissions:['work_px']};
const item=()=>({id:'synthetic-ui',version:1,kind:'task',sourceType:'meeting',title:'Synthetic workflow',description:'Synthetic only',sourceDate:'2026-10-01',sourceId:null,creatorId:1,creatorName:'Synthetic 1',assigneeId:2,collaboratorIds:[3],startDate:'2026-10-01',dueDate:'2026-10-31',reportEveryDays:7,lastReportDate:null,status:'assigned',progress:0,priority:'normal',createdAt:'2026-10-01T00:00:00Z',updatedAt:'2026-10-01T00:00:00Z'});
function harness(user=actor){
 let states=[],refs=[],cursor=0,refCursor=0,current=item(),posts=[],events=[];
 const seed={items:[current],members:[{id:2,displayName:'Synthetic 2',position:'Synthetic'}],today:'2026-10-14'};
 const hooks={...React,useState:initial=>{const i=cursor++;if(!(i in states))states[i]=i===0?seed:typeof initial==='function'?initial():initial;return[states[i],value=>{states[i]=typeof value==='function'?value(states[i]):value;}];},useRef:initial=>{const i=refCursor++;if(!refs[i])refs[i]={current:initial};return refs[i];},useEffect:()=>{},useMemo:fn=>fn(),useCallback:fn=>fn};
 const cjsModule={exports:{}};
 const code=ts.transpileModule(fs.readFileSync(new URL('../components/work-px-client.tsx',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2020,esModuleInterop:true}}).outputText;
 const fetch=async(url,options)=>{
  if(options?.method==='POST') {const body=JSON.parse(options.body);posts.push(body);const changed=domain.changeWork(current,user,body.action,body,'2026-10-14');current={...changed.item,version:current.version+1};events.push({id:String(events.length+1),itemId:current.id,actorId:user.id,actorName:user.displayName,action:body.action,text:changed.text,createdAt:current.updatedAt,snapshot:current});return{ok:true,json:async()=>({item:current})};}
  return{ok:true,json:async()=>({events})};
 };
 const dependencies=name=>name==='react'?hooks:name==='@/lib/work-px'?domain:name==='./work-report-editor'?{__esModule:true,default:function Editor(){}}:name==='@/components/session-context'?{useSessionUser:()=>user}:name.endsWith('.css')?{}:require(name);
 vm.runInNewContext(code,{module:cjsModule,exports:cjsModule.exports,require:dependencies,fetch,FileReader:class{},Date,console,crypto:globalThis.crypto,window:{confirm:()=>false}},{filename:'work-px-client.cjs'});
 return{render(){cursor=0;refCursor=0;return cjsModule.exports.WorkPxWorkspace({user});},posts,get current(){return current;}};
}
function nodes(root){const all=[];function visit(node){if(Array.isArray(node))return node.forEach(visit);if(!node||typeof node!=='object')return;all.push(node);visit(node.props?.children);}visit(root);return all;}
function text(root){if(Array.isArray(root))return root.map(text).join('');if(typeof root==='string'||typeof root==='number')return String(root);return root?.props?text(root.props.children):'';}
const find=(root,predicate)=>nodes(root).find(predicate);
const button=(root,label)=>find(root,n=>n.type==='button'&&(n.props['aria-label']===label||text(n).trim()===label.trim()));
function open(h){let tree=h.render();find(tree,n=>n.type==='button'&&n.props.className==='wp-title').props.onClick();return h.render();}
async function flush(){for(let i=0;i<8;i++)await new Promise(resolve=>setImmediate(resolve));}

test('Click step 2 opens confirm; Cancel performs no mutation; Agree accepts without typed note',async()=>{
 const h=harness();let tree=open(h);const step=button(tree,'Bước 2: Tiếp nhận công việc');assert.ok(step);step.props.onClick();tree=h.render();assert.ok(find(tree,n=>n.props?.role==='dialog'));button(tree,'Hủy').props.onClick();assert.equal(h.posts.length,0);assert.equal(h.current.status,'assigned');
 tree=h.render();button(tree,'Bước 2: Tiếp nhận công việc').props.onClick();tree=h.render();button(tree,'Đồng ý').props.onClick();await flush();tree=h.render();assert.equal(h.current.status,'in_progress');assert.equal(h.posts[0].text,'Đã tiếp nhận công việc và bắt đầu thực hiện.');assert.equal(h.posts[0].version,1);assert.equal(find(tree,n=>n.props?.role==='dialog'),undefined);assert.ok(find(tree,n=>typeof n.type==='function'&&n.props?.onChange&&n.props?.value===''));
});

test('In progress editor updates report text/format, report send advances progress but does not close task',async()=>{
 const h=harness();let tree=open(h);button(tree,'Bước 2: Tiếp nhận công việc').props.onClick();tree=h.render();button(tree,'Đồng ý').props.onClick();await flush();tree=h.render();
 const editor=find(tree,n=>typeof n.type==='function'&&n.props?.onChange&&'value'in n.props);editor.props.onChange('Completed part A','<p><strong>Completed part A</strong></p>');
 const progress=find(tree,n=>n.type==='input'&&n.props.type==='number');progress.props.onChange({target:{value:'45'}});tree=h.render();const send=button(tree,' Gửi báo cáo');assert.ok(send);assert.equal(send.props.disabled,false);send.props.onClick();await flush();assert.equal(h.posts[1].action,'report');assert.equal(h.posts[1].reportHtml,'<p><strong>Completed part A</strong></p>');assert.equal(h.current.progress,45);assert.equal(h.current.status,'in_progress');
});

test('Collaborator and observer do not receive an acceptance step or confirmation control',()=>{
 for(const id of [3,4]){const h=harness({...actor,id});let tree=h.render();if(find(tree,n=>n.type==='button'&&n.props.className==='wp-title'))tree=open(h);assert.equal(button(tree,'Bước 2: Tiếp nhận công việc'),undefined);assert.equal(button(tree,'Tiếp nhận công việc'),undefined);}
});
