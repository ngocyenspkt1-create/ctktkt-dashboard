import { getRawDb } from "@/db";
import { getSessionUser } from "@/lib/auth/server";
import { canAccessWork, WorkError } from "@/lib/work-px";
import { ensureWorkSchema, getWorkAttachment } from "@/lib/work-px-store";
export const dynamic="force-dynamic";
export async function GET(request:Request) {
  try {
    const user=await getSessionUser(); if(!user || !canAccessWork(user)) return Response.json({error:"Chưa đăng nhập."},{status:401});
    const id=new URL(request.url).searchParams.get("id") || "";
    const db=getRawDb(); await ensureWorkSchema(db);
    const file=await getWorkAttachment(db,id,user);
    const bytes=file.data;
    return new Response(bytes,{headers:{"Content-Type":String(file.type),"Content-Disposition":`attachment; filename="report-file"; filename*=UTF-8''${encodeURIComponent(String(file.name))}`,"Cache-Control":"private, no-store","X-Content-Type-Options":"nosniff","Content-Security-Policy":"sandbox; default-src 'none'"}});
  } catch(error) {return Response.json({error:error instanceof WorkError?error.message:"Không tải được tệp."},{status:error instanceof WorkError?error.status:500});}
}
