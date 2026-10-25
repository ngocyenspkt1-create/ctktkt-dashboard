import {sealCoalGeminiKey,openCoalGeminiKey} from "./coal-gemini-secret.ts";
type Db=ReturnType<typeof import("../db/index").getRawDb>;
const name="coal-meter";
export class SharedGeminiConflict extends Error {}
export async function ensureSharedGemini(db:Db) {
  await db.batch([
    db.prepare("CREATE TABLE IF NOT EXISTS coal_gemini_settings (name TEXT PRIMARY KEY, cipher TEXT, model TEXT NOT NULL, version INTEGER NOT NULL, updated_at TEXT, updated_by TEXT, operation TEXT NOT NULL)"),
    db.prepare("CREATE TABLE IF NOT EXISTS coal_gemini_settings_events (id TEXT PRIMARY KEY, version INTEGER NOT NULL, actor_id INTEGER NOT NULL, actor_name TEXT NOT NULL, action TEXT NOT NULL, created_at TEXT NOT NULL)"),
  ]);
}
export async function sharedGeminiStatus(db:Db) {
  await ensureSharedGemini(db);
  const row=await db.prepare("SELECT model,version,updated_at,updated_by,cipher IS NOT NULL AS configured FROM coal_gemini_settings WHERE name=?").bind(name).first();
  return {configured:Boolean(row?.configured),model:row?String(row.model):null,version:row?Number(row.version):0,updatedAt:row?.updated_at?String(row.updated_at):null,updatedBy:row?.updated_by?String(row.updated_by):null};
}
export async function loadSharedGemini(db:Db,secret:string|undefined) {
  await ensureSharedGemini(db);
  const row=await db.prepare("SELECT cipher,model FROM coal_gemini_settings WHERE name=?").bind(name).first();
  if(!row?.cipher) return null;
  return {key:openCoalGeminiKey(String(row.cipher),secret),model:String(row.model)};
}
export async function saveSharedGemini(db:Db,secret:string|undefined,input:{key:string;model:string;expectedVersion:number;actorId:number;actorName:string}) {
  // Encrypt before any write. Neither table contains plaintext keys or photo data.
  const cipher=sealCoalGeminiKey(input.key,secret),id=crypto.randomUUID(),now=new Date().toISOString();
  await ensureSharedGemini(db);
  const result=await db.batch([
    db.prepare("INSERT OR IGNORE INTO coal_gemini_settings(name,cipher,model,version,operation) VALUES(?,NULL,'',0,'')").bind(name),
    db.prepare("UPDATE coal_gemini_settings SET cipher=?,model=?,version=version+1,updated_at=?,updated_by=?,operation=? WHERE name=? AND version=?").bind(cipher,input.model,now,input.actorName,id,name,input.expectedVersion),
    db.prepare("INSERT INTO coal_gemini_settings_events(id,version,actor_id,actor_name,action,created_at) SELECT ?,version,?,?,'replace',? FROM coal_gemini_settings WHERE name=? AND operation=?").bind(id,input.actorId,input.actorName,now,name,id),
  ]);
  if(result[1].meta.changes!==1) throw new SharedGeminiConflict("Khóa vừa được người khác thay đổi. Tải lại trạng thái rồi kiểm tra trước khi lưu.");
  return sharedGeminiStatus(db);
}
