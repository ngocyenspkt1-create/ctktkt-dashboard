import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import * as React from 'react';
import {createRequire} from 'node:module';
import * as domain from '../lib/work-px.ts';
const require=createRequire(import.meta.url);
const actor={id:2,username:'synthetic',displayName:'Synthetic',role:'viewer',permissions:['work_px']};
const task=id=>({id,version:1,kind:'task',sourceType:'request',title:id,description:'Synthetic only',sourceDate:'2026-10-01',sourceId:null,creatorId:1,creatorName:'Synthetic leader',assigneeId:2,collaboratorIds:[3],startDate:'2026-10-01',dueDate:'2026-10-31',reportEveryDays:7,lastReportDate:null,status:'in_progress',progress:0,priority:'normal',createdAt:'2026-10-01T00:00:00Z',updatedAt:'2026-10-01T00:00:00Z'});
const event=(item,text)=>({id:text,itemId:item.id,actorName:'Synthetic',action:'report',text,createdAt:'2026-10-19T00:00:00Z',snapshot:{...item}});
const code=ts.transpileModule(fs.readFileSync(new URL('../components/work-px-client.tsx',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2020,esModuleInterop:true}}).outputText;
function nodes(root){const result=[];function visit(n){if(Array.isArray(n))return n.forEach(visit);if(!n||typeof n!=='object')return;result.push(n);visit(n.props?.children);}visit(root);return result;}
function text(n){return Array.isArray(n)?n.map(text).join(''):typeof n==='string'||typeof n==='number'?String(n):n?.props?text(n.props.children):'';}
const find=(tree,p)=>nodes(tree).find(p);
const button=(tree,label)=>find(tree,n=>n.type==='button'&&(n.props['aria-label']===label||text(n).trim()===label));
const editor=tree=>find(tree,n=>typeof n.type==='function'&&n.props.onChange&&'value'in n.props);
const progress=tree=>find(tree,n=>n.type==='input'&&n.props.type==='number');
function harness(){
 const slots=[],effects=[],pending=[],posts=[],gets=[],remote=new Map(['A','B'].map(id=>[id,task(id)])),histories=new Map(['A','B'].map(id=>[id,[event(task(id),'initial-'+id)]]));
 let cursor=0,tree,dirty=true,postRelease=null,holdPost=false,holdGet=null,confirm=false;
 const dependenciesEqual=(a,b)=>a&&b&&a.length===b.length&&a.every((value,index)=>Object.is(value,b[index]));
 const hooks={...React,
  useState(initial){const i=cursor++;if(!(i in slots))slots[i]=typeof initial==='function'?initial():initial;return[slots[i],value=>{const next=typeof value==='function'?value(slots[i]):value;if(!Object.is(next,slots[i])){slots[i]=next;dirty=true;}}];},
  useRef(initial){const i=cursor++;return slots[i]??=( {current:initial} );},
  useMemo(fn,deps){const i=cursor++;if(!slots[i]||!dependenciesEqual(slots[i].deps,deps))slots[i]={deps,value:fn()};return slots[i].value;},
  useCallback(fn,deps){return hooks.useMemo(()=>fn,deps);},
  useEffect(fn,deps){const i=cursor++;if(!slots[i]||!dependenciesEqual(slots[i].deps,deps)){const previous=slots[i];slots[i]={deps,cleanup:previous?.cleanup};effects.push(()=>{previous?.cleanup?.();slots[i].cleanup=fn();});}},
 };
 const fetch=async(url,options)=>{
  if(options?.method==='POST'){
   const body=JSON.parse(options.body);posts.push(body);
   if(holdPost)await new Promise(resolve=>postRelease=resolve);
   const current=remote.get(body.id);
   if(body.version!==current.version)return{ok:false,status:409,json:async()=>({error:'Synthetic conflict'})};
   const next={...domain.changeWork(current,actor,body.action,body,'2026-10-19').item,version:current.version+1};remote.set(next.id,next);histories.get(next.id).unshift(event(next,body.text));
   return{ok:true,json:async()=>({item:structuredClone(next)})};
  }
  gets.push(url);
  const id=new URL('https://synthetic.test'+url).searchParams.get('id');
  const result=structuredClone(id?{item:remote.get(id),events:histories.get(id)}:{items:[...remote.values()],members:[{id:2,displayName:'Synthetic',position:''}],today:'2026-10-19'});
  if(holdGet?.(url))await new Promise(resolve=>pending.push(resolve));
  return{ok:true,json:async()=>result};
 };
 const compiled={exports:{}};
 const dependencies=name=>name==='react'?hooks:name==='@/lib/work-px'?domain:name==='./work-report-editor'?{__esModule:true,default:function Editor(){}}:name==='@/components/session-context'?{useSessionUser:()=>actor}:name.endsWith('.css')?{}:require(name);
 vm.runInNewContext(code,{module:compiled,exports:compiled.exports,require:dependencies,fetch,queueMicrotask,Date,console,crypto:globalThis.crypto,document:{hidden:false,querySelector:()=>null,addEventListener(){},removeEventListener(){}},window:{confirm:()=>confirm,setInterval:()=>0,clearInterval(){},addEventListener(){},removeEventListener(){}}});
 function render(){cursor=0;dirty=false;tree=compiled.exports.WorkPxWorkspace({user:actor});for(const effect of effects.splice(0))effect();return tree;}
 return{
  render,get tree(){return tree;},posts,gets,remote,histories,
  async settle(){for(let i=0;i<12;i++){if(dirty)render();await new Promise(resolve=>setImmediate(resolve));}if(dirty)render();return tree;},
  select(id){find(tree,n=>n.type==='button'&&n.props.className==='wp-title'&&text(n).endsWith(id)).props.onClick();return render();},
  reload(){button(tree,'Tải lại công việc').props.onClick();},
  holdPosts(){holdPost=true;},releasePost(){postRelease();},holdGets(match){holdGet=match;},releaseGet(index){pending[index]();},allowDiscard(){confirm=true;},
 };
}
async function opened(){const h=harness();await h.settle();h.select('A');await h.settle();return h;}

test('WP-01: clean refresh synchronizes progress; dirty reports retain their original version and cannot overwrite remote progress',async()=>{
 const h=await opened();h.remote.set('A',{...h.remote.get('A'),version:2,progress:80});h.reload();await h.settle();assert.equal(progress(h.tree).props.value,80);
 editor(h.tree).props.onChange('Draft report','<p>Draft report</p>');h.render();h.remote.set('A',{...h.remote.get('A'),version:3,progress:90});h.reload();await h.settle();
 assert.equal(editor(h.tree).props.value,'Draft report');assert.equal(progress(h.tree).props.value,80);assert.match(text(h.tree),/Bản nháp được giữ nguyên/);
 button(h.tree,'Gửi báo cáo').props.onClick();await h.settle();assert.equal(h.posts[0].version,2);assert.equal(h.remote.get('A').progress,90);assert.equal(editor(h.tree).props.value,'Draft report');
 h.allowDiscard();button(h.tree,'Nạp lại biểu mẫu').props.onClick();await h.settle();assert.equal(progress(h.tree).props.value,90);assert.equal(editor(h.tree).props.value,'');
});

test('WP-02: pending saves prevent switching task or opening another form, and duplicate submission sends only once',async()=>{
 const h=await opened();editor(h.tree).props.onChange('Report A','<p>Report A</p>');h.render();h.holdPosts();const send=button(h.tree,'Gửi báo cáo');send.props.onClick();send.props.onClick();h.render();h.select('B');button(h.tree,'Ghi nhận nội dung').props.onClick();h.render();
 assert.equal(h.posts.length,1);assert.equal(find(h.tree,n=>n.props?.role==='dialog'),undefined);assert.equal(editor(h.tree).props.value,'Report A');assert.equal(editor(h.tree).props.disabled,true);
 h.releasePost();await h.settle();assert.equal(h.remote.get('A').version,2);assert.equal(h.remote.get('B').version,1);assert.equal(editor(h.tree).props.value,'');
});

test('WP-03 and WP-04: reload refreshes history; selecting the same task preserves history and unsent formatting',async()=>{
 const h=await opened();const before=h.gets.length;editor(h.tree).props.onChange('Unsent','<p><strong>Unsent</strong></p>');h.render();h.select('A');await h.settle();assert.equal(h.gets.length,before);assert.match(text(h.tree),/initial-A/);assert.equal(editor(h.tree).props.value,'Unsent');
 const current={...h.remote.get('A'),version:2};h.remote.set('A',current);h.histories.get('A').unshift(event(current,'new report by remote session'));h.reload();await h.settle();
 assert.match(text(h.tree),/new report by remote session/);assert.equal(editor(h.tree).props.value,'Unsent');assert.ok(h.gets.at(-1).includes('?id=A'));
});

test('WP-05: overlapping list and detail requests cannot replace a newer version with an older response',async()=>{
 const h=await opened();h.holdGets(url=>!url.includes('?'));h.reload();h.remote.set('A',{...h.remote.get('A'),version:2,progress:80});h.reload();h.releaseGet(1);await h.settle();assert.equal(progress(h.tree).props.value,80);h.releaseGet(0);await h.settle();assert.equal(progress(h.tree).props.value,80);
 h.holdGets(url=>url.includes('?'));h.reload();await h.settle();h.remote.set('A',{...h.remote.get('A'),version:3,progress:90});h.reload();await h.settle();h.releaseGet(3);await h.settle();h.releaseGet(2);await h.settle();assert.equal(progress(h.tree).props.value,90);
});

test('A detail response for a previously selected task does not replace the current task history',async()=>{
 const h=await opened();h.holdGets(url=>url.includes('?id=A'));h.reload();await h.settle();h.select('B');await h.settle();h.releaseGet(0);await h.settle();assert.match(text(h.tree),/initial-B/);assert.doesNotMatch(text(h.tree),/initial-A/);
});

test('Switching tasks requires confirmation before discarding an unsent report',async()=>{
 const h=await opened();editor(h.tree).props.onChange('Keep draft','<p>Keep draft</p>');h.render();h.select('B');await h.settle();assert.equal(editor(h.tree).props.value,'Keep draft');assert.match(text(h.tree),/initial-A/);
 h.allowDiscard();h.select('B');await h.settle();assert.equal(editor(h.tree).props.value,'');assert.match(text(h.tree),/initial-B/);
});
