import { getRawDb } from "@/db";
import { CTKTKT_LINKED_DAILY_CODES } from "@/lib/daily-source-links";
import { requireEditor } from "@/lib/auth/server";

const allowedCodes = new Set(["B","C","D","E","F","G","H","I","J","K","L","M","N","O","P","Q","R","S","T","U","V","W","X","Y","Z","AA","AE","AF","AG","AH","AJ","AK","AR","AT","CJ","CX","BN","BO","BP","BQ","BR","BS","BT","BU","BV","BW","BX","BY","CN","BZ","CA","CC","CD","CE","CF","CM","CQ","CR","CS","CT","CU","CV","CW","DA","DB","DC","DD","DE","DF","DG","DH","BCSX_COAL_STOCK_24H"]);
const periodPattern = /^(19|20|21)\d{2}-(0[1-9]|1[0-2])$/;
const datePattern = /^(19|20|21)\d{2}-(0[1-9]|1[0-2])-([0-2]\d|3[01])$/;
const unavailable = () => Response.json({ error: "Chưa truy cập được kho dữ liệu. Nội dung trên màn hình vẫn được giữ để bạn thử lưu lại." }, { status: 503 });

export async function GET(request: Request) {
  const period = new URL(request.url).searchParams.get("period") || "";
  if (!periodPattern.test(period)) return Response.json({ error: "Tháng theo dõi không hợp lệ." }, { status: 400 });
  const [year, month] = period.split("-").map(Number); const next = month === 12 ? `${year + 1}-01` : `${year}-${String(month + 1).padStart(2, "0")}`;
  try { const { results } = await getRawDb().prepare("SELECT operating_date AS operatingDate, field_code AS fieldCode, value, note FROM daily_inputs WHERE operating_date >= ? AND operating_date < ? ORDER BY operating_date, field_code").bind(`${period}-01`, `${next}-01`).all(); return Response.json({ entries: results }, { headers: { "Cache-Control": "no-store" } }); }
  catch { return unavailable(); }
}

export async function POST(request: Request) {
  const guard = await requireEditor(); if (!guard.ok) return guard.response;
  const origin = request.headers.get("origin"); if (origin && origin !== new URL(request.url).origin) return Response.json({ error: "Nguồn yêu cầu không hợp lệ." }, { status: 403 });
  if (!request.headers.get("content-type")?.includes("application/json")) return Response.json({ error: "Yêu cầu phải là JSON." }, { status: 415 });
  try { const raw = await request.text(); if (raw.length > 250_000) return Response.json({ error: "Dữ liệu gửi lên quá lớn." }, { status: 413 });
    const body = JSON.parse(raw) as { period?: unknown; entries?: unknown }; if (typeof body.period !== "string" || !periodPattern.test(body.period) || !Array.isArray(body.entries) || body.entries.length > 1100) throw new Error("Dữ liệu tháng không hợp lệ.");
    const clean = body.entries.map(item => { if (!item || typeof item !== "object") throw new Error("Một ô dữ liệu không hợp lệ."); const e=item as Record<string,unknown>, operatingDate=String(e.operatingDate||""), fieldCode=String(e.fieldCode||""), value=String(e.value??"").trim(), note=String(e.note??"").trim();
      if (!datePattern.test(operatingDate) || !operatingDate.startsWith(`${body.period}-`) || !allowedCodes.has(fieldCode)) throw new Error("Ngày hoặc mã chỉ tiêu không hợp lệ."); if (CTKTKT_LINKED_DAILY_CODES.has(fieldCode)) throw new Error(`Chỉ tiêu ${fieldCode} tự liên kết từ Chỉ tiêu KTKT, không được nhập hoặc đồng bộ lần hai.`); if (value.length>100 || note.length>500) throw new Error("Giá trị hoặc ghi chú quá dài."); const isNumeric=/^-?\d+(?:[.,]\d+)?$/.test(value), isNoAdjustment=fieldCode==="CX"&&value.toLocaleLowerCase("vi")==="không chỉnh"; if(fieldCode!=="CW"&&value!==""&&!isNumeric&&!isNoAdjustment) throw new Error(`Giá trị ${fieldCode} phải là số hoặc trạng thái được hỗ trợ.`); return {operatingDate,fieldCode,value:value.replace(",","."),note}; });
    const db=getRawDb(); const statements=clean.map(e=>e.value===""&&e.note===""?db.prepare("DELETE FROM daily_inputs WHERE operating_date = ? AND field_code = ?").bind(e.operatingDate,e.fieldCode):db.prepare("INSERT INTO daily_inputs (operating_date, field_code, value, note, updated_at) VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP) ON CONFLICT(operating_date, field_code) DO UPDATE SET value = excluded.value, note = excluded.note, updated_at = CURRENT_TIMESTAMP").bind(e.operatingDate,e.fieldCode,e.value,e.note)); if(statements.length)await db.batch(statements); return Response.json({saved:clean.length});
  } catch(error) { return Response.json({error:error instanceof SyntaxError?"Dữ liệu JSON không hợp lệ.":error instanceof Error?error.message:"Dữ liệu không hợp lệ."},{status:400}); }
}
