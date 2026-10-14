"use client";

import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";

const key = "qlkt-theme";
export function ThemeToggle() {
  const [dark, setDark] = useState(false);
  useEffect(() => {
    const sync = () => setDark(document.documentElement.dataset.theme === "dark");
    sync();
    const onStorage = (event: StorageEvent) => {
      if (event.key !== key) return;
      document.documentElement.dataset.theme = event.newValue === "dark" ? "dark" : "light";
      sync();
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);
  function toggle() {
    const next = !dark;
    document.documentElement.dataset.theme = next ? "dark" : "light";
    setDark(next);
    try { localStorage.setItem(key, next ? "dark" : "light"); } catch { /* storage unavailable */ }
  }
  return <button type="button" className="theme-toggle" onClick={toggle} aria-pressed={dark} aria-label="Chế độ tối" title={dark ? "Chuyển sang chế độ sáng" : "Chuyển sang chế độ tối"}>
    {dark ? <Sun size={17} aria-hidden /> : <Moon size={17} aria-hidden />}<span className="hidden sm:inline">{dark ? "Sáng" : "Tối"}</span>
  </button>;
}
