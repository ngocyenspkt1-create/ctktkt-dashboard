import { timingSafeEqual } from "node:crypto";
import { coalPhotoDb } from "@/lib/coal-photo-store";
export async function GET(request:Request) {
  const secret=process.env.CRON_SECRET,auth=request.headers.get("authorization")||"";
  const expected=`Bearer ${secret}`;
  if(!secret || Buffer.byteLength(auth)!==Buffer.byteLength(expected) || !timingSafeEqual(Buffer.from(auth),Buffer.from(expected))) return Response.json({error:"Unauthorized"},{status:401});
  try{await coalPhotoDb();return Response.json({ok:true},{headers:{"Cache-Control":"no-store"}});}catch{return Response.json({error:"Cleanup failed"},{status:503});}
}
