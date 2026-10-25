import {getSessionUser} from "@/lib/auth/server";
import {canEditCtktktGroup} from "@/lib/ctktkt-permissions";
import {getRawDb} from "@/db";
import {loadSharedGemini} from "@/lib/coal-gemini-shared-store";
import {coalGeminiConfig} from "@/lib/coal-gemini-config";
import {checkCoalGeminiConnection} from "@/lib/coal-meter-gemini";
import {CoalMeterVisionError} from "@/lib/coal-meter-vision";

export const runtime="nodejs";
export const maxDuration=30;
const json=(body:unknown,status=200)=>Response.json(body,{status,headers:{"Cache-Control":"private, no-store","X-Content-Type-Options":"nosniff"}});

export async function POST(request:Request) {
  const user=await getSessionUser();
  if(!user)return json({error:"Chưa đăng nhập."},401);
  if(!canEditCtktktGroup(user,"may_nghien_coal_s1")&&!canEditCtktktGroup(user,"may_nghien_coal_s2"))return json({error:"Bạn không có quyền kiểm tra cấu hình công tơ than."},403);
  if(request.headers.get("origin")!==new URL(request.url).origin)return json({error:"Nguồn yêu cầu không hợp lệ."},403);
  let shared:{key:string;model:string}|null;
  try {shared=await loadSharedGemini(getRawDb(),process.env.AUTH_SECRET);}
  catch {return json({error:"Chưa đọc được khóa dùng chung từ máy chủ. Đây là lỗi cấu hình/kho khóa, chưa gửi yêu cầu tới Google."},503);}
  const config=coalGeminiConfig(new Headers(),shared?.key||process.env.GEMINI_API_KEY,shared?.model||process.env.GEMINI_VISION_MODEL);
  if(!config.ok)return json({error:config.error},config.status);
  try {return json(await checkCoalGeminiConnection(config.key,config.model));}
  catch(error){return json({error:error instanceof CoalMeterVisionError?error.message:"Chưa kiểm tra được kết nối Google. Không có ảnh hoặc số liệu nào được thay đổi."},error instanceof CoalMeterVisionError?error.status:502);}
}
