import { isAdminUser, type SessionUser } from "../auth/session.ts";

export const CHEMICAL_CATALOG = [
  {
    code: "PAC_LIQUID",
    materialCode: "1.61.86.566.VIE.00.000",
    name: "PAC lỏng",
    unit: "Tấn",
    allowedPositions: ["XLN hỗn hợp"],
  },
  {
    code: "NAOCL",
    materialCode: "1.61.26.003.VIE.00.000",
    name: "NaOCl",
    unit: "Tấn",
    allowedPositions: ["XLN hỗn hợp"],
  },
  {
    code: "NH4OH_20",
    materialCode: "1.61.86.518.VIE.00.000",
    name: "NH₄OH 20%",
    unit: "Tấn",
    allowedPositions: ["Máy phó"],
  },
  {
    code: "HCL_31",
    materialCode: "1.61.06.038.VIE.00.000",
    name: "HCl 31%",
    unit: "Tấn",
    allowedPositions: ["Trợ thủ", "Máy phó", "XLN hỗn hợp", "XLNT"],
  },
  {
    code: "NAOH_31",
    materialCode: "1.61.16.008.VIE.00.000",
    name: "NaOH 31%",
    unit: "Tấn",
    allowedPositions: ["Trợ thủ", "Máy phó", "XLN hỗn hợp", "XLNT"],
  },
] as const;

export type ChemicalCode = (typeof CHEMICAL_CATALOG)[number]["code"];
export type ChemicalCatalogItem = (typeof CHEMICAL_CATALOG)[number];

function normalizePosition(value: string): string {
  return value
    .trim()
    .toLocaleLowerCase("vi-VN")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/\s+/g, " ");
}

export function findChemical(code: string): ChemicalCatalogItem | undefined {
  return CHEMICAL_CATALOG.find(item => item.code === code);
}

export function canEnterChemical(user: SessionUser | null | undefined, chemicalCode: string): boolean {
  if (!user) return false;
  if (isAdminUser(user)) return true;
  const chemical = findChemical(chemicalCode);
  if (!chemical) return false;
  const position = normalizePosition(user.position || "");
  return chemical.allowedPositions.some(allowed => normalizePosition(allowed) === position);
}

export function editableChemicalsFor(user: SessionUser | null | undefined): ChemicalCatalogItem[] {
  return CHEMICAL_CATALOG.filter(item => canEnterChemical(user, item.code));
}
