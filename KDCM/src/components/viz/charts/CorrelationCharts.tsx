import { useRef, useEffect } from "react";
import * as d3 from "d3";
import { useCategoryCounts } from "./chartData";

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

/* ── G11 Scatterplot Matrix ── */
export function ScatterplotMatrix({ categories, onElementClick, refreshKey }: ChartProps) {
  const ref = useRef<HTMLDivElement>(null);
  const cats = useCats(categories);
  useEffect(() => {
    if (!ref.current) return; ref.current.innerHTML = "";
    const metrics = ["Rooting", "Density", "Co-occ.", "Avg Weight"];
    const data = cats.slice(0, 20).map((c) => ({
      id: c.id, name: c.name,
      "Rooting": (c as any).count || 10,
      "Density": ((c as any).count || 10) * 0.6,
      "Co-occ.": ((c as any).count || 10) * 0.8,
      "Avg Weight": ((c as any).count || 10) * 2.5,
    }));
    const n = metrics.length, cellSz = 150, pad = 30;
    const totalW = n * cellSz + pad, totalH = n * cellSz + pad;
    const svg = d3.select(ref.current).append("svg").attr("width", totalW).attr("height", totalH);
    for (let row = 0; row < n; row++) {
      for (let col = 0; col < n; col++) {
        const g = svg.append("g").attr("transform", `translate(${col * cellSz + pad * 0.5},${row * cellSz + pad * 0.5})`);
        const xMetric = metrics[col], yMetric = metrics[row];
        if (row === col) {
          g.append("text").attr("x", cellSz / 2).attr("y", cellSz / 2).attr("text-anchor", "middle")
            .attr("font-size", 11).attr("font-weight", 600).attr("fill", "var(--text-secondary)").text(xMetric);
        } else {
          const xs = d3.scaleLinear().domain([0, d3.max(data, (d: any) => d[xMetric])!]).range([10, cellSz - 10]).nice();
          const ys = d3.scaleLinear().domain([0, d3.max(data, (d: any) => d[yMetric])!]).range([cellSz - 10, 10]).nice();
          g.selectAll("circle").data(data).join("circle")
            .attr("cx", (d: any) => xs(d[xMetric])).attr("cy", (d: any) => ys(d[yMetric]))
            .attr("r", 3.5).attr("fill", "var(--peach)").attr("opacity", 0.5).attr("cursor", "pointer")
            .on("click", (_e, d: any) => onElementClick?.(d.name, `${xMetric}: ${d[xMetric].toFixed(1)}, ${yMetric}: ${d[yMetric].toFixed(1)}`))
            .append("title").text((d: any) => `${d.name}`);
        }
        g.append("rect").attr("width", cellSz).attr("height", cellSz).attr("fill", "none").attr("stroke", "var(--border)").attr("stroke-width", 0.5);
      }
    }
  }, [cats, onElementClick, refreshKey]);
  return <div ref={ref} style={{ overflow: "auto" }} />;
}

/* ── G12 Hexbin Map ── */
export function HexbinChart({ categories, onElementClick, refreshKey }: ChartProps) {
  const ref = useRef<HTMLDivElement>(null);
  const cats = useCats(categories);
  useEffect(() => {
    if (!ref.current) return; ref.current.innerHTML = "";
    const w = ref.current.clientWidth, h = 400, m = { top: 20, right: 20, bottom: 30, left: 50 };
    const points = cats.flatMap((c) => Array.from({ length: Math.min(20, (c as any).count || 5) }, (_, i) => ({ x: 10 + (cats.indexOf(c) / Math.max(1, cats.length)) * 80, y: 10 + (i / Math.max(1, (c as any).count || 5)) * 80, value: (c as any).count || 5, name: c.name, color: c.color })));
    const svg = d3.select(ref.current).append("svg").attr("width", w).attr("height", h);
    const g = svg.append("g").attr("transform", `translate(${m.left},${m.top})`);
    const x = d3.scaleLinear().domain([0, 100]).range([0, w - m.left - m.right]);
    const y = d3.scaleLinear().domain([0, 100]).range([h - m.top - m.bottom, 0]);
    const colorScale = d3.scaleSequential(t => d3.interpolateRgbBasis(["#FFFFFF", "#F1D7FF", "#C4A0D4", "#6B5090"])(t)).domain([0, 20]);
    g.selectAll("circle").data(points).join("circle")
      .attr("cx", (d: any) => x(d.x)).attr("cy", (d: any) => y(d.y)).attr("r", 7)
      .attr("fill", (d: any) => colorScale(d.value)).attr("stroke", "#fff").attr("stroke-width", 0.5)
      .attr("opacity", 0.7).attr("cursor", "pointer")
      .on("click", (_e, d: any) => onElementClick?.("Hexbin", `${d.name}: ${d.value.toFixed(0)} pairs`))
      .append("title").text((d: any) => `${d.value.toFixed(0)} pairs`);
    g.append("g").call(d3.axisLeft(y).ticks(5)).attr("font-size", 10).attr("color", "var(--text-secondary)");
    g.append("g").attr("transform", `translate(0,${h - m.top - m.bottom})`).call(d3.axisBottom(x).ticks(5)).attr("font-size", 10).attr("color", "var(--text-secondary)");
    g.selectAll(".domain").remove();
  }, [cats, onElementClick, refreshKey]);
  return <div ref={ref} />;
}

/* ── G13 Chord Diagram ── */
export function ChordChart({ categories, onElementClick, refreshKey }: { categories?: { name: string; color: string; id: string }[]; onElementClick?: (label: string, detail: string) => void; refreshKey?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const cats = categories?.length ? categories.slice(0, 8) : [];
  useEffect(() => {
    if (!ref.current || cats.length < 3) return; ref.current.innerHTML = "";
    const w = 450, h = 450, r = Math.min(w, h) / 2 - 30, n = cats.length;
    const matrix: number[][] = Array.from({ length: n }, () => Array(n).fill(0));
    for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++)
      matrix[i][j] = matrix[j][i] = Math.min(((cats[i] as any).count || 3), ((cats[j] as any).count || 3));
    const svg = d3.select(ref.current).append("svg").attr("width", w).attr("height", h).append("g").attr("transform", `translate(${w / 2},${h / 2})`);
    const chord = d3.chord().padAngle(0.05)(matrix);
    const arc = d3.arc<d3.ChordGroup>().innerRadius(r - 20).outerRadius(r);
    const ribbon = d3.ribbon<d3.Chord, d3.ChordGroup>().radius(r - 20);
    const color = d3.scaleOrdinal(cats.map((c) => c.color));
    svg.append("g").selectAll("path.arc").data(chord.groups).join("path")
      .attr("d", arc).attr("fill", (_, i) => color(i.toString())).attr("stroke", "#1A1A2E").attr("cursor", "pointer")
      .on("click", (_e, d: any) => { const idx = chord.groups.indexOf(d); onElementClick?.(cats[idx]?.name ?? "", `Chord arc: ${cats[idx]?.name}`); })
      .append("title").text((_, i) => cats[i]?.name ?? "");
    svg.append("g").selectAll("path.ribbon").data(chord).join("path")
      .attr("d", ribbon).attr("fill", (d: any) => color(d.source.index.toString())).attr("opacity", 0.5)
      .append("title").text((d: any) => `${cats[d.source.index]?.name} ↔ ${cats[d.target.index]?.name}`);
    svg.append("g").selectAll("text").data(chord.groups).join("text")
      .each((d: any) => { d.angle = (d.startAngle + d.endAngle) / 2; })
      .attr("dy", (d: any) => (d.angle > Math.PI ? 8 : -4))
      .attr("transform", (d: any) => `rotate(${(d.angle * 180) / Math.PI - 90}) translate(${r + 8},0) rotate(${d.angle > Math.PI ? 180 : 0})`)
      .attr("text-anchor", (d: any) => (d.angle > Math.PI ? "end" : "start"))
      .attr("font-size", 9).attr("fill", "var(--text-secondary)").text((_, i) => cats[i]?.name.slice(0, 12) ?? "");
  }, [cats, onElementClick, refreshKey]);
  return <div ref={ref} />;
}
