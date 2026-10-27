import type { Permission } from "./session.ts";

export const PERMISSION_MODULES: { permission: Permission; label: string; scopes: Permission[] }[] = [
  { permission: "manage_users", label: "Quản trị", scopes: [] },
  { permission: "edit_monthly_kpi", label: "Chỉ tiêu tháng", scopes: [] },
  { permission: "edit_daily_inputs", label: "Số liệu ngày", scopes: [] },
  { permission: "edit_ctktkt", label: "Báo cáo KTKT", scopes: ["ctktkt_kpi_summary", "ctktkt_tkd_trend", "ctktkt_tpd_tcd_power", "ctktkt_lo_pho_oil", "ctktkt_may_nghien_coal_s1", "ctktkt_may_nghien_coal_s2", "ctktkt_steam_flow", "ctktkt_nh3_tank", "ctktkt_nh3_dcs", "ctktkt_td21", "ctktkt_startup_shutdown", "ctktkt_coal_blend_pmis", "ctktkt_pmis_reports"] },
  { permission: "edit_ppa", label: "SHN PPA", scopes: [] },
  { permission: "edit_pmis", label: "PMIS", scopes: [] },
  { permission: "edit_bcsx", label: "BCSX", scopes: [] },
  { permission: "edit_water", label: "Nước", scopes: ["water_meta", "water_electricity", "water_water_intake", "water_resin_water"] },
  { permission: "edit_chemical", label: "Hóa chất", scopes: ["chemical_PAC_LIQUID", "chemical_NAOCL", "chemical_NH4OH_20", "chemical_HCL_31", "chemical_NAOH_31"] },
  { permission: "sync_qlkt", label: "ĐB QLKT", scopes: [] },
  { permission: "sync_google_sheet", label: "G-Sheet", scopes: [] },
];
