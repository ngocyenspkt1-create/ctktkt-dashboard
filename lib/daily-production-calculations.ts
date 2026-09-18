export type DailyProductionRow = Record<string, string | undefined>;

function decimal(value?: string) {
  if (!value?.trim()) return null;
  const parsed = Number(value.trim().replace(",", "."));
  return Number.isFinite(parsed) ? parsed : null;
}

function divide(a: number | null, b: number | null, multiplier = 1) {
  return a === null || b === null || b === 0 ? null : a / b * multiplier;
}

/**
 * Calculate the daily KTKT fields from full-precision source values.
 *
 * Source units:
 * - B/C/H/I: million kWh
 * - F/L: hours
 * - AE/AF/BN/BQ/BR: tonnes
 * - AJ: kJ/kg
 *
 * No display rounding is performed here. The UI formats the returned numbers
 * separately, while exports and downstream calculations retain the numbers.
 */
export function calculateDailyProduction(row: DailyProductionRow): Record<string, number | null> {
  const n = (code: string) => decimal(row[code]);
  const B = n("B"), C = n("C"), F = n("F"), H = n("H"), I = n("I"), L = n("L");
  const AE = n("AE"), AF = n("AF"), AJ = n("AJ"), BN = n("BN"), BQ = n("BQ"), BR = n("BR");
  const D = B === null || C === null ? null : (B - C) * 1000;
  const J = H === null || I === null ? null : (H - I) * 1000;
  const N = B === null || H === null ? null : (B + H) * 1000;
  const O = C === null || I === null ? null : (C + I) * 1000;
  const T = AE === null || AF === null ? null : AE + AF;
  const BS = BQ === null || BR === null ? null : BQ + BR;
  const shTho = divide(T, N, 1000);
  const shTinh = divide(T, O, 1000);

  return {
    D, E: divide(D, B, 0.1), G: divide(B, F, 1000),
    J, K: divide(J, H, 0.1), M: divide(H, L, 1000),
    N, O,
    P: N === null || O === null ? null : N - O,
    Q: N === null || O === null ? null : divide(N - O, N, 100),
    R: F === null || L === null ? null : F + L,
    S: N === null || F === null || L === null ? null : divide(N, F + L),
    T,
    U: shTho,
    // QLKT 02-PD defines these two heat-rate indicators from coal and coal
    // HHV only. HFO/DO consumption is tracked separately and is intentionally
    // excluded so the web result remains directly comparable with QLKT.
    V: shTho === null || AJ === null ? null : shTho * AJ / 1000,
    W: shTinh === null || AJ === null ? null : shTinh * AJ / 1000,
    Y: divide(AE, B), Z: divide(AF, H), AA: shTinh,
    AG: divide(AE, C), AH: divide(AF, I),
    AK: AJ === null ? null : AJ / 4.1868,
    BO: divide(BN, N, 1000),
    BP: divide(BN, O === null ? null : O / 1000),
    BS,
    BT: divide(BQ, B), BU: divide(BQ, C),
    BV: divide(BR, H), BW: divide(BR, I),
    BX: divide(BS, B === null || H === null ? null : B + H),
    BY: divide(BS, C === null || I === null ? null : C + I),
  };
}
