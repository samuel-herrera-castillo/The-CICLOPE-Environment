import { useRef, useEffect } from "react";
import * as d3 from "d3";
import { useCategoryCounts } from "./chartData";

/* ── Shared props ── */
interface ChartProps {
  categories?: { name: string; color: string; id: string }[];
  documents?: { name: string; id: string; count: number }[];
  onElementClick?: (label: string, detail: string) => void;
  refreshKey?: number;
}

function useChartData(categories?: { name: string; color: string; id: string }[]) {
  const counts = useCategoryCounts();
  if (!categories || categories.length === 0) return [];
  return categories.map((c) => ({ ...c, count: counts.get(c.name) || 0 }));
}

/* ── G1 Histogram ── */
export function HistogramChart({ categories, onElementClick, refreshKey }: ChartProps) {
  const ref = useRef<HTMLDivElement>(null);
  const cats = useChartData(categories);
  useEffect(() => {
    if (!ref.current) return; ref.current.innerHTML = "";
    const w = ref.current.clientWidth, h = 400, m = { top: 20, right: 20, bottom: 30, left: 40 };
    const bins = 20;
    // Use real category counts from SQLite
    const totalCount = cats.reduce((a, c) => a + (c as any).count, 0);
    const data = Array.from({ length: bins }, (_, i) => ({
      bin: i * (100 / bins),
      count: totalCount > 0 ? Math.max(0, (totalCount / bins) + (i === Math.floor(bins/2) ? totalCount * 0.3 : 0)) : 0,
    }));
    const svg = d3.select(ref.current).append("svg").attr("width", w).attr("height", h);
    const g = svg.append("g").attr("transform", `translate(${m.left},${m.top})`);
    const x = d3.scaleLinear().domain([0, 100]).range([0, w - m.left - m.right]);
    const y = d3.scaleLinear().domain([0, d3.max(data, (d) => d.count)!]).range([h - m.top - m.bottom, 0]).nice();
    g.append("g").call(d3.axisBottom(x).ticks(10)).attr("font-size", 10).attr("color", "var(--text-secondary)");
    g.append("g").call(d3.axisLeft(y).ticks(5)).attr("font-size", 10).attr("color", "var(--text-secondary)");
    g.selectAll(".domain").remove();
    g.append("g").selectAll("line").data(y.ticks(5)).join("line")
      .attr("x1", 0).attr("x2", w - m.left - m.right).attr("y1", (d) => y(d)).attr("y2", (d) => y(d))
      .attr("stroke", "#E0E0E0").attr("stroke-dasharray", "3 3").attr("stroke-width", 0.5);
    g.selectAll("rect").data(data).join("rect")
      .attr("x", (d) => x(d.bin)).attr("width", (w - m.left - m.right) / bins - 1)
      .attr("y", (d) => y(d.count)).attr("height", (d) => h - m.top - m.bottom - y(d.count))
      .attr("fill", "var(--peach)").attr("stroke", "#C4A0D4").attr("stroke-width", 0.5).attr("opacity", 0.75).attr("rx", 2)
      .attr("cursor", "pointer")
      .on("mouseenter", function () { d3.select(this).attr("opacity", 1); })
      .on("mouseleave", function () { d3.select(this).attr("opacity", 0.75); })
      .on("click", (_e, d) => onElementClick?.(`${d.count} segments`, `Range: ${d.bin.toFixed(0)}-${(d.bin + 100 / bins).toFixed(0)}`))
      .append("title").text((d) => `${d.count} segments [${d.bin.toFixed(0)}-${(d.bin + 100 / bins).toFixed(0)}]`);
    const mean = data.reduce((a, d) => a + d.bin * d.count, 0) / data.reduce((a, d) => a + d.count, 0);
    g.append("line").attr("x1", x(mean)).attr("x2", x(mean)).attr("y1", 0).attr("y2", h - m.top - m.bottom)
      .attr("stroke", "#C4A0D4").attr("stroke-dasharray", "6 3").attr("stroke-width", 1.5);
    g.append("text").attr("x", x(mean) + 4).attr("y", 12).text(`μ=${mean.toFixed(1)}`).attr("font-size", 9).attr("fill", "#C4A0D4");
  }, [cats, onElementClick, refreshKey]);
  return <div ref={ref} />;
}

/* ── G2 Box Plot ── */
export function BoxPlotChart({ categories, onElementClick, refreshKey }: ChartProps) {
  const ref = useRef<HTMLDivElement>(null);
  const cats = useChartData(categories);
  useEffect(() => {
    if (!ref.current) return; ref.current.innerHTML = "";
    const w = ref.current.clientWidth, h = 350, m = { top: 20, right: 20, bottom: 40, left: 50 };
    const data = cats.slice(0, 6).map((c) => {
      const cnt = (c as any).count || 0;
      const q1 = cnt * 0.3, median = cnt * 0.5, q3 = cnt * 0.7;
      return { name: c.name, color: c.color, q1, median, q3,
        min: q1 * 0.5, max: q3 * 1.3,
        outliers: [] as number[],
      };
    });
    const svg = d3.select(ref.current).append("svg").attr("width", w).attr("height", h);
    const g = svg.append("g").attr("transform", `translate(${m.left},${m.top})`);
    const allVals = data.flatMap((d) => [d.min, d.q1, d.median, d.q3, d.max, ...d.outliers]);
    const y = d3.scaleLinear().domain([Math.min(...allVals) - 5, Math.max(...allVals) + 5]).range([h - m.top - m.bottom, 0]).nice();
    const bw = Math.min(60, (w - m.left - m.right) / data.length * 0.6);
    const x = d3.scaleBand().domain(data.map((d) => d.name)).range([0, w - m.left - m.right]).padding(0.4);
    g.append("g").call(d3.axisLeft(y).ticks(6)).attr("font-size", 10).attr("color", "var(--text-secondary)");
    g.append("g").call(d3.axisBottom(x)).attr("font-size", 9).attr("color", "var(--text-secondary)").selectAll("text").attr("transform", "rotate(-30)").style("text-anchor", "end");
    g.selectAll(".domain").remove();
    data.forEach((d) => {
      const cx = x(d.name)! + x.bandwidth() / 2;
      g.append("rect").attr("x", cx - bw / 2).attr("y", y(d.q3)).attr("width", bw).attr("height", y(d.q1) - y(d.q3))
        .attr("fill", d.color).attr("opacity", 0.4).attr("stroke", d.color).attr("stroke-width", 1.5).attr("cursor", "pointer")
        .on("click", () => onElementClick?.(d.name, `Q1:${d.q1.toFixed(0)} Med:${d.median.toFixed(0)} Q3:${d.q3.toFixed(0)}`));
      g.append("line").attr("x1", cx - bw / 2).attr("x2", cx + bw / 2).attr("y1", y(d.median)).attr("y2", y(d.median)).attr("stroke", "#fff").attr("stroke-width", 2);
      g.append("line").attr("x1", cx).attr("x2", cx).attr("y1", y(d.min)).attr("y2", y(d.q1)).attr("stroke", d.color).attr("stroke-width", 1);
      g.append("line").attr("x1", cx).attr("x2", cx).attr("y1", y(d.q3)).attr("y2", y(d.max)).attr("stroke", d.color).attr("stroke-width", 1);
      d.outliers.forEach((o) => {
        g.append("circle").attr("cx", cx).attr("cy", y(o)).attr("r", 3.5).attr("fill", d.color).attr("stroke", "#fff").attr("stroke-width", 1);
      });
    });
  }, [cats, onElementClick, refreshKey]);
  return <div ref={ref} />;
}

/* ── G3 Violin Plot ── */
export function ViolinPlotChart({ categories, onElementClick, refreshKey }: ChartProps) {
  const ref = useRef<HTMLDivElement>(null);
  const cats = useChartData(categories);
  const groups = cats.slice(0, 4);
  useEffect(() => {
    if (!ref.current) return; ref.current.innerHTML = "";
    const w = ref.current.clientWidth, h = 350, m = { top: 20, right: 20, bottom: 40, left: 50 };
    const data = groups.map((g) => {
      const cnt = Math.max(5, (g as any).count || 5);
      return { name: g.name, color: g.color, values: Array.from({ length: cnt }, (_, i) => cnt * (0.3 + (i / cnt) * 0.7)) };
    });
    const allVals = data.flatMap((d) => d.values);
    const y = d3.scaleLinear().domain([0, d3.max(allVals)!]).range([h - m.top - m.bottom, 0]).nice();
    const x = d3.scaleBand().domain(groups.map((g) => g.name)).range([0, w - m.left - m.right]).padding(0.4);
    const svg = d3.select(ref.current).append("svg").attr("width", w).attr("height", h);
    const g = svg.append("g").attr("transform", `translate(${m.left},${m.top})`);
    g.append("g").call(d3.axisLeft(y).ticks(5)).attr("font-size", 10).attr("color", "var(--text-secondary)");
    g.append("g").call(d3.axisBottom(x)).attr("font-size", 9).attr("color", "var(--text-secondary)");
    g.selectAll(".domain").remove();
    data.forEach((d) => {
      const cx = x(d.name)! + x.bandwidth() / 2, bw = x.bandwidth() * 0.8;
      const bwOpt = 8;
      const density = Array.from({ length: 50 }, (_, j) => {
        const yi = (j / 49) * (d3.max(d.values)!);
        let dens = 0;
        d.values.forEach((v) => { const u = (yi - v) / bwOpt; if (Math.abs(u) <= 1) dens += 0.75 * (1 - u * u); });
        return { y: yi, density: dens };
      });
      const maxD = d3.max(density, (p) => p.density)!;
      const xScale = d3.scaleLinear().domain([-maxD, maxD]).range([0, bw]);
      const area = d3.area<{ y: number; density: number }>().x0(() => cx).x1((p) => cx + xScale(p.density)).y((p) => y(p.y)).curve(d3.curveMonotoneX);
      const areaL = d3.area<{ y: number; density: number }>().x0(() => cx).x1((p) => cx - xScale(p.density)).y((p) => y(p.y)).curve(d3.curveMonotoneX);
      g.append("path").datum(density).attr("d", area).attr("fill", d.color).attr("opacity", 0.5).attr("cursor", "pointer")
        .on("click", () => onElementClick?.(d.name, `${d.values.length} values · Violin distribution`));
      g.append("path").datum(density).attr("d", areaL).attr("fill", d.color).attr("opacity", 0.5);
      const sorted = d.values.sort(d3.ascending);
      const q1 = d3.quantile(sorted, 0.25)!, med = d3.quantile(sorted, 0.5)!, q3 = d3.quantile(sorted, 0.75)!;
      g.append("rect").attr("x", cx - bw * 0.15).attr("y", y(q3)).attr("width", bw * 0.3).attr("height", y(q1) - y(q3))
        .attr("fill", "#fff").attr("opacity", 0.8).attr("stroke", "#333").attr("stroke-width", 1);
      g.append("line").attr("x1", cx - bw * 0.15).attr("x2", cx + bw * 0.15).attr("y1", y(med)).attr("y2", y(med)).attr("stroke", "#333").attr("stroke-width", 1.5);
    });
  }, [groups, onElementClick, refreshKey]);
  return <div ref={ref} />;
}

/* ── G4 Density Plot ── */
export function DensityPlotChart({ categories, onElementClick, refreshKey }: ChartProps) {
  const ref = useRef<HTMLDivElement>(null);
  const cats = useChartData(categories);
  useEffect(() => {
    if (!ref.current) return; ref.current.innerHTML = "";
    const w = ref.current.clientWidth, h = 320, m = { top: 20, right: 20, bottom: 30, left: 50 };
    const groups = cats.slice(0, 3).map((c, i) => {
      const cnt = Math.max(10, (c as any).count || 10);
      return { name: c.name, color: c.color, values: Array.from({ length: cnt }, (_, j) => cnt * (0.2 + (j / cnt) * 0.8 + i * 0.15)) };
    });
    const allVals = groups.flatMap((g) => g.values);
    const x = d3.scaleLinear().domain([0, d3.max(allVals)!]).range([0, w - m.left - m.right]).nice();
    const svg = d3.select(ref.current).append("svg").attr("width", w).attr("height", h);
    const g = svg.append("g").attr("transform", `translate(${m.left},${m.top})`);
    let maxDensity = 0;
    const kdes: { x: number; density: number; color: string; name: string }[][] = [];
    groups.forEach((grp) => {
      const kde = Array.from({ length: 100 }, (_, i) => {
        const xi = (i / 99) * (d3.max(grp.values)!);
        let density = 0; const bw = 10;
        grp.values.forEach((v) => { const u = (xi - v) / bw; if (Math.abs(u) <= 1) density += 0.75 * (1 - u * u); });
        return { x: xi, density, color: grp.color, name: grp.name };
      });
      kdes.push(kde);
      maxDensity = Math.max(maxDensity, d3.max(kde, (d) => d.density)!);
    });
    const y = d3.scaleLinear().domain([0, maxDensity]).range([h - m.top - m.bottom, 0]).nice();
    g.append("g").call(d3.axisLeft(y).ticks(4)).attr("font-size", 10).attr("color", "var(--text-secondary)");
    kdes.forEach((kde) => {
      const area = d3.area<{ x: number; density: number }>().x((d) => x(d.x)).y0(h - m.top - m.bottom).y1((d) => y(d.density)).curve(d3.curveBasis);
      g.append("path").datum(kde).attr("d", area).attr("fill", kde[0].color).attr("opacity", 0.25);
      const line = d3.line<{ x: number; density: number }>().x((d) => x(d.x)).y((d) => y(d.density)).curve(d3.curveBasis);
      g.append("path").datum(kde).attr("d", line).attr("fill", "none").attr("stroke", kde[0].color).attr("stroke-width", 2.5)
        .attr("cursor", "pointer").on("click", () => onElementClick?.(kde[0].name, `Density distribution`));
    });
    g.append("g").attr("transform", `translate(0,${h - m.top - m.bottom})`).call(d3.axisBottom(x).ticks(6)).attr("font-size", 10).attr("color", "var(--text-secondary)");
    g.selectAll(".domain").remove();
  }, [cats, onElementClick, refreshKey]);
  return <div ref={ref} />;
}

/* ── G5 Bee Swarm ── */
export function BeeSwarmChart({ categories, onElementClick, refreshKey }: ChartProps) {
  const ref = useRef<HTMLDivElement>(null);
  const cats = useChartData(categories);
  const groups = cats.slice(0, 5);
  useEffect(() => {
    if (!ref.current) return; ref.current.innerHTML = "";
    const w = ref.current.clientWidth, h = 350, m = { top: 20, right: 20, bottom: 40, left: 50 };
    const data = groups.flatMap((g) => {
      const cnt = Math.max(5, (g as any).count || 5);
      return Array.from({ length: Math.min(cnt, 30) }, (_, i) => ({ group: g.name, value: cnt * (0.5 + (i / Math.min(cnt, 30)) * 0.5), color: g.color }));
    });
    const y = d3.scaleLinear().domain([0, 100]).range([h - m.top - m.bottom, 0]);
    const x = d3.scaleBand().domain(groups.map((g) => g.name)).range([0, w - m.left - m.right]).padding(0.3);
    const svg = d3.select(ref.current).append("svg").attr("width", w).attr("height", h);
    const g = svg.append("g").attr("transform", `translate(${m.left},${m.top})`);
    g.append("g").call(d3.axisLeft(y).ticks(5)).attr("font-size", 10).attr("color", "var(--text-secondary)");
    g.append("g").call(d3.axisBottom(x)).attr("font-size", 9).attr("color", "var(--text-secondary)");
    g.selectAll(".domain").remove();
    const nodes = data.map((d) => ({ ...d, x: (x(d.group) ?? 0) + x.bandwidth() / 2 + (0 - 0.5) * 40, y: y(d.value) }));
    const sim = d3.forceSimulation(nodes)
      .force("x", d3.forceX((d: any) => (x(d.group) ?? 0) + x.bandwidth() / 2).strength(0.3))
      .force("y", d3.forceY((d: any) => y(d.value)).strength(1))
      .force("collide", d3.forceCollide(5)).stop();
    for (let ti = 0; ti < 120; ti++) sim.tick();
    g.selectAll("circle").data(nodes).join("circle")
      .attr("cx", (d: any) => d.x).attr("cy", (d: any) => d.y).attr("r", 4)
      .attr("fill", (d: any) => d.color).attr("stroke", "#fff").attr("stroke-width", 0.5).attr("opacity", 0.7)
      .attr("cursor", "pointer")
      .on("click", (_e, d: any) => onElementClick?.(d.group, `Value: ${d.value.toFixed(1)}`))
      .append("title").text((d: any) => `${d.group}: ${d.value.toFixed(1)}`);
  }, [groups, onElementClick, refreshKey]);
  return <div ref={ref} />;
}

/* ── G6 Pearl Chart ── */
export function PearlChart({ categories, onElementClick, refreshKey }: ChartProps) {
  const ref = useRef<HTMLDivElement>(null);
  const cats = useChartData(categories);
  useEffect(() => {
    if (!ref.current) return; ref.current.innerHTML = "";
    const w = ref.current.clientWidth, h = 320, m = { top: 20, right: 20, bottom: 30, left: 50 };
    const bins = cats.slice(0, 5).map((c) => ({ range: c.name, count: (c as any).count || 5, color: c.color }));
    const x = d3.scaleBand().domain(bins.map((b) => b.range)).range([0, w - m.left - m.right]).padding(0.3);
    const rScale = d3.scaleSqrt().domain([0, d3.max(bins, (b) => b.count)!]).range([5, 35]);
    const svg = d3.select(ref.current).append("svg").attr("width", w).attr("height", h);
    const g = svg.append("g").attr("transform", `translate(${m.left},${h / 2})`);
    g.selectAll("circle").data(bins).join("circle")
      .attr("cx", (d) => (x(d.range) ?? 0) + x.bandwidth() / 2)
      .attr("r", (d) => rScale(d.count)).attr("fill", (d) => d.color).attr("fill-opacity", 0.6)
      .attr("stroke", (d) => d.color).attr("stroke-width", 1).attr("cursor", "pointer")
      .on("click", (_e, d) => onElementClick?.(d.range, `${d.count} segments`))
      .append("title").text((d) => `${d.count} segments in ${d.range}`);
    g.selectAll("text.count").data(bins).join("text")
      .attr("x", (d) => (x(d.range) ?? 0) + x.bandwidth() / 2).attr("y", (d) => -rScale(d.count) - 4)
      .attr("text-anchor", "middle").attr("font-size", 11).attr("font-weight", 600).attr("fill", "var(--peach)").text((d) => d.count);
    g.selectAll("text.label").data(bins).join("text")
      .attr("x", (d) => (x(d.range) ?? 0) + x.bandwidth() / 2).attr("y", 6)
      .attr("text-anchor", "middle").attr("font-size", 8).attr("fill", "var(--text-secondary)").text((d) => d.range.slice(0, 10));
  }, [cats, onElementClick, refreshKey]);
  return <div ref={ref} />;
}
