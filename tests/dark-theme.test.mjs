import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

function luminance(hex) {
  const channels = hex.match(/[a-f\d]{2}/gi).map(v => parseInt(v,16)/255).map(v => v <= .04045 ? v/12.92 : ((v+.055)/1.055)**2.4);
  return channels[0]*.2126 + channels[1]*.7152 + channels[2]*.0722;
}
test("workshop dark text, muted text, links and statuses meet normal text contrast", () => {
  for (const [fg,bg] of [["e6edf5","15212b"],["b8c9d9","15212b"],["91c5ff","15212b"],["e6edf5","254353"],["b2d8ff","183e63"],["ddc7ff","392d57"],["a4edc6","183e32"],["ffdc91","453a21"],["ffb5be","492d35"]]) {
    const a=luminance(fg), b=luminance(bg);
    assert.ok((Math.max(a,b)+.05)/(Math.min(a,b)+.05) >= 4.5, `${fg} on ${bg}`);
  }
});
test("dark workshop overrides are scoped and slider exposes switch state", () => {
  const css=readFileSync(new URL("../app/dark-theme.css",import.meta.url),"utf8");
  assert.match(css,/html\[data-theme="dark"\] \.wp :is\(\.wp-title,\.wp-task-description/);
  assert.match(css,/html\[data-theme="dark"\] \.wp :is\(\.wp-primary-name,\.wp-link/);
  const toggle=readFileSync(new URL("../components/theme-toggle.tsx",import.meta.url),"utf8");
  assert.match(toggle,/role="switch" aria-checked=\{dark\}/);
  assert.match(toggle,/theme-slide-thumb/);
});

test("PMIS toolbar and legacy black date text have dark overrides", () => {
  const css=readFileSync(new URL("../app/dark-theme.css",import.meta.url),"utf8");
  assert.match(css,/html\[data-theme="dark"\] :is\(\.pmis-chart-toolbar,\.pmis-trend-panel\)/);
  assert.match(css,/html\[data-theme="dark"\] \[class~="text-black"\] \{ color:#e6edf5 !important;/);
});

test("KTKT banner and date trigger have explicit dark hooks", () => {
  const css=readFileSync(new URL("../app/dark-theme.css",import.meta.url),"utf8");
  const date=readFileSync(new URL("../components/ui/date-field.tsx",import.meta.url),"utf8");
  const report=readFileSync(new URL("../components/ctktkt-report.tsx",import.meta.url),"utf8");
  assert.ok(date.includes("qlkt-date-field"));
  assert.ok(report.includes("ktkt-role-banner"));
  assert.match(css,/html\[data-theme="dark"\] \.qlkt-date-field \{[^}]*-webkit-text-fill-color:#e6edf5 !important/);
  assert.ok(css.includes('.ktkt-workspace .ktkt-role-banner'));
});

test("report surfaces, captions, table sections and tooltip have dark guards", () => {
  const css=readFileSync(new URL("../app/dark-theme.css",import.meta.url),"utf8");
  for (const selector of [".module-section-heading", ".pmis-table-scroll tbody tr>td[colspan]", ".monthly-stat:nth-child(n)", ".ppa-day-counts b", ".ppa-range-presets button", ".recharts-default-tooltip", '[class~="text-black"]']) {
    assert.ok(css.includes(selector), selector);
  }
  for (const [fg,bg] of [["c4deef","203b49"],["d8eeff","244b63"],["b8c9d9","24333c"],["a2e4e7","173e43"],["c6d6ff","283751"],["ffd0a0","453321"]]) {
    assert.ok((luminance(fg)+.05)/(luminance(bg)+.05)>=4.5, `${fg} on ${bg}`);
  }
});
