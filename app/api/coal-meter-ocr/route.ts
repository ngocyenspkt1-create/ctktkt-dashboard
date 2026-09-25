import Anthropic from "@anthropic-ai/sdk";
import { getSessionUser } from "@/lib/auth/server";
import { canEditCtktktGroup } from "@/lib/ctktkt-permissions";
import { CoalMeterVisionError, readCoalMeterPhoto } from "@/lib/coal-meter-vision";

// Reading one photo with the vision model usually takes a few seconds, occasionally longer.
export const maxDuration = 60;

const MAX_BASE64_LENGTH = 5_000_000;
const MEDIA_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

let client: Anthropic | null = null;

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) return Response.json({ error: "Chưa đăng nhập." }, { status: 401 });
  if (!canEditCtktktGroup(user, "may_nghien_coal_s1") && !canEditCtktktGroup(user, "may_nghien_coal_s2")) {
    return Response.json({ error: "Tài khoản của bạn không có quyền nhập công tơ than." }, { status: 403 });
  }
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) return Response.json({ error: "Nguồn yêu cầu không hợp lệ." }, { status: 403 });
  if (!process.env.ANTHROPIC_API_KEY) {
    return Response.json({ error: "Chưa cấu hình ANTHROPIC_API_KEY trên máy chủ nên chưa đọc được ảnh bằng AI." }, { status: 503 });
  }

  const body = await request.json().catch(() => null) as { data?: unknown; mediaType?: unknown } | null;
  const data = typeof body?.data === "string" ? body.data : "";
  const mediaType = typeof body?.mediaType === "string" ? body.mediaType : "";
  if (!data || !MEDIA_TYPES.has(mediaType)) return Response.json({ error: "Ảnh không hợp lệ." }, { status: 400 });
  if (data.length > MAX_BASE64_LENGTH) return Response.json({ error: "Ảnh quá lớn." }, { status: 413 });

  client ??= new Anthropic();
  try {
    const reading = await readCoalMeterPhoto(client, { data, mediaType: mediaType as "image/jpeg" | "image/png" | "image/webp" });
    return Response.json({ reading });
  } catch (error) {
    if (error instanceof CoalMeterVisionError) return Response.json({ error: error.message }, { status: error.status });
    if (error instanceof Anthropic.RateLimitError) return Response.json({ error: "Dịch vụ AI đang quá tải, hãy thử lại sau ít phút." }, { status: 429 });
    if (error instanceof Anthropic.AuthenticationError) return Response.json({ error: "Khóa ANTHROPIC_API_KEY không hợp lệ." }, { status: 503 });
    if (error instanceof Anthropic.APIError) {
      console.error("Coal meter vision API error", error.status, error.message);
      return Response.json({ error: "Dịch vụ AI tạm thời không đọc được ảnh." }, { status: 502 });
    }
    console.error("Coal meter vision failed", error);
    return Response.json({ error: "Không đọc được ảnh." }, { status: 500 });
  }
}
