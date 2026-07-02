import { useRef, useEffect } from "react";
import * as d3 from "d3";
import { useCategoryCounts, useDocCounts } from "./chartData";

interface ChartProps {
  categories?: { name: string; color: string; id: string }[];
  documents?: { name: string; id: string; count: number }[];
  onElementClick?: (label: string, detail: string) => void;
  refreshKey?: number;
}

function useCats(categories?: { name: string; color: string; id: string }[]) {
  const counts = useCategoryCounts();
  return categories?.length ? categories.map((c) => ({ ...c, count: counts.get(c.name) || 0 })) : [];
}

function useDocs(documents?: { name: string; id: string; count: number }[]) {
  const counts = useDocCounts();
  return documents?.length ? documents.map((d) => ({ ...d, count: counts.get(d.name) || d.count || 0 })) : [];
}

/* ── G7 Step Chart ── */
export function StepChart({ documents, onElementClick, refreshKey }: ChartProps) {
  const ref = useRef<HTMLDivElement>(null);
  const docs = useDocs(documents);
  useEffect(() => {
    if (!ref.current) return; ref.current.innerHTML = "";
    const w = ref.current.clientWidth, h = 320, m = { top: 20, right: 20, bottom: 35, left: 50 };
    const data = docs.map((d, i) => ({ ...d, index: i, value: Math.max(5, d.count + 0) }));
    const svg = d3.select(ref.current).append("svg").attr("width", w).attr("height", h);
    const g = svg.append("g").attr("transform", `translate(${m.left},${m.top})`);
    const x = d3.scalePoint().domain(data.map((d) => d.name)).range([0, w - m.left - m.right]);
    const y = d3.scaleLinear().domain([0, d3.max(data, (d) => d.value)! + 5]).range([h - m.top - m.bottom, 0]).nice();
    const line = d3.line<typeof data[0]>().x((d) => x(d.name)!).y((d) => y(d.value)).curve(d3.curveStepAfter);
    const area = d3.area<typeof data[0]>().x((d) => x(d.name)!).y0(h - m.top - m.bottom).y1((d) => y(d.value)).curve(d3.curveStepAfter);
    g.append("path").datum(data).attr("d", area).attr("fill", "var(--peach)").attr("opacity", 0.15);
    g.append("path").datum(data).attr("d", line).attr("fill", "none").attr("stroke", "var(--peach)").attr("stroke-width", 2.5);
    g.selectAll("circle").data(data).join("circle")
      .attr("cx", (d) => x(d.name)!).attr("cy", (d) => y(d.value)).attr("r", 4)
      .attr("fill", "var(--peach)").attr("stroke", "#fff").attr("stroke-width", 1.5).attr("cursor", "pointer")
      .on("click", (_e, d) => onElementClick?.(d.name, `Value: ${d.value}`));
    g.append("g").call(d3.axisLeft(y).ticks(5)).attr("font-size", 10).attr("color", "var(--text-secondary)");
    g.append("g").attr("transform", `translate(0,${h - m.top - m.bottom})`).call(d3.axisBottom(x)).attr("font-size", 8).attr("color", "var(--text-secondary)");
    g.selectAll(".domain").remove();
  }, [docs, onElementClick, refreshKey]);
  return <div ref={ref} />;
}

/* ── G8 Calendar View ── */
export function CalendarChart({ onElementClick, refreshKey }: ChartProps) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!ref.current) return; ref.current.innerHTML = "";
    const w = ref.current.clientWidth, h = 200, cellSz = 12, gap = 2, weeks = 52, days = 7;
    const m = { top: 18, right: 10, bottom: 5, left: 30 };
    const svg = d3.select(ref.current).append("svg").attr("width", w).attr("height", h);
    const g = svg.append("g").attr("transform", `translate(${m.left},${m.top})`);
    const maxVal = 20;
    const colorScale = d3.scaleSequential(t => d3.interpolateRgbBasis(["#FFFFFF", "#F1D7FF", "#C4A0D4", "#6B5090"])(t)).domain([0, maxVal]);
    for (let wk = 0; wk < weeks; wk++) {
      for (let dy = 0; dy < days; dy++) {
        const val = 0; // Real data would come from temporal query of citas_codigos by date
        g.append("rect").attr("x", wk * (cellSz + gap)).attr("y", dy * (cellSz + gap))
          .attr("width", cellSz).attr("height", cellSz).attr("rx", 2).attr("cursor", "pointer")
          .attr("fill", val === 0 ? "#f0f0f0" : colorScale(val))
          .on("click", () => onElementClick?.("Calendar cell", `Week ${wk + 1}, Day ${dy + 1}: ${val} segments`))
          .append("title").text(`Week ${wk + 1}, Day ${dy + 1}: ${val} segments`);
      }
    }
    const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
    months.forEach((mo: string, i: number) => {
      g.append("text").attr("x", i * (weeks / 12) * (cellSz + gap)).attr("y", -4).attr("font-size", 9).attr("fill", "var(--text-secondary)").text(mo);
    });
    ["M","","W","","F","",""].forEach((_d, i) => {
      g.append("text").attr("x", -6).attr("y", i * (cellSz + gap) + cellSz / 2 + 3)
        .attr("font-size", 7).attr("fill", "var(--text-secondary)").attr("text-anchor", "end").text(_d);
    });
  }, [onElementClick, refreshKey]);
  return <div ref={ref} />;
}

/* ── G9 Horizon Chart ── */
export function HorizonChart({ onElementClick, refreshKey }: ChartProps) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!ref.current) return; ref.current.innerHTML = "";
    const w = ref.current.clientWidth, h = 200, bands = 3, m = { top: 10, right: 20, bottom: 25, left: 40 };
    const bandH = (h - m.top - m.bottom) / bands;
    const data = Array.from({ length: 100 }, (_, i) => ({ x: i, value: Math.abs(Math.sin(i * 0.3) * 30 + Math.cos(i * 0.1) * 15 + 0 * 5) }));
    const maxV = d3.max(data, (d: any) => d.value)!;
    const svg = d3.select(ref.current).append("svg").attr("width", w).attr("height", h);
    const g = svg.append("g").attr("transform", `translate(${m.left},${m.top})`);
    const x = d3.scaleLinear().domain([0, data.length - 1]).range([0, w - m.left - m.right]);
    const colors = ["#F1D7FF", "rgba(241, 215, 255, 0.8)", "rgba(241, 215, 255, 0.7)"];
    for (let band = 0; band < bands; band++) {
      const y = d3.scaleLinear().domain([0, maxV / bands]).range([bandH, 0]);
      const yOffset = band * bandH;
      const clipId = `clip-h${band}-${Math.random().toString(36).slice(2, 6)}`;
      svg.append("defs").append("clipPath").attr("id", clipId).append("rect")
        .attr("x", m.left).attr("y", m.top + yOffset).attr("width", w - m.left - m.right).attr("height", bandH);
      const gg = svg.append("g").attr("clip-path", `url(#${clipId})`);
      const area = d3.area<typeof data[0]>().x((d) => x(d.x) + m.left).y0((d) => m.top + yOffset + y(d.value)).y1(() => m.top + yOffset + y(0)).curve(d3.curveBasis);
      gg.append("path").datum(data).attr("d", area).attr("fill", colors[band]).attr("opacity", 0.6).attr("cursor", "pointer")
        .on("click", () => onElementClick?.("Horizon band", `Band ${band + 1} of ${bands}`));
    }
    g.append("g").attr("transform", `translate(0,${h - m.top - m.bottom})`).call(d3.axisBottom(x).ticks(5)).attr("font-size", 10).attr("color", "var(--text-secondary)");
    g.selectAll(".domain").remove();
  }, [onElementClick, refreshKey]);
  return <div ref={ref} />;
}

/* ── G10 Alluvial Diagram ── */
export function AlluvialChart({ categories, onElementClick, refreshKey }: ChartProps) {
  const ref = useRef<HTMLDivElement>(null);
  const cats = useCats(categories);
  useEffect(() => {
    if (!ref.current) return; ref.current.innerHTML = "";
    const w = 700, h = 400, m = { top: 20, right: 20, bottom: 20, left: 20 };
    const strata = ["Interviews", "Surveys", "Focus Groups"];
    const data = strata.map((s) => ({
      stratum: s,
      cats: cats.slice(0, 3).map((c) => ({ name: c.name, color: c.color, value: (c as any).count || 5 })),
    }));
    const barW = 40, gap = (w - m.left - m.right - barW * data.length) / (data.length - 1);
    const totalMax = d3.max(data, (d) => d3.sum(d.cats, (c) => c.value))!;
    const y = d3.scaleLinear().domain([0, totalMax]).range([h - m.top - m.bottom, 0]);
    const svg = d3.select(ref.current).append("svg").attr("width", w).attr("height", h);
    const g = svg.append("g").attr("transform", `translate(${m.left},${m.top})`);
    data.forEach((d, i) => {
      let yPos = h - m.top - m.bottom;
      d.cats.forEach((cat) => {
        const hBar = y(0) - y(cat.value);
        g.append("rect").attr("x", i * (barW + gap)).attr("y", yPos - hBar).attr("width", barW).attr("height", hBar)
          .attr("fill", cat.color).attr("opacity", 0.7).attr("rx", 2).attr("cursor", "pointer")
          .on("click", () => onElementClick?.(`${d.stratum}: ${cat.name}`, `Value: ${cat.value}`));
        yPos -= hBar;
      });
      g.append("text").attr("x", i * (barW + gap) + barW / 2).attr("y", h - m.top - m.bottom + 14)
        .attr("text-anchor", "middle").attr("font-size", 9).attr("fill", "var(--text-secondary)").text(d.stratum);
    });
    for (let i = 0; i < data.length - 1; i++) {
      const x0 = i * (barW + gap) + barW, x1 = (i + 1) * (barW + gap);
      cats.slice(0, 3).forEach((_cat, ci) => {
        const v0 = data[i].cats[ci].value, v1 = data[i + 1].cats[ci].value;
        const cy0 = y(v0), cy1 = y(v1);
        g.append("path").attr("d", `M ${x0},${cy0} C ${(x0 + x1) / 2},${cy0} ${(x0 + x1) / 2},${cy1} ${x1},${cy1}`)
          .attr("fill", "none").attr("stroke", data[i].cats[ci].color).attr("stroke-width", Math.max(1, (v0 + v1) / 20)).attr("opacity", 0.4);
      });
    }
  }, [cats, onElementClick, refreshKey]);
  return <div ref={ref} />;
}
