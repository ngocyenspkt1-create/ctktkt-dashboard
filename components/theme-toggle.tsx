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
  return <button type="button" className="theme-toggle theme-slide" onClick={toggle} role="switch" aria-checked={dark} aria-label="Chế độ tối" title={dark ? "Chuyển sang chế độ sáng" : "Chuyển sang chế độ tối"}>
    <span className="theme-slide-stars" aria-hidden />
    <Moon className="theme-slide-moon" size={15} aria-hidden />
    <Sun className="theme-slide-sun" size={16} aria-hidden />
    <span className="theme-slide-thumb" aria-hidden>{dark ? <Moon size={16} /> : <Sun size={16} />}</span>
  </button>;
}
