import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {readFile,writeFile,mkdir,lstat} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import JSZip from 'jszip';

const root=fileURLToPath(new URL('../',import.meta.url));
const git=(...args)=>execFileSync('git',args,{cwd:root,encoding:'utf8',maxBuffer:8*1024*1024});
const tracked=git('ls-files','-z').split('\0').filter(Boolean);
const extra=git('ls-files','--others','--exclude-standard','-z').split('\0').filter(Boolean)
  .filter(name=>/^(app|components|lib|scripts|docs|tests|db|assets|public|hooks|drizzle|browser-extension|vendor|wb)\//.test(name)||name==='TRANSFER_README.md');
const excluded=name=>name==='.mcp.json'||/^(\.git|\.claude|\.agents|\.codex|\.next|\.wrangler|\.vinext|\.sites-runtime|node_modules|outputs|dist|coverage)(\/|$)/.test(name)
  ||/(^|\/)\.env(?:[./]|$)/.test(name)||/\.(?:pem|key|sqlite|sqlite3|db|tsbuildinfo|log)$/i.test(name);
const names=[...new Set([...tracked,...extra])].filter(name=>!excluded(name)).sort();
const zip=new JSZip(),records=[],missing=[];
const digest=bytes=>createHash('sha256').update(bytes).digest('hex');
const secretPattern=/AIza[0-9A-Za-z_-]{30,}|AQ\.[0-9A-Za-z_-]{35,}|-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/;
async function add(name,data){
  if(/\.(?:[cm]?[jt]sx?|json|md|txt|ya?ml|toml|env|example|sh|sql)$/i.test(name)&&secretPattern.test(data.toString('utf8')))
    throw new Error(`Potential embedded credential in ${name}; review before packaging (value not printed).`);
  if(name.endsWith('.zip')){
    const nested=await JSZip.loadAsync(data);
    for(const entry of Object.values(nested.files))if(!entry.dir&&/\.(?:js|json|txt|md)$/i.test(entry.name)&&secretPattern.test(await entry.async('string')))
      throw new Error(`Potential embedded credential in nested archive ${name}; review before packaging.`);
  }
  zip.file('ctktkt-dashboard/'+name,data);
  records.push({path:name,bytes:data.length,sha256:digest(data)});
}
for(const name of names){
  const absolute=path.resolve(root,name);
  if(!absolute.startsWith(root))throw new Error('Path outside project.');
  let info;
  try{info=await lstat(absolute);}catch(error){if(error.code==='ENOENT'){missing.push(name);continue;}throw error;}
  if(!info.isFile()||info.isSymbolicLink())throw new Error(`Unsupported file: ${name}`);
  await add(name,await readFile(absolute));
}
await add('.env.example',await readFile(path.join(root,'docs/transfer.env.example')));
const manifest={format:'ctktkt-project-transfer',version:1,createdAt:new Date().toISOString(),baseCommit:git('rev-parse','HEAD').trim(),
  workingChanges:git('diff','--name-only').trim().split(/\r?\n/).filter(Boolean),uncommittedAddedFiles:extra.filter(name=>!excluded(name)),missingTrackedFiles:missing,
  note:'Source snapshot including local changes. Database contents and real environment values are not included.',files:records};
zip.file('ctktkt-dashboard/TRANSFER_MANIFEST.json',JSON.stringify(manifest,null,2));
const archive=await zip.generateAsync({type:'nodebuffer',compression:'DEFLATE',compressionOptions:{level:6}});
// Reload and verify every archived byte rather than assuming a created ZIP is usable.
const verified=await JSZip.loadAsync(archive,{checkCRC32:true});
for(const record of records){
  const entry=verified.file('ctktkt-dashboard/'+record.path);
  if(!entry||digest(await entry.async('nodebuffer'))!==record.sha256)throw new Error(`Archive verification failed: ${record.path}`);
}
const date=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Ho_Chi_Minh',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
const out=path.join(root,'outputs','transfer');await mkdir(out,{recursive:true});
const name=`ctktkt-dashboard-transfer-${date}.zip`,target=path.join(out,name);
await writeFile(target,archive);
await writeFile(target+'.sha256',digest(archive)+'  '+name+'\n');
console.log(JSON.stringify({archive:target,files:records.length+1,bytes:archive.length,verified:true,missingTrackedFiles:missing.length},null,2));
