import { getSessionUser } from "@/lib/auth/server";
import { canEditCtktktGroup } from "@/lib/ctktkt-permissions";
import { coalPhotoDb } from "@/lib/coal-photo-store";
export const dynamic="force-dynamic";
export async function GET(request:Request) {
  const user=await getSessionUser();
  if(!user) return Response.json({error:"Chưa đăng nhập."},{status:401});
  if(!canEditCtktktGroup(user,"may_nghien_coal_s1")&&!canEditCtktktGroup(user,"may_nghien_coal_s2")) return Response.json({error:"Không có quyền xem ảnh công tơ."},{status:403});
  try {
    const db=await coalPhotoDb(),url=new URL(request.url),id=url.searchParams.get("id");
    if(id){
      const photo=await db.prepare("SELECT type,data FROM coal_meter_photos WHERE id=? AND owner_id=? AND expires_at>?").bind(id,user.id,Date.now()).first();
      if(!photo) return Response.json({error:"Ảnh hết hạn hoặc không có quyền xem."},{status:404});
      return new Response(Buffer.from(String(photo.data),"base64"),{headers:{"Content-Type":String(photo.type),"Cache-Control":"private, no-store","X-Content-Type-Options":"nosniff","Content-Security-Policy":"default-src 'none'; sandbox"}});
    }
    const date=url.searchParams.get("date")||"";
    if(!/^20\d{2}-\d{2}-\d{2}$/.test(date)) return Response.json({error:"Ngày không hợp lệ."},{status:400});
    const photos=await db.prepare("SELECT id,slot,reading,expires_at AS expiresAt FROM coal_meter_photos WHERE owner_id=? AND report_date=? AND expires_at>? ORDER BY created_at DESC LIMIT 72").bind(user.id,date,Date.now()).all();
    return Response.json({photos:photos.results.map(p=>({...p,reading:JSON.parse(String(p.reading))}))},{headers:{"Cache-Control":"private, no-store"}});
  }catch{return Response.json({error:"Chưa truy cập được kho ảnh."},{status:503});}
}
