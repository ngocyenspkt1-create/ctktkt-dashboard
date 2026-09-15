// Tải thư viện SheetJS (đọc/ghi Excel) từ CDN ngay trên trình duyệt khi cần,
// dùng chung cho cả xuất Excel (dashboard) và nhập nhiều ngày từ Excel (bulk import).
// Không thêm vào package.json vì không có kênh chạy npm install trên máy.
export type SheetJsLib = {
  read: (data: ArrayBuffer, opts?: Record<string, unknown>) => { SheetNames: string[]; Sheets: Record<string, unknown> };
  utils: {
    json_to_sheet: (data: Record<string, unknown>[]) => unknown;
    aoa_to_sheet: (data: (string | number | null | undefined)[][]) => unknown;
    book_new: () => unknown;
    book_append_sheet: (workbook: unknown, worksheet: unknown, name: string) => void;
    sheet_to_csv: (worksheet: unknown) => string;
  };
  writeFile: (workbook: unknown, filename: string) => void;
};

let sheetJsPromise: Promise<SheetJsLib> | null = null;

export function loadSheetJs(): Promise<SheetJsLib> {
  if (typeof window === "undefined") return Promise.reject(new Error("Chỉ dùng được trên trình duyệt."));
  const w = window as unknown as { XLSX?: SheetJsLib };
  if (w.XLSX) return Promise.resolve(w.XLSX);
  if (!sheetJsPromise) {
    sheetJsPromise = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = "https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js";
      script.async = true;
      script.onload = () => { const lib = (window as unknown as { XLSX?: SheetJsLib }).XLSX; if (lib) resolve(lib); else reject(new Error("Không tải được thư viện xử lý Excel.")); };
      script.onerror = () => { sheetJsPromise = null; reject(new Error("Không tải được thư viện xử lý Excel (kiểm tra kết nối mạng).")); };
      document.head.appendChild(script);
    });
  }
  return sheetJsPromise;
}
