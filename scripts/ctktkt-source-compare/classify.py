"""Phân loại kết quả value_compare: nhãn, cột J lũy kế, lỗi #REF của gốc, số nhập thiếu/khác, công thức khác.
Dùng: python classify.py ket_qua.json"""
import json, re, collections, sys
d = json.load(open(sys.argv[1] if len(sys.argv) > 1 else "fullcmp.json", encoding="utf-8"))

def isnum(s):
    try:
        float(s); return True
    except Exception:
        return False

cats = collections.defaultdict(lambda: collections.defaultdict(list))
for s, diffs in d.items():
    if s in ("d-1", "Tổng hợp tháng"):
        continue
    for x in diffs:
        col = re.match(r"[A-Z]+", x["g"]).group()
        row = int(re.search(r"\d+", x["g"]).group())
        key = (x["lab"] or f"(không nhãn, hàng {row})")[:42] + f" | {col}"
        gv, wv = x["gv"], x["wv"]
        if col == "J" and row < 60:
            c = "3.Cột J lũy kế"
        elif not isnum(gv) and not gv.startswith("#") and (wv in ("None", "") or not isnum(wv)):
            c = "1.Nhãn/tiêu đề"
        elif gv.startswith("#"):
            c = "2.Gốc lỗi #REF/#DIV"
        elif not x["gf"] and wv in ("None", ""):
            c = "4.Số nhập tay gốc có, web trống"
        elif not x["gf"] and not x["wf"]:
            c = "5.Số nhập tay khác nhau"
        elif not x["gf"] and x["wf"]:
            c = "6.Gốc gõ số, web là công thức"
        elif x["gf"] and wv in ("None", ""):
            c = "7.Gốc có công thức, web trống"
        else:
            c = "8.Công thức cho kết quả khác"
        cats[c][key].append(f"{s}:{x['g']}→{x['w']} g={gv[:12]} w={wv[:12]} gF={x['gf'][:45]} wF={x['wf'][:45]}")

for c in sorted(cats):
    print(f"\n##### {c}: {sum(len(v) for v in cats[c].values())} ô, {len(cats[c])} nhóm")
    show = 0 if c.startswith(("1.", "3.")) else 400
    for key, items in sorted(cats[c].items(), key=lambda kv: -len(kv[1]))[:show]:
        print(f"  {len(items):3}d {key} :: {items[0]}")
