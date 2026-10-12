import type { Metadata } from "next";
import "./interface.css";
import "./engineering-workspace.css";
import "./wb-design.css";

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
        {children}
      </body>
    </html>
  );
}
