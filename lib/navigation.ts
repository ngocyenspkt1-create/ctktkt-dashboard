import {
  BarChart3,
  CalendarRange,
  ClipboardList,
  Droplets,
  FileSpreadsheet,
  Flame,
  ShieldCheck,
  type LucideIcon,
} from "lucide-react";

export type NavKey = "data" | "ctktkt" | "bcsx" | "water" | "ppa" | "pmis" | "admin-users";

export type NavItem = { key: NavKey; href: string; label: string; description: string; icon: LucideIcon; keywords: string };

const NAV_GROUPS: Array<{ title: string; adminOnly?: boolean; items: NavItem[] }> = [
  {
    title: "Số liệu vận hành",
    items: [
      { key: "data", href: "/", label: "Dữ liệu các tháng", description: "Số liệu sản xuất hằng ngày, đồng bộ QLKT", icon: CalendarRange, keywords: "tong quan du lieu thang qlkt dong bo san luong" },
      { key: "ctktkt", href: "/ctktkt-report", label: "Báo cáo Chỉ tiêu KTKT", description: "Nhập liệu theo cương vị, xuất Excel, báo cáo mail", icon: FileSpreadsheet, keywords: "chi tieu ktkt excel mail than dau hoi nuoc nh3" },
      { key: "bcsx", href: "/bcsx-report", label: "Nhập liệu BCSX", description: "48 điểm nửa giờ, sự kiện vận hành, xuất A0/S1/S2", icon: ClipboardList, keywords: "bcsx san xuat su kien lenh dieu do ton kho" },
      { key: "water", href: "/water-report", label: "Theo dõi lượng nước", description: "Công tơ nước theo ca 06h · 14h · 22h", icon: Droplets, keywords: "nuoc demin ca tai sinh hat" },
    ],
  },
  {
    title: "Phân tích",
    items: [
      { key: "ppa", href: "/ppa-heat-rate", label: "Suất hao nhiệt PPA", description: "So sánh SHN PPA và thực tế, đẩy Google Sheet", icon: Flame, keywords: "ppa suat hao nhiet shn google sheet cong suat kha dung" },
      { key: "pmis", href: "/pmis-report", label: "Báo cáo PMIS", description: "Theo dõi chỉ tiêu PMIS S1/S2 theo ngày", icon: BarChart3, keywords: "pmis bieu do ton that khoi" },
    ],
  },
  {
    title: "Hệ thống",
    adminOnly: true,
    items: [
      { key: "admin-users", href: "/admin/users", label: "Quản lý tài khoản", description: "Người dùng, cương vị và phân quyền", icon: ShieldCheck, keywords: "tai khoan nguoi dung phan quyen cuong vi admin" },
    ],
  },
];

export function navItemFor(key: string) {
  return NAV_GROUPS.flatMap(group => group.items).find(item => item.key === key);
}

export function visibleGroups(isAdmin: boolean) {
  return NAV_GROUPS.filter(group => !group.adminOnly || isAdmin);
}
