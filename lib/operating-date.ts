const VN_TIME_ZONE = "Asia/Ho_Chi_Minh";

export function vietnamDateIso(date = new Date()) {
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: VN_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

export function addDaysIso(iso: string, days: number) {
  const date = new Date(`${iso}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

// Số liệu vận hành chỉ hoàn tất sau khi kết thúc ngày, vì vậy mọi màn hình
// nhập/đồng bộ theo ngày đều mặc định mở ngày D-1 theo múi giờ Việt Nam.
export function defaultOperatingDate(date = new Date()) {
  return addDaysIso(vietnamDateIso(date), -1);
}
