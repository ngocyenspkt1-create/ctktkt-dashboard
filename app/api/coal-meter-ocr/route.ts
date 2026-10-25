import { getSessionUser } from "@/lib/auth/server";
import { canEditCtktktGroup } from "@/lib/ctktkt-permissions";
import { CoalMeterVisionError } from "@/lib/coal-meter-vision";
import { readCoalMeterGemini } from "@/lib/coal-meter-gemini";
import { saveCoalPhoto,reserveCoalPhotoRead } from "@/lib/coal-photo-store";
import { coalPhotoExpiry } from "@/lib/coal-photo-retention";
import {parseVisionTimestamp,slotForPhotoTime} from "@/lib/coal-meter-ocr";

// Reading one photo with the vision model usually takes a few seconds, occasionally longer.
export const maxDuration = 60;

const MAX_BASE64_LENGTH = 5_000_000;
const MEDIA_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);


export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) return Response.json({ error: "Chưa đăng nhập." }, { status: 401 });
  if (!canEditCtktktGroup(user, "may_nghien_coal_s1") && !canEditCtktktGroup(user, "may_nghien_coal_s2")) {
    return Response.json({ error: "Tài khoản của bạn không có quyền nhập công tơ than." }, { status: 403 });
  }
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) return Response.json({ error: "Nguồn yêu cầu không hợp lệ." }, { status: 403 });
  if (!process.env.GEMINI_API_KEY || !process.env.GEMINI_VISION_MODEL) {
    return Response.json({ error: "Chưa cấu hình GEMINI_API_KEY và GEMINI_VISION_MODEL trên máy chủ." }, { status: 503 });
  }

  if(Number(request.headers.get("content-length")||0)>4_000_000) return Response.json({error:"Ảnh quá lớn."},{status:413});
  const reader=request.body?.getReader();
  if(!reader) return Response.json({error:"Thiếu ảnh."},{status:400});
  const chunks:Uint8Array[]=[]; let size=0;
  while(true) { const {done,value}=await reader.read(); if(done) break; size+=value.length; if(size>4_000_000){await reader.cancel();return Response.json({error:"Ảnh quá lớn."},{status:413});} chunks.push(value); }
  let body:{data?:unknown;mediaType?:unknown;reportDate?:unknown;slot?:unknown;exifDate?:unknown;exifSlot?:unknown}|null=null;
  try{body=JSON.parse(Buffer.concat(chunks).toString("utf8"));}catch{/* invalid JSON */}
  const data = typeof body?.data === "string" ? body.data : "";
  const mediaType = typeof body?.mediaType === "string" ? body.mediaType : "";
  if (!data || !MEDIA_TYPES.has(mediaType)) return Response.json({ error: "Ảnh không hợp lệ." }, { status: 400 });
  if (data.length > MAX_BASE64_LENGTH) return Response.json({ error: "Ảnh quá lớn." }, { status: 413 });
  const reportDate=String(body?.reportDate||""),slot=String(body?.slot||"");
  try{if(coalPhotoExpiry(reportDate,slot)>Date.now()+40*3600000)throw new Error("future");}catch{return Response.json({error:"Ngày hoặc mốc ca không hợp lệ hoặc ở tương lai."},{status:400});}
  if(!/^[A-Za-z0-9+/]+={0,2}$/.test(data)||data.length%4!==0) return Response.json({error:"Mã ảnh không hợp lệ."},{status:400});
  const bytes=Buffer.from(data,"base64");
  const signature=mediaType==="image/jpeg"?bytes[0]===255&&bytes[1]===216&&bytes[2]===255:mediaType==="image/png"?bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])):bytes.toString("ascii",0,4)==="RIFF"&&bytes.toString("ascii",8,12)==="WEBP";
  if(!signature) return Response.json({error:"Nội dung ảnh không đúng định dạng."},{status:400});
  try {
    if(!await reserveCoalPhotoRead(user.id)) return Response.json({error:"Đã đủ 72 lượt đọc ảnh/giờ cho tài khoản này. Hãy thử lại giờ tiếp theo."},{status:429});
    const reading = await readCoalMeterGemini({data,mediaType},process.env.GEMINI_API_KEY,process.env.GEMINI_VISION_MODEL);
    const timestamp=parseVisionTimestamp(reading.photo_timestamp),timing=timestamp?slotForPhotoTime(timestamp):null;
    const photoDate=typeof body?.exifDate==="string"?body.exifDate:timing?.operatingDate;
    const photoSlot=typeof body?.exifSlot==="string"?body.exifSlot:timing?.slot;
    const photo=photoDate&&photoDate!==reportDate?null:await saveCoalPhoto(user.id,reportDate,photoSlot||slot,mediaType,data,reading);
    return Response.json({ reading, photo },{headers:{"Cache-Control":"no-store"}});
  } catch (error) {
    if (error instanceof CoalMeterVisionError) return Response.json({ error: error.message }, { status: error.status });
    // Never log provider errors, keys or photo content.
    return Response.json({ error: "Chưa đọc/lưu được ảnh. Có thể Gemini quá thời gian hoặc kho ảnh không truy cập được; hãy thử lại." }, { status: 503 });
  }
}
