"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { Menu, Search } from "lucide-react";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { visibleGroups, type NavItem } from "@/lib/navigation";

function normalize(text: string) {
  return text.toLocaleLowerCase("vi-VN").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/g, "d");
}

function NavList({ active, isAdmin, onNavigate }: { active: string; isAdmin: boolean; onNavigate?: () => void }) {
  return (
    <nav aria-label="Chức năng" className="flex flex-col gap-5">
      {visibleGroups(isAdmin).map(group => (
        <div key={group.title}>
          <p className="px-3 pb-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400">{group.title}</p>
          <ul className="flex flex-col gap-0.5">
            {group.items.map(item => {
              const selected = item.key === active;
              const Icon = item.icon;
              return (
                <li key={item.key}>
                  <Link
                    href={item.href}
                    onClick={onNavigate}
                    aria-current={selected ? "page" : undefined}
                    className={`group flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                      selected ? "bg-indigo-50 text-indigo-700" : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                    }`}
                  >
                    <Icon className={`size-[18px] shrink-0 ${selected ? "text-indigo-600" : "text-slate-400 group-hover:text-slate-600"}`} aria-hidden />
                    <span className="truncate">{item.label}</span>
                    {selected && <span className="ml-auto h-1.5 w-1.5 rounded-full bg-indigo-500" aria-hidden />}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}

export function SidebarNav({ active, isAdmin }: { active: string; isAdmin: boolean }) {
  return <NavList active={active} isAdmin={isAdmin} />;
}

export function MobileNav({ active, isAdmin, brand }: { active: string; isAdmin: boolean; brand: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <button type="button" aria-label="Mở danh mục chức năng" className="grid size-9 place-items-center rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 lg:hidden">
          <Menu className="size-5" aria-hidden />
        </button>
      </SheetTrigger>
      <SheetContent side="left" className="w-72 gap-0 bg-white p-0">
        <SheetTitle className="sr-only">Danh mục chức năng</SheetTitle>
        <div className="border-b border-slate-100 p-4">{brand}</div>
        <div className="flex-1 overflow-y-auto p-3">
          <NavList active={active} isAdmin={isAdmin} onNavigate={() => setOpen(false)} />
        </div>
      </SheetContent>
    </Sheet>
  );
}

/** Jump to a function by name; Ctrl+K focuses the box. */
export function QuickSearch({ isAdmin }: { isAdmin: boolean }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const items = useMemo(() => visibleGroups(isAdmin).flatMap(group => group.items), [isAdmin]);
  const results = useMemo(() => {
    const q = normalize(query.trim());
    if (!q) return items;
    return items.filter(item => normalize(`${item.label} ${item.description} ${item.keywords}`).includes(q));
  }, [items, query]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const go = (item: NavItem | undefined) => {
    if (!item) return;
    setOpen(false);
    setQuery("");
    inputRef.current?.blur();
    router.push(item.href);
  };

  return (
    <div className="relative hidden w-72 md:block">
      <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-400" aria-hidden />
      <input
        ref={inputRef}
        value={query}
        onChange={event => { setQuery(event.target.value); setHighlight(0); setOpen(true); }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 120)}
        onKeyDown={event => {
          if (event.key === "ArrowDown") { event.preventDefault(); setHighlight(index => Math.min(index + 1, results.length - 1)); }
          else if (event.key === "ArrowUp") { event.preventDefault(); setHighlight(index => Math.max(index - 1, 0)); }
          else if (event.key === "Enter") { event.preventDefault(); go(results[highlight]); }
          else if (event.key === "Escape") { setOpen(false); inputRef.current?.blur(); }
        }}
        role="combobox"
        aria-expanded={open}
        aria-controls="quick-search-results"
        aria-label="Tìm nhanh chức năng"
        placeholder="Tìm chức năng…"
        className="h-9 w-full rounded-lg border border-slate-200 bg-slate-50 pr-12 pl-9 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-indigo-300 focus:bg-white focus:ring-2 focus:ring-indigo-100"
      />
      <kbd className="pointer-events-none absolute top-1/2 right-2.5 -translate-y-1/2 rounded border border-slate-200 bg-white px-1.5 text-[10px] font-medium text-slate-400">Ctrl K</kbd>
      {open && (
        <ul id="quick-search-results" role="listbox" className="absolute top-11 right-0 left-0 z-40 max-h-80 overflow-y-auto rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl">
          {results.length === 0 && <li className="px-3 py-2 text-sm text-slate-400">Không tìm thấy chức năng phù hợp</li>}
          {results.map((item, index) => {
            const Icon = item.icon;
            return (
              <li key={item.key} role="option" aria-selected={index === highlight}>
                <button
                  type="button"
                  onMouseDown={event => { event.preventDefault(); go(item); }}
                  onMouseEnter={() => setHighlight(index)}
                  className={`flex w-full items-start gap-3 rounded-lg px-3 py-2 text-left ${index === highlight ? "bg-indigo-50" : ""}`}
                >
                  <Icon className="mt-0.5 size-4 shrink-0 text-indigo-500" aria-hidden />
                  <span>
                    <span className="block text-sm font-medium text-slate-900">{item.label}</span>
                    <span className="block text-xs text-slate-500">{item.description}</span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
