import type { CSSProperties } from "react";
import { buildRatePaths, chartRange } from "@/lib/ppa-chart-layout";
import "./ppa-unit-card.css";

type Point = { date: string; thucTe: number | null; ppa: number | null; chenhLech: number | null };
type Summary = { avgActual: number | null; avgPpa: number | null; avgDiff: number | null; exceeded: number; met: number; total: number };
const number = new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 2, minimumFractionDigits: 2 });
const tick = new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 0 });
const format = (value: number | null) => value === null || !Number.isFinite(value) ? "—" : number.format(value);
const accents = { s1: "#2563eb", s2: "#b77914", plant: "#087f8c" };

export function PpaUnitCard({ unit, summary, points }: { unit: "s1" | "s2" | "plant"; summary: Summary; points: Point[] }) {
  const title = unit === "plant" ? "Toàn nhà máy" : `Tổ máy ${unit.toUpperCase()}`;
  const hasComparison = summary.avgDiff !== null && Number.isFinite(summary.avgDiff);
  const over = hasComparison && summary.avgDiff! > 0;
  const tone = hasComparison ? over ? "over" : "met" : "empty";
  const rateDomain = chartRange(points.flatMap(p => [p.thucTe, p.ppa]), false);
  const diffDomain = chartRange(points.map(p => p.chenhLech), true);
  const left = 54, right = 440, width = right - left;
  const x = (index: number) => left + (points.length < 2 ? width / 2 : index * width / (points.length - 1));
  const rateY = (value: number) => 20 + (rateDomain[1] - value) * 130 / (rateDomain[1] - rateDomain[0]);
  const diffY = (value: number) => 14 + (diffDomain[1] - value) * 78 / (diffDomain[1] - diffDomain[0]);
  const rateTicks = [rateDomain[0], (rateDomain[0] + rateDomain[1]) / 2, rateDomain[1]];
  const barWidth = Math.min(18, width / Math.max(points.length, 1) * .65);
  const allDays = summary.exceeded + summary.met;
  return <article className="ppa-unit-card" style={{ "--unit-accent": accents[unit] } as CSSProperties}>
    <header className="ppa-card-header"><div className="ppa-card-title"><span className="ppa-unit-marker">{unit === "plant" ? "NM" : unit.toUpperCase()}</span><div><h3>{title}</h3><p>{summary.total} ngày đủ dữ liệu so sánh</p></div></div><span className={`ppa-status ${tone}`}>{hasComparison ? over ? "TB vượt PPA" : "TB đạt PPA" : "Chưa đủ dữ liệu"}</span></header>
    <div className="ppa-rate-metrics"><div><p>SHN thực tế <span>TB ngày</span></p><strong>{format(summary.avgActual)}</strong><span className="ppa-metric-unit">kJ/kWh</span></div><div><p>SHN theo PPA <span>TB ngày</span></p><strong>{format(summary.avgPpa)}</strong><span className="ppa-metric-unit">kJ/kWh</span></div></div>
    <div className={`ppa-difference-summary ${tone}`}><div><p>Chênh lệch trung bình</p><strong>{hasComparison && summary.avgDiff! > 0 ? "+" : ""}{format(summary.avgDiff)} <small>kJ/kWh</small></strong></div><span>Thực tế − PPA</span></div>
    <div className="ppa-day-counts"><span><i className="over" />Vượt <b>{summary.exceeded} ngày</b></span><span><i className="met" />Đạt <b>{summary.met} ngày</b></span></div>
    <div className="ppa-day-bar" aria-label={`${summary.exceeded} ngày vượt, ${summary.met} ngày đạt`}><span style={{ width: `${allDays ? summary.exceeded / allDays * 100 : 0}%` }} /><span style={{ width: `${allDays ? summary.met / allDays * 100 : 0}%` }} /></div>
    <div className="ppa-chart-section"><div className="ppa-chart-label"><h4>Suất hao nhiệt</h4><span>kJ/kWh · trục co theo dữ liệu</span></div>{points.some(p => p.thucTe !== null || p.ppa !== null) ? <svg className="ppa-rate-chart" viewBox="0 0 460 172" role="img" aria-label={`Suất hao nhiệt thực tế và PPA ${title}`}>
      {rateTicks.map((value, i) => <g key={i}><line x1={left} x2={right} y1={rateY(value)} y2={rateY(value)} className="ppa-grid-line" /><text x={left - 8} y={rateY(value) + 4} textAnchor="end">{tick.format(value)}</text></g>)}
      {buildRatePaths(points.map(p => p.ppa), x, rateY).map((d,i) => <path key={`ppa-${i}`} d={d} className="ppa-standard-path" />)}
      {buildRatePaths(points.map(p => p.thucTe), x, rateY).map((d,i) => <path key={`actual-${i}`} d={d} className="ppa-actual-path" />)}
      {points.map((p,i) => <g key={`${p.date}-${i}`}>{p.thucTe !== null && Number.isFinite(p.thucTe) && <circle cx={x(i)} cy={rateY(p.thucTe)} r="3" fill="var(--unit-accent)"><title>{p.date}: Thực tế {format(p.thucTe)} kJ/kWh</title></circle>}{p.ppa !== null && Number.isFinite(p.ppa) && <circle cx={x(i)} cy={rateY(p.ppa)} r="2.5" fill="#fff" stroke="#64748b"><title>{p.date}: PPA {format(p.ppa)} kJ/kWh</title></circle>}</g>)}
    </svg> : <div className="ppa-chart-empty">Chưa có số liệu suất hao nhiệt</div>}<div className="ppa-chart-legend"><span><i className="actual" />Thực tế</span><span><i className="standard" />Theo PPA</span></div></div>
    <div className="ppa-chart-section ppa-diff-chart-section"><div className="ppa-chart-label"><h4>Chênh lệch theo ngày</h4><span>kJ/kWh</span></div><svg className="ppa-diff-chart" viewBox="0 0 460 124" role="img" aria-label={`Chênh lệch thực tế trừ PPA ${title}; đỏ vượt, xanh đạt`}>
      {[diffDomain[0],diffDomain[1]].map(value=><g key={value}><line x1={left} x2={right} y1={diffY(value)} y2={diffY(value)} className="ppa-grid-line" /><text x={left-8} y={diffY(value)+4} textAnchor="end">{tick.format(value)}</text></g>)}
      <line x1={left} x2={right} y1={diffY(0)} y2={diffY(0)} className="ppa-zero-line" /><text x={left - 8} y={diffY(0) + 4} textAnchor="end">0</text>
      {points.map((p,i) => <g key={`${p.date}-${i}`}>{p.chenhLech !== null && Number.isFinite(p.chenhLech) && <rect x={x(i) - barWidth / 2} y={Math.min(diffY(0),diffY(p.chenhLech))} width={barWidth} height={Math.max(1,Math.abs(diffY(0)-diffY(p.chenhLech)))} rx="2" fill={p.chenhLech > 0 ? "#e58080" : "#48a984"}><title>{p.date}: {p.chenhLech > 0 ? "Vượt" : "Đạt"}, {format(p.chenhLech)} kJ/kWh</title></rect>}{(i===0 || i===points.length-1 || i % Math.max(1,Math.ceil(points.length/5))===0) && <text x={x(i)} y="117" textAnchor="middle">{p.date}</text>}</g>)}
    </svg><p className="ppa-diff-caption"><span className="over">Đỏ: vượt PPA</span><span className="met">Xanh: đạt PPA</span></p></div>
    <details className="ppa-card-data"><summary>Xem số liệu biểu đồ</summary><div className="ppa-card-data-scroll"><table><thead><tr><th>Ngày</th><th>Thực tế</th><th>PPA</th><th>Chênh lệch</th></tr></thead><tbody>{points.map((p,i)=><tr key={`${p.date}-${i}`}><td>{p.date}</td><td>{format(p.thucTe)}</td><td>{format(p.ppa)}</td><td>{format(p.chenhLech)}</td></tr>)}</tbody></table></div></details>
    <p className="ppa-card-footnote">TB: trung bình cộng ngày có đủ cặp số liệu. Khoảng trống: thiếu dữ liệu.</p>
  </article>;
}
