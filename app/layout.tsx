import type { Metadata } from "next";
import "./interface.css";
import "./engineering-workspace.css";
import "./dark-theme.css";

export const metadata: Metadata = {
  title: "Quản lý chỉ tiêu KTKT PXVH1",
  description: "Nhập số liệu vận hành, tự tính chỉ tiêu và cảnh báo vượt định mức.",
  other: {
    "codex-preview": "development",
  },
  icons: {
    icon: { url: "/evn-logo.png", type: "image/png" },
    shortcut: "/evn-logo.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="vi" suppressHydrationWarning>
      <head><script dangerouslySetInnerHTML={{ __html: 'try{document.documentElement.dataset.theme=localStorage.getItem("qlkt-theme")==="dark"?"dark":"light"}catch{}' }} /></head>
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}
