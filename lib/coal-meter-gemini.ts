import { CoalMeterReadingSchema, CoalMeterVisionError, COAL_METER_SYSTEM_PROMPT } from "./coal-meter-vision.ts";

export async function coalGeminiHttpError(response: Response) {
  // Only enumerated reasons are used. Provider messages may echo credentials.
  const failure = await response.json().catch(() => null) as {error?:{details?:{reason?:string}[]}} | null;
  const reasons = Array.isArray(failure?.error?.details) ? failure.error.details.map(item=>item?.reason) : [];
  const message = reasons.some(reason=>reason==="API_KEY_INVALID"||reason==="API_KEY_EXPIRED") || response.status===401
    ? "Khóa Gemini không hợp lệ hoặc đã hết hiệu lực. Mở Cấu hình Gemini để nhập lại khóa, rồi kiểm tra kết nối."
    : response.status===403
    ? "Google từ chối quyền truy cập. Kiểm tra quyền của khóa, giới hạn API và dự án Google AI Studio."
    : response.status===404
    ? "Không tìm thấy model Gemini hoặc khóa chưa được cấp quyền dùng model này. Kiểm tra model trong Cấu hình Gemini."
    : response.status===429
    ? "Gemini đã hết hạn mức hoặc đang quá tải. Chờ rồi bấm Đọc lại; gửi lại ngay có thể vẫn lỗi."
    : response.status===400
    ? "Google không chấp nhận yêu cầu hoặc cấu hình Gemini. Kiểm tra khóa và model; phản hồi này chưa kết luận ảnh khó đọc."
    : "Google Gemini đang gặp lỗi dịch vụ. Giữ ảnh và thử lại sau.";
  return new CoalMeterVisionError(`${message} (Google HTTP ${response.status})`,response.status===429?429:502);
}

/** Checks credentials/model metadata independently of image quality, without generation. */
export async function checkCoalGeminiConnection(key:string,model:string,call:typeof fetch=fetch) {
  if(!/^gemini-[A-Za-z0-9.-]{1,100}$/.test(model)) throw new CoalMeterVisionError("Tên model Gemini không hợp lệ.",400);
  let response:Response;
  try {
    response=await call(`https://generativelanguage.googleapis.com/v1beta/models/${model}`,{
      method:"GET",headers:{"x-goog-api-key":key},signal:AbortSignal.timeout(12000),cache:"no-store",
    });
  } catch {
    throw new CoalMeterVisionError("Chưa kết nối được Google để kiểm tra khóa/model trong 12 giây. Chưa gửi ảnh hoặc chạy đọc số.",504);
  }
  if(!response.ok)throw await coalGeminiHttpError(response);
  const result=await response.json().catch(()=>null) as {name?:unknown;supportedGenerationMethods?:unknown}|null;
  if(typeof result?.name!=="string"||!Array.isArray(result.supportedGenerationMethods))throw new CoalMeterVisionError("Google trả trạng thái model không hợp lệ. Chưa thể xác nhận kết nối.",502);
  if(!result.supportedGenerationMethods.includes("generateContent"))throw new CoalMeterVisionError("Model đã cấu hình không hỗ trợ generateContent để đọc ảnh. Chọn model Gemini phù hợp.",422);
  return {model,message:"Google đã chấp nhận khóa và trả thông tin model. Chưa kiểm tra hạn mức đọc ảnh; vẫn cần thử Đọc lại với ảnh công tơ."};
}

export async function readCoalMeterGemini(image: {data:string;mediaType:string}, key:string, model:string, call:typeof fetch=fetch) {
  if(!/^[a-zA-Z0-9.-]+$/.test(model)) throw new CoalMeterVisionError("Cấu hình GEMINI_VISION_MODEL không hợp lệ.",503);
  let response: Response;
  try {
  response=await call(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,{
    method:"POST", headers:{"Content-Type":"application/json","x-goog-api-key":key}, signal:AbortSignal.timeout(45000),
    body:JSON.stringify({systemInstruction:{parts:[{text:COAL_METER_SYSTEM_PROMPT}]},contents:[{role:"user",parts:[{inlineData:{mimeType:image.mediaType,data:image.data}},{text:"Read the cumulative coal total in metric tonnes, not the hourly flow. Return only JSON with screen_type, meter_label, total_display, total_unit, photo_timestamp, confidence, note. screen_type: led_total, touch_material_total, no_total_visible or not_a_meter. confidence: high, medium or low. Missing strings must be null except note. Never infer an unreadable label or digit."}]}],generationConfig:{temperature:0,responseMimeType:"application/json",maxOutputTokens:4096}}),
  });
  } catch (error) {
    const timedOut = error instanceof Error && ["TimeoutError", "AbortError"].includes(error.name);
    throw new CoalMeterVisionError(timedOut
      ? "Gemini chưa phản hồi sau 45 giây. Ảnh vẫn ở đây; bấm Đọc lại hoặc thay ảnh rõ hơn."
      : "Không kết nối được Google Gemini. Ảnh vẫn ở đây; kiểm tra kết nối và bấm Đọc lại.", timedOut ? 504 : 502);
  }
  if (!response.ok) throw await coalGeminiHttpError(response);
  let body: {candidates?:{finishReason?:string;content?:{parts?:{text?:string;thought?:boolean}[]}}[]};
  try { body = await response.json(); }
  catch { throw new CoalMeterVisionError("Gemini trả phản hồi bị ngắt hoặc không hợp lệ. Bấm Đọc lại; chưa có số liệu nào được điền.",502); }
  const candidate=body.candidates?.[0];
  if(candidate?.finishReason!=="STOP") throw new CoalMeterVisionError("Gemini chưa đọc xong hoặc từ chối ảnh này.",422);
  const text=candidate.content?.parts?.filter(part=>!part.thought&&typeof part.text==="string").map(part=>part.text).join("")||"";
  let result;
  try {result=CoalMeterReadingSchema.parse(JSON.parse(text));} catch {throw new CoalMeterVisionError("Gemini trả kết quả không hợp lệ; chưa điền vào bảng.",502);}
  if(result.total_unit && !/^(t|ton|tons|tonne|tonnes|mtons|metric tons|tấn)$/i.test(result.total_unit.trim())) throw new CoalMeterVisionError("Đơn vị trong ảnh không phải tấn. Hãy đối chiếu thủ công.",422);
  if(!result.total_unit) {result.confidence="low"; result.note="Không đọc rõ đơn vị tấn; phải đối chiếu ảnh. "+result.note;}
  return result;
}
