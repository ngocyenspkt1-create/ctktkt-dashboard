import type { Metadata } from "next";
import "./interface-light.css";
import "./engineering-workspace.css";
import "./compact.css";

export const metadata: Metadata = {
  title: "Quản lý chỉ tiêu KTKT PXVH1",
  description: "Nhập số liệu vận hành, tự tính chỉ tiêu và cảnh báo vượt định mức.",
  other: {
    "codex-preview": "development",
  },
  icons: {
    icon: { url: "/evn-favicon.svg", type: "image/svg+xml" },
    shortcut: "/evn-favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="vi" data-theme="light" style={{colorScheme:"light"}}>
      <head><script dangerouslySetInnerHTML={{ __html: 'try{localStorage.removeItem("qlkt-theme")}catch{}' }} /></head>
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}
