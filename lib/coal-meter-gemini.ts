import { CoalMeterReadingSchema, CoalMeterVisionError, COAL_METER_SYSTEM_PROMPT } from "./coal-meter-vision.ts";

export async function readCoalMeterGemini(image: {data:string;mediaType:string}, key:string, model:string, call:typeof fetch=fetch) {
  if(!/^[a-zA-Z0-9.-]+$/.test(model)) throw new CoalMeterVisionError("Cấu hình GEMINI_VISION_MODEL không hợp lệ.",503);
  const response=await call(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,{
    method:"POST", headers:{"Content-Type":"application/json","x-goog-api-key":key}, signal:AbortSignal.timeout(45000),
    body:JSON.stringify({systemInstruction:{parts:[{text:COAL_METER_SYSTEM_PROMPT}]},contents:[{role:"user",parts:[{inlineData:{mimeType:image.mediaType,data:image.data}},{text:"Read the cumulative coal total in metric tonnes, not the hourly flow. Return only JSON with screen_type, meter_label, total_display, total_unit, photo_timestamp, confidence, note. screen_type: led_total, touch_material_total, no_total_visible or not_a_meter. confidence: high, medium or low. Missing strings must be null except note. Never infer an unreadable label or digit."}]}],generationConfig:{temperature:0,responseMimeType:"application/json",maxOutputTokens:4096}}),
  });
  if(!response.ok) throw new CoalMeterVisionError(response.status===429?"Gemini hết hạn mức hoặc quá tải; thử lại sau.":"Gemini không xử lý được ảnh. Kiểm tra khóa, model và quyền truy cập trên máy chủ.",response.status===429?429:502);
  const body=await response.json() as {candidates?:{finishReason?:string;content?:{parts?:{text?:string;thought?:boolean}[]}}[]};
  const candidate=body.candidates?.[0];
  if(candidate?.finishReason!=="STOP") throw new CoalMeterVisionError("Gemini chưa đọc xong hoặc từ chối ảnh này.",422);
  const text=candidate.content?.parts?.filter(part=>!part.thought&&typeof part.text==="string").map(part=>part.text).join("")||"";
  let result;
  try {result=CoalMeterReadingSchema.parse(JSON.parse(text));} catch {throw new CoalMeterVisionError("Gemini trả kết quả không hợp lệ; chưa điền vào bảng.",502);}
  if(result.total_unit && !/^(t|ton|tons|tonne|tonnes|mtons|metric tons|tấn)$/i.test(result.total_unit.trim())) throw new CoalMeterVisionError("Đơn vị trong ảnh không phải tấn. Hãy đối chiếu thủ công.",422);
  if(!result.total_unit) {result.confidence="low"; result.note="Không đọc rõ đơn vị tấn; phải đối chiếu ảnh. "+result.note;}
  return result;
}
