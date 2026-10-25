import { CoalMeterReadingSchema, CoalMeterVisionError, COAL_METER_SYSTEM_PROMPT } from "./coal-meter-vision.ts";

export async function coalGeminiHttpError(response: Response) {
  // Only enumerated reasons are used. Provider messages may echo credentials.
  const failure = await response.json().catch(() => null) as {error?:{details?:{reason?:string}[]}} | null;
  const reasons = Array.isArray(failure?.error?.details) ? failure.error.details.map(item=>item?.reason) : [];
  const knownReasons = new Set(["API_KEY_INVALID","API_KEY_EXPIRED","ACCESS_TOKEN_TYPE_UNSUPPORTED","API_KEY_SERVICE_BLOCKED","API_KEY_HTTP_REFERRER_BLOCKED","API_KEY_IP_ADDRESS_BLOCKED","CREDENTIALS_MISSING","SERVICE_DISABLED","ACCESS_TOKEN_SCOPE_INSUFFICIENT"]);
  const safeReason = reasons.find(reason=>typeof reason==="string"&&knownReasons.has(reason));
  const message = reasons.some(reason=>reason==="API_KEY_INVALID"||reason==="API_KEY_EXPIRED")
    ? "Khóa Gemini không hợp lệ hoặc đã hết hiệu lực. Mở Cấu hình Gemini để nhập lại khóa, rồi kiểm tra kết nối."
    : response.status===401
    ? "Google không xác thực được khóa cho yêu cầu này. Kiểm tra hoặc thay khóa trong Google AI Studio. Đây là lỗi xác thực, chưa phải lỗi chất lượng ảnh."
    : response.status===403
    ? "Google từ chối quyền truy cập. Kiểm tra quyền của khóa, giới hạn API và dự án Google AI Studio."
    : response.status===404
    ? "Không tìm thấy model Gemini hoặc khóa chưa được cấp quyền dùng model này. Kiểm tra model trong Cấu hình Gemini."
    : response.status===429
    ? "Gemini đã hết hạn mức hoặc đang quá tải. Chờ rồi bấm Đọc lại; gửi lại ngay có thể vẫn lỗi."
    : response.status===400
    ? "Google không chấp nhận yêu cầu hoặc cấu hình Gemini. Kiểm tra khóa và model; phản hồi này chưa kết luận ảnh khó đọc."
    : "Google Gemini đang gặp lỗi dịch vụ. Giữ ảnh và thử lại sau.";
  return new CoalMeterVisionError(`${message} (Google HTTP ${response.status}${safeReason?` · ${safeReason}`:""})`,response.status===429?429:502);
}

/** Checks credentials/model metadata independently of image quality, without generation. */
export async function checkCoalGeminiConnection(key:string,model:string,call:typeof fetch=fetch) {
  if(!/^gemini-[A-Za-z0-9.-]{1,100}$/.test(model)) throw new CoalMeterVisionError("Tên model Gemini không hợp lệ.",400);
  let response:Response;
  try {
    // A model's public metadata alone does not prove this key can authenticate.
    // Check the catalog with the key, still without billing an OCR generation.
    response=await call("https://generativelanguage.googleapis.com/v1beta/models?pageSize=1000",{
      method:"GET",headers:{"x-goog-api-key":key},signal:AbortSignal.timeout(12000),cache:"no-store",
    });
  } catch {
    throw new CoalMeterVisionError("Chưa kết nối được Google để kiểm tra khóa/model trong 12 giây. Chưa gửi ảnh hoặc chạy đọc số.",504);
  }
  if(!response.ok)throw await coalGeminiHttpError(response);
  const result=await response.json().catch(()=>null) as {models?:{name?:unknown;supportedGenerationMethods?:unknown}[];nextPageToken?:unknown}|null;
  if(!Array.isArray(result?.models))throw new CoalMeterVisionError("Google trả danh sách model không hợp lệ. Chưa thể xác nhận kết nối.",502);
  const selected=result.models.find(item=>item?.name===`models/${model}`);
  if(!selected)throw new CoalMeterVisionError(result.nextPageToken?"Danh sách model chưa đầy đủ, chưa thể xác nhận model đã chọn.":"Model đã cấu hình không có trong danh sách Google trả cho khóa này. Kiểm tra lại model trong Google AI Studio.",422);
  if(!Array.isArray(selected.supportedGenerationMethods)||!selected.supportedGenerationMethods.includes("generateContent"))throw new CoalMeterVisionError("Model đã cấu hình không hỗ trợ generateContent để đọc ảnh. Chọn model Gemini phù hợp.",422);
  return {model,message:"Đã truy cập danh sách model Google và tìm thấy model đã cấu hình. Chưa kiểm tra quyền gọi generateContent hoặc hạn mức đọc ảnh; vẫn cần thử Đọc lại với ảnh công tơ."};
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
