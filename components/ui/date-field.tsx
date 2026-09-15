"use client";

import { CalendarIcon } from "lucide-react";
import { vi } from "date-fns/locale";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

// Ô chọn ngày hiển thị đúng định dạng dd/mm/yyyy (thay cho <input type="date"> mặc định của
// trình duyệt, vốn hiển thị theo ngôn ngữ hệ điều hành — có máy ra mm/dd/yyyy). Giá trị vào/ra
// vẫn giữ dạng chuỗi "yyyy-mm-dd" để tương thích với state và API hiện có, không cần đổi logic
// nơi khác.
const pad = (value: number) => String(value).padStart(2, "0");

function parseIso(iso?: string): Date | undefined {
  if (!iso) return undefined;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!match) return undefined;
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return Number.isNaN(date.getTime()) ? undefined : date;
}

function toIso(date: Date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function formatDisplay(date: Date) {
  return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()}`;
}

export type DateFieldProps = {
  value: string;
  onChange: (value: string) => void;
  min?: string;
  max?: string;
  className?: string;
  placeholder?: string;
  disabled?: boolean;
};

export function DateField({ value, onChange, min, max, className, placeholder = "dd/mm/yyyy", disabled }: DateFieldProps) {
  const [open, setOpen] = useState(false);
  const selected = parseIso(value);
  const minDate = parseIso(min);
  const maxDate = parseIso(max);

  return <Popover open={open} onOpenChange={setOpen}>
    <PopoverTrigger asChild>
      <Button
        type="button"
        variant="outline"
        disabled={disabled}
        className={cn("h-10 w-full justify-start gap-2 rounded-xl border-slate-200 bg-white px-3 text-sm font-normal text-black shadow-sm hover:bg-white", !selected && "text-slate-400", className)}
      >
        <CalendarIcon className="size-4 shrink-0 text-slate-400"/>
        {selected ? formatDisplay(selected) : placeholder}
      </Button>
    </PopoverTrigger>
    <PopoverContent className="w-auto p-0" align="start">
      <Calendar
        mode="single"
        locale={vi}
        selected={selected}
        defaultMonth={selected}
        disabled={date => (minDate ? date < minDate : false) || (maxDate ? date > maxDate : false)}
        onSelect={date => { if (date) { onChange(toIso(date)); setOpen(false); } }}
      />
    </PopoverContent>
  </Popover>;
}
