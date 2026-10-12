import { PpaUnitCard } from "./ppa-unit-card";

/** Synthetic read-only data; summaries and chart use the same pairs. */
export function PpaDesignPreview() {
  return <div className="ppa-unit-grid">{(["s1","s2","plant"] as const).map((unit,index) => {
    const points = Array.from({length:15},(_,i) => {
      const actual = 10460 + [20,180,-80,10,60,240,110,50,130,100,200,80,95,70,65][i] - index*12 - (unit === "s2" && i === 9 ? 2600 : 0);
      const ppa = 10380 + Math.round(Math.cos(i/2)*60);
      const missing = unit === "s2" && i > 9;
      return {date:`${String(i+1).padStart(2,"0")}/10`,thucTe:missing?null:actual,ppa:missing?null:ppa,chenhLech:missing?null:actual-ppa};
    });
    const pairs = points.filter(p=>p.thucTe!==null && p.ppa!==null);
    const avg = (values:number[]) => values.reduce((a,b)=>a+b,0)/values.length;
    const summary = {avgActual:avg(pairs.map(p=>p.thucTe!)),avgPpa:avg(pairs.map(p=>p.ppa!)),avgDiff:avg(pairs.map(p=>p.chenhLech!)),exceeded:pairs.filter(p=>p.chenhLech!>0).length,met:pairs.filter(p=>p.chenhLech!<=0).length,total:pairs.length};
    return <PpaUnitCard key={unit} unit={unit} summary={summary} points={points} />;
  })}</div>;
}
