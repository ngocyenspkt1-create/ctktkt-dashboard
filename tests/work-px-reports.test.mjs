import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {cleanReportHtml,decodeReportFiles,FILE_LIMIT,STORAGE_LIMIT} from '../lib/work-px-reports.ts';
import {changeWork} from '../lib/work-px.ts';
import {ensureWorkSchema,saveWork,workHistory,getWorkAttachment} from '../lib/work-px-store.ts';
const user=id=>({id,username:`demo${id}`,displayName:`Synthetic ${id}`,role:'viewer',permissions:['work_px']});
const leader={...user(1),permissions:['manage_work_px']};
const task=()=>({id:'test-report',version:1,kind:'task',sourceType:'meeting',title:'Synthetic',description:'Synthetic test only',sourceDate:'2026-10-01',sourceId:null,creatorId:1,creatorName:'Synthetic',assigneeId:2,collaboratorIds:[3],startDate:'2026-10-01',dueDate:'2026-10-31',reportEveryDays:7,lastReportDate:null,status:'assigned',progress:0,priority:'normal',createdAt:'2026-10-01T00:00:00Z',updatedAt:'2026-10-01T00:00:00Z'});
function database(){const sqlite=new DatabaseSync(':memory:');const stmt=(sql,args=[])=>({sql,args,bind:(...v)=>stmt(sql,v),first:async()=>sqlite.prepare(sql).get(...args)||null,all:async()=>({results:sqlite.prepare(sql).all(...args)}),run:async()=>{const r=sqlite.prepare(sql).run(...args);return{meta:{changes:Number(r.changes)}};}});return{sqlite,db:{prepare:sql=>stmt(sql),batch:async statements=>{sqlite.exec('BEGIN');try{const r=[];for(const s of statements)r.push(await s.run());sqlite.exec('COMMIT');return r;}catch(e){sqlite.exec('ROLLBACK');throw e;}}}};}
const pdf=()=>({name:'report.pdf',base64:Buffer.from('%PDF-1.4\nSynthetic only').toString('base64')});
test('HTML sanitizer retains formatting and removes executable content and remote images',()=>{
 const html=cleanReportHtml('<p><strong>Done</strong><span style="color:rgb(230, 0, 0);background-image:url(https://evil.test)">Red</span><img src="https://evil.test" onerror="alert(1)"><script>alert(1)</script><iframe src="https://evil.test"></iframe><a href="javascript:alert(1)" onclick="bad()">unsafe</a></p>');
 assert.match(html,/<strong>Done<\/strong>/);assert.match(html,/color:rgb/);assert.doesNotMatch(html,/script|iframe|<img|onclick|onerror|background-image|evil.test/);
 assert.match(cleanReportHtml('<a href="https://example.test">Reference</a>'),/noopener noreferrer/);
 assert.throws(()=>cleanReportHtml('a'.repeat(80001)));assert.equal(cleanReportHtml(undefined),undefined);
});
test('Attachments enforce type, signature, canonical base64, counts and byte limits',()=>{
 assert.equal(decodeReportFiles([pdf()])[0].type,'application/pdf');
 for(const file of [{...pdf(),name:'../r.pdf'},{...pdf(),name:'r.svg'},{...pdf(),base64:'!!!!'},{name:'fake.pdf',base64:Buffer.from('hello').toString('base64')},{name:'big.txt',base64:Buffer.alloc(FILE_LIMIT+1,65).toString('base64')}])assert.throws(()=>decodeReportFiles([file]));
 assert.throws(()=>decodeReportFiles(Array.from({length:4},pdf)));
 assert.throws(()=>decodeReportFiles(Array.from({length:3},()=>({name:'full.txt',base64:Buffer.alloc(FILE_LIMIT,65).toString('base64')}))));
});
test('Accept records automatic confirmation once, with permissions and stale version checks',async()=>{
 const{sqlite,db}=database();try{await ensureWorkSchema(db);const current=await saveWork(db,task(),leader,'create_task','assign',null);const text='Đã tiếp nhận công việc và bắt đầu thực hiện.';
 assert.throws(()=>changeWork(current,user(3),'accept',{text},'2026-10-14'));
 const changed=changeWork(current,user(2),'accept',{text},'2026-10-14');const accepted=await saveWork(db,changed.item,user(2),'accept',changed.text,current.version);assert.equal(accepted.status,'in_progress');
 await assert.rejects(saveWork(db,changed.item,user(2),'accept',changed.text,current.version));assert.equal((await workHistory(db,current.id)).filter(e=>e.action==='accept').length,1);
 }finally{sqlite.close();}
});
test('Rich report, file and journal persist atomically, downloads enforce membership and CAS leaves no orphan files',async()=>{
 const{sqlite,db}=database();try{await ensureWorkSchema(db);let current=await saveWork(db,{...task(),status:'in_progress'},leader,'create_task','assign',null);
 const files=decodeReportFiles([pdf()]);const changed=changeWork(current,user(2),'report',{text:'Completed part A',progress:40},'2026-10-14');
 const saved=await saveWork(db,changed.item,user(2),'report',changed.text,current.version,undefined,{html:'<p><strong>Completed part A</strong></p>',files});
 const history=await workHistory(db,current.id);assert.match(history[0].reportHtml,/<strong>/);assert.equal(history[0].attachments[0].name,'report.pdf');assert.equal(saved.progress,40);
 const retrieved=await getWorkAttachment(db,files[0].id,user(3));assert.equal(Buffer.from(retrieved.data).toString(),'%PDF-1.4\nSynthetic only');await assert.rejects(getWorkAttachment(db,files[0].id,user(4)),/quyền/);
 await assert.rejects(saveWork(db,changed.item,user(2),'report','stale',current.version,undefined,{files:decodeReportFiles([pdf()])}));assert.equal(sqlite.prepare('SELECT COUNT(*) AS n FROM px_work_attachments').get().n,1);
 current=saved;const next=changeWork(current,user(2),'report',{text:'Duplicate test',progress:50},'2026-10-14');await assert.rejects(saveWork(db,next.item,user(2),'report',next.text,current.version,undefined,{files}));assert.equal(sqlite.prepare('SELECT version FROM px_work_items WHERE id=?').get(current.id).version,current.version);
 }finally{sqlite.close();}
});
test('Attachment capacity prevents report update and journal writes in the same transaction',async()=>{
 const{sqlite,db}=database();try{await ensureWorkSchema(db);const current=await saveWork(db,{...task(),status:'in_progress'},leader,'create_task','assign',null);
 sqlite.prepare('INSERT INTO px_work_attachments VALUES (?,?,?,?,?,?,?)').run('full','unused','unused','full.txt','text/plain',STORAGE_LIMIT,Buffer.from('x'));
 const changed=changeWork(current,user(2),'report',{text:'Capacity check',progress:20},'2026-10-14');await assert.rejects(saveWork(db,changed.item,user(2),'report',changed.text,current.version,undefined,{files:decodeReportFiles([pdf()])}),/đầy/);assert.equal((await workHistory(db,current.id)).length,1);assert.equal(sqlite.prepare('SELECT version FROM px_work_items WHERE id=?').get(current.id).version,current.version);
 }finally{sqlite.close();}
});
