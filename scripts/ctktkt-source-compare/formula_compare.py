"""So sánh CÔNG THỨC: với mỗi ô, lấy công thức xuất hiện nhiều nhất trong các ngày của file gốc
(quy đổi tham chiếu sheet thành PREV/NEXT/SAME/OTHER) và so với file xuất từ web.
Dùng: python formula_compare.py goc.xlsx web.xlsx  (ghi formula_diff.json)"""
import openpyxl, re, json, collections, sys
from openpyxl.utils import get_column_letter as L

G = openpyxl.load_workbook(sys.argv[1])
W = openpyxl.load_workbook(sys.argv[2])
DAYS = [s for s in (f"{i:02d}" for i in range(1, 32)) if s in G.sheetnames and s in W.sheetnames and G[s]["D20"].value not in (None, "")]

def norm(f, sheet):
    if not (isinstance(f, str) and f.startswith("=")):
        return None
    day = int(sheet) if sheet.isdigit() else 0
    def rep(m):
        name = m.group(1) or m.group(2)
        if name == "d-1":
            return "PREV!" if day == 1 else f"[{name}]!"
        if name.isdigit():
            n = int(name)
            return "PREV!" if n == day - 1 else "NEXT!" if n == day + 1 else "SAME!" if n == day else "OTHER!"
        return f"[{name}]!"
    f = re.sub(r"'([^']+)'!|\b(\d{2})!", rep, f)
    f = f.replace("$", "").replace(" ", "").upper()
    return f

# Cells where goc and web share the same row labels in both the left (col B) and right (col V/AF) blocks.
def lab(ws, r, c):
    v = ws.cell(r, c).value
    return re.sub(r"\s+", " ", str(v)).strip().lower() if isinstance(v, str) else ""

stats = collections.defaultdict(collections.Counter)   # web cell -> goc normalized formula counts
webf = collections.defaultdict(collections.Counter)
for s in DAYS:
    g, w = G[s], W[s]
    for r in range(1, 200):
        for c in range(1, 50):
            lc = 2 if c <= 11 else 12 if c <= 18 else 22 if c <= 29 else 32 if c <= 38 else None
            if lc is None:
                continue
            gl, wl = lab(g, r, lc), lab(w, r, lc)
            if gl != wl:
                continue  # layout differs on this row/day; skip
            gf = norm(g.cell(r, c).value, s)
            wf = norm(w.cell(r, c).value, s)
            key = f"{L(c)}{r}"
            if gf is not None:
                stats[key][gf] += 1
            if wf is not None:
                webf[key][wf] += 1

out = []
for key in sorted(set(stats) | set(webf), key=lambda k: (int(re.search(r"\d+", k).group()), len(re.match(r"[A-Z]+", k).group()), k)):
    gtop = stats[key].most_common(1)[0] if stats[key] else (None, 0)
    wtop = webf[key].most_common(1)[0] if webf[key] else (None, 0)
    if gtop[0] != wtop[0]:
        out.append({"cell": key, "goc": gtop[0], "gocDays": gtop[1], "gocVariants": len(stats[key]), "web": wtop[0], "webDays": wtop[1]})
json.dump(out, open("formula_diff.json", "w", encoding="utf-8"), ensure_ascii=False, indent=1)
print(len(out), "ô có công thức khác")
for o in out:
    print(f"{o['cell']:6} gốc({o['gocDays']:2}d,{o['gocVariants']}v)={str(o['goc'])[:70]:70} | web({o['webDays']:2}d)={str(o['web'])[:70]}")
