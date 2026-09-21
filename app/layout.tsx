import type { Metadata } from "next";
import { SpreadsheetInputBehavior } from "@/components/spreadsheet-input-behavior";
import "./globals.css";

export const metadata: Metadata = {
  title: "Quản lý chỉ tiêu KTKT PXVH1",
  description: "Nhập số liệu vận hành, tự tính chỉ tiêu và cảnh báo vượt định mức.",
  other: {
    "codex-preview": "development",
  },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="vi">
      <body className="antialiased">
        <SpreadsheetInputBehavior />
        {children}
      </body>
    </html>
  );
}
