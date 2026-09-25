import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod/v4";

export const COAL_METER_VISION_MODEL = "claude-opus-5";

export const CoalMeterReadingSchema = z.object({
  screen_type: z.enum(["led_total", "touch_material_total", "no_total_visible", "not_a_meter"]),
  meter_label: z.string().nullable(),
  total_display: z.string().nullable(),
  total_unit: z.string().nullable(),
  photo_timestamp: z.string().nullable(),
  confidence: z.enum(["high", "medium", "low"]),
  note: z.string(),
});

export type CoalMeterReading = z.infer<typeof CoalMeterReadingSchema>;

const SYSTEM_PROMPT = `You read photos of coal feeder weighing meters at a power plant so the cumulative total can be recorded. A shift leader checks every result against the photo, so report exactly what is visible and never guess.

Two kinds of controllers appear:
- An older controller with a green dot-matrix (LED/VFD) display. The first line reads "Total:" or "Material Total:" followed by the cumulative value, e.g. "Total: 75859.247 MTons". The second line is a rate ("0.00 MTons/hr") - ignore it.
- A Schenck touch screen. Its title bar shows the feeder code (e.g. "1B2") and a table lists "Material Total" with the cumulative value, e.g. "14589.570 t". Setpoint, Feedrate, Speed and Belt Load are not the total.
If the screen shows another page (network settings, menus) and no cumulative total, use screen_type "no_total_visible".

Fields:
- total_display: the cumulative total copied digit for digit, with its decimal point and every decimal shown (e.g. "75859.247"). No thousands separators, no unit. null if not fully legible.
- meter_label: the feeder code written on the panel, a sticker ("CÔNG TƠ MC 1C2") or the touch-screen title, normalised to unit digit + letter + digit, e.g. "1E2" or "2A1". null if none is legible.
- total_unit: the unit shown after the total ("MTons", "t"), or null.
- photo_timestamp: the date and time stamped on the photo (usually top right, e.g. "25 Sep 2026 at 15:58:46") as "YYYY-MM-DD HH:MM", or null.
- confidence: "high" only when every digit of the total is sharp; "low" when glare, blur or reflections make any digit uncertain.
- note: one short sentence in Vietnamese about anything that needs the shift leader's attention (glare, digits partly hidden, wrong page), or an empty string.`;

export class CoalMeterVisionError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export async function readCoalMeterPhoto(
  client: Anthropic,
  image: { data: string; mediaType: "image/jpeg" | "image/png" | "image/webp" },
): Promise<CoalMeterReading> {
  const response = await client.beta.messages.parse({
    model: COAL_METER_VISION_MODEL,
    max_tokens: 16000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    system: SYSTEM_PROMPT,
    output_config: { effort: "medium", format: betaZodOutputFormat(CoalMeterReadingSchema) },
    messages: [
      {
        role: "user",
        content: [
          { type: "image", source: { type: "base64", media_type: image.mediaType, data: image.data } },
          { type: "text", text: "Read this coal feeder meter photo." },
        ],
      },
    ],
  });

  if (response.stop_reason === "refusal") throw new CoalMeterVisionError("Dịch vụ AI từ chối đọc ảnh này.", 422);
  if (response.stop_reason === "max_tokens") throw new CoalMeterVisionError("Kết quả đọc ảnh bị cắt ngắn, hãy thử lại.", 502);
  if (!response.parsed_output) throw new CoalMeterVisionError("Không nhận được kết quả đọc ảnh hợp lệ.", 502);
  return response.parsed_output;
}
