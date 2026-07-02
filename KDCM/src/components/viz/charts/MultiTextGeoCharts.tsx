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

/* ── G21 Parallel Coordinates ── */
export function ParallelCoordinatesChart({ categories, onElementClick, refreshKey }: ChartProps) {
  const ref = useRef<HTMLDivElement>(null);
  const cats = useCats(categories);
  useEffect(() => {
    if (!ref.current) return; ref.current.innerHTML = "";
    const w = ref.current.clientWidth, h = 380, m = { top: 30, right: 20, bottom: 20, left: 20 };
    const dims = ["Rooting", "Density", "Co-occ.", "Weight", "N docs"];
    const data = cats.slice(0, 15).map((c) => ({
      name: c.name, color: c.color, "Rooting": (c as any).count || 5, "Density": ((c as any).count || 5) * 0.6, "Co-occ.": ((c as any).count || 5) * 0.8, "Weight": ((c as any).count || 5) * 2, "N docs": 1,
    }));
    const svg = d3.select(ref.current).append("svg").attr("width", w).attr("height", h);
    const g = svg.append("g").attr("transform", `translate(${m.left},${m.top})`);
    const x = d3.scalePoint().domain(dims).range([0, w - m.left - m.right]);
    const yScales = dims.map((dim) => d3.scaleLinear().domain([0, d3.max(data, (d: any) => d[dim])!]).range([h - m.top - m.bottom, 0]).nice());
    dims.forEach((dim, i) => {
      const axisG = g.append("g").attr("transform", `translate(${x(dim)!},0)`);
      axisG.call(d3.axisLeft(yScales[i]).ticks(4)).attr("font-size", 9).attr("color", "var(--text-secondary)");
      axisG.append("text").attr("y", -10).attr("text-anchor", "middle").attr("font-size", 9).attr("font-weight", 600).attr("fill", "var(--text-secondary)").text(dim);
    });
    const line = d3.line<any>().x((_d, j) => x(dims[j])!).y((d, j) => yScales[j](d));
    g.selectAll("path").data(data).join("path")
      .attr("d", (d: any) => line(dims.map((dim) => d[dim]))).attr("fill", "none")
      .attr("stroke", (d: any) => d.color).attr("stroke-width", 1.2).attr("opacity", 0.35)
      .attr("cursor", "pointer")
      .on("click", (_e, d: any) => onElementClick?.(d.name, `Parallel plot`));
  }, [cats, onElementClick, refreshKey]);
  return <div ref={ref} />;
}

/* ── G22 Radar Chart ── */
export function RadarChart({ categories, onElementClick, refreshKey }: ChartProps) {
  const ref = useRef<HTMLDivElement>(null);
  const cats = useCats(categories);
  useEffect(() => {
    if (!ref.current) return; ref.current.innerHTML = "";
    const w = 400, h = 400, r = 140;
    const dims = ["Rooting", "Density", "Co-occ.", "Weight", "N docs", "Researchers"];
    const data = cats.slice(0, 3).map((c) => ({ name: c.name, color: c.color, values: dims.map(() => ((c as any).count || 5) * 0.8) }));
    const svg = d3.select(ref.current).append("svg").attr("width", w).attr("height", h).append("g").attr("transform", `translate(${w / 2},${h / 2})`);
    const angle = d3.scalePoint().domain(dims).range([0, 2 * Math.PI]);
    const maxVal = d3.max(data.flatMap((d) => d.values))!;
    const rScale = d3.scaleLinear().domain([0, maxVal]).range([0, r]);
    for (let i = 1; i <= 4; i++) {
      const pts = dims.map((_, j) => { const a = angle(dims[j])! - Math.PI / 2; return [Math.cos(a) * rScale(maxVal * i / 4), Math.sin(a) * rScale(maxVal * i / 4)]; });
      svg.append("polygon").attr("points", pts.map((p) => p.join(",")).join(" ")).attr("fill", "none").attr("stroke", "var(--border)").attr("stroke-width", 0.5).attr("stroke-dasharray", "3 3");
    }
    dims.forEach((dim) => {
      const a = angle(dim)! - Math.PI / 2;
      svg.append("line").attr("x1", 0).attr("y1", 0).attr("x2", Math.cos(a) * r).attr("y2", Math.sin(a) * r).attr("stroke", "var(--border)").attr("stroke-width", 0.5);
      svg.append("text").attr("x", Math.cos(a) * (r + 15)).attr("y", Math.sin(a) * (r + 15)).attr("text-anchor", "middle").attr("dominant-baseline", "central").attr("font-size", 9).attr("fill", "var(--text-secondary)").text(dim);
    });
    data.forEach((series) => {
      const pts = dims.map((_, j) => { const a = angle(dims[j])! - Math.PI / 2; return [Math.cos(a) * rScale(series.values[j]), Math.sin(a) * rScale(series.values[j])]; });
      svg.append("polygon").attr("points", pts.map((p) => p.join(",")).join(" ")).attr("fill", series.color).attr("fill-opacity", 0.2).attr("stroke", series.color).attr("stroke-width", 2).attr("cursor", "pointer")
        .on("click", () => onElementClick?.(series.name, `Radar: ${series.name}`));
      pts.forEach((p) => { svg.append("circle").attr("cx", p[0]).attr("cy", p[1]).attr("r", 3).attr("fill", series.color); });
    });
  }, [cats, onElementClick, refreshKey]);
  return <div ref={ref} />;
}

/* ── G23 Marimekko ── */
export function MarimekkoChart({ categories, onElementClick, refreshKey }: ChartProps) {
  const ref = useRef<HTMLDivElement>(null);
  const cats = useCats(categories);
  useEffect(() => {
    if (!ref.current) return; ref.current.innerHTML = "";
    const w = ref.current.clientWidth, h = 350, m = { top: 20, right: 20, bottom: 35, left: 50 };
    const data = [
      { group: "Group A", cats: cats.slice(0, 3).map((c) => ({ ...c, value: (c as any).count || 5 })) },
      { group: "Group B", cats: cats.slice(0, 3).map((c) => ({ ...c, value: ((c as any).count || 5) * 0.7 })) },
    ];
    const svg = d3.select(ref.current).append("svg").attr("width", w).attr("height", h);
    const g = svg.append("g").attr("transform", `translate(${m.left},${m.top})`);
    const totalAll = d3.sum(data, (d: any) => d3.sum(d.cats, (c: any) => c.value));
    let xPos = 0;
    data.forEach((col: any) => {
      const colTotal = d3.sum(col.cats, (c: any) => c.value);
      const colW = ((colTotal / totalAll) * (w - m.left - m.right));
      let yPos = h - m.top - m.bottom;
      col.cats.forEach((cat: any) => {
        const catH = ((cat.value / colTotal) * (h - m.top - m.bottom));
        g.append("rect").attr("x", xPos).attr("y", yPos - catH).attr("width", colW - 1).attr("height", catH)
          .attr("fill", cat.color).attr("stroke", "#fff").attr("stroke-width", 1).attr("opacity", 0.8).attr("cursor", "pointer")
          .on("click", () => onElementClick?.(`${col.group}: ${cat.name}`, `Value: ${cat.value}`))
          .append("title").text(`${col.group} / ${cat.name}: ${cat.value}`);
        if (catH > 20) {
          g.append("text").attr("x", xPos + colW / 2).attr("y", yPos - catH / 2 + 3).attr("text-anchor", "middle").attr("font-size", 9).attr("fill", "#fff").attr("font-weight", 600).text(cat.name);
        }
        yPos -= catH;
      });
      g.append("text").attr("x", xPos + colW / 2).attr("y", h - m.top - m.bottom + 14).attr("text-anchor", "middle").attr("font-size", 10).attr("font-weight", 600).attr("fill", "var(--text-secondary)").text(col.group);
      xPos += colW;
    });
  }, [cats, onElementClick, refreshKey]);
  return <div ref={ref} />;
}

/* ── G24 Word Cloud ── */
export function WordCloudChart({ categories, onElementClick, refreshKey }: ChartProps) {
  const ref = useRef<HTMLDivElement>(null);
  const cats = useCats(categories);
  useEffect(() => {
    if (!ref.current) return; ref.current.innerHTML = "";
    const w = ref.current.clientWidth, h = 380;
    const baseWords = ["resistencia","adaptación","política","comunidad","estrategia","cambio","desarrollo","conflicto","cooperación","sostenibilidad","agencia","territorio","poder","identidad","género","narrativa","migración","educación","recursos","instituciones","economía","cultura","ambiente","salud","tecnología"];
    const words = [...baseWords, ...cats.map((c) => c.name.toLowerCase())].slice(0, 30).map((text, i) => ({ text, size: 8 + (i < cats.length ? Math.max(12, (cats[i] as any)?.count || 15) : 12) }));
    const svg = d3.select(ref.current).append("svg").attr("width", w).attr("height", h).append("g").attr("transform", `translate(${w / 2},${h / 2})`);
    const colors = ["#F1D7FF","#2196F3","#4CAF50","#9C27B0","#F1D7FF","#F44336","#00BCD4","#795548"];
    svg.selectAll("text").data(words).join("text")
      .attr("font-size", (d) => d.size).attr("font-weight", (d) => d.size > 25 ? 700 : 400)
      .attr("fill", (_d, i) => colors[i % colors.length]).attr("text-anchor", "middle").attr("opacity", 0.8)
      .attr("x", () => (0 - 0.5) * w * 0.7).attr("y", () => (0 - 0.5) * h * 0.7)
      .attr("transform", (d) => `rotate(${d.size > 22 ? (0 - 0.5) * 20 : 0})`)
      .attr("cursor", "pointer")
      .on("click", (_e, d) => onElementClick?.(d.text, `Size: ${d.size.toFixed(0)}`))
      .text((d) => d.text);
  }, [cats, onElementClick, refreshKey]);
  return <div ref={ref} />;
}

/* ── G25 Word Tree ── */
export function WordTreeChart({ categories, onElementClick, refreshKey }: ChartProps) {
  const ref = useRef<HTMLDivElement>(null);
  const cats = useCats(categories);
  useEffect(() => {
    if (!ref.current) return; ref.current.innerHTML = "";
    const w = 700, h = 400, m = { top: 20, right: 20, bottom: 20, left: 30 };
    const rootWord = cats[0]?.name.toLowerCase() || "policy";
    const data = { name: rootWord, children: cats.slice(1, 4).map((c) => ({ name: c.name.toLowerCase(), children: [{ name: `aspect ${c.name.slice(0, 4)}` }] })) };
    const svg = d3.select(ref.current).append("svg").attr("width", w).attr("height", h);
    const g = svg.append("g").attr("transform", `translate(${m.left},${m.top})`);
    const root = d3.hierarchy(data);
    d3.tree<any>().size([h - m.top - m.bottom, w - m.left - m.right - 80])(root);
    g.selectAll("path").data(root.links()).join("path")
      .attr("d", d3.linkHorizontal<any, any>().x((d: any) => d.y).y((d: any) => d.x) as any)
      .attr("fill", "none").attr("stroke", "var(--border)").attr("stroke-width", 1.5);
    g.selectAll("circle").data(root.descendants()).join("circle")
      .attr("cx", (d: any) => d.y).attr("cy", (d: any) => d.x).attr("r", 4)
      .attr("fill", "var(--peach)").attr("stroke", "#fff").attr("stroke-width", 1).attr("cursor", "pointer")
      .on("click", (_e, d: any) => onElementClick?.(d.data.name, `Depth: ${d.depth}`));
    g.append("text").attr("x", (root as any).y - 10).attr("y", (root as any).x + 4).attr("text-anchor", "end").attr("font-size", 14).attr("font-weight", 700).attr("fill", "var(--peach)").text(rootWord);
    g.selectAll("text.child").data(root.descendants().filter((d: any) => d.depth > 0)).join("text")
      .attr("x", (d: any) => d.y + 8).attr("y", (d: any) => d.x + 3).attr("font-size", 10).attr("fill", "var(--text-secondary)").text((d: any) => d.data.name);
  }, [cats, onElementClick, refreshKey]);
  return <div ref={ref} />;
}

/* ── G26 KWIC ── */
export function KWICChart({ categories, onElementClick }: ChartProps) {
  const cats = useCats(categories);
  const keyword = cats[0]?.name || "policy";
  const contexts = [
    { left: "The", word: keyword, right: "framework established clear guidelines" },
    { left: "implement the new", word: keyword, right: "across all government sectors" },
    { left: "resistance to the proposed", word: keyword, right: "was significant among communities" },
    { left: "evaluation of the", word: keyword, right: "showed mixed results overall" },
    { left: "local adaptation of national", word: keyword, right: "varied by region and context" },
    { left: "the institutional", word: keyword, right: "provided crucial support mechanisms" },
    { left: "analysis of gender", word: keyword, right: "revealed important social dynamics" },
  ];
  return (
    <div style={{ overflowX: "auto", padding: 16 }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
        <tbody>
          {contexts.map((ctx, i) => (
            <tr key={i} style={{ borderBottom: "1px solid var(--border)", cursor: "pointer" }}
              onClick={() => onElementClick?.(ctx.word, `Context line ${i + 1}`)}>
              <td style={{ padding: "6px 12px", textAlign: "right", width: "40%", color: "var(--text-secondary)" }}>{ctx.left}</td>
              <td style={{ padding: "6px 12px", textAlign: "center", fontWeight: 700, color: "#000", backgroundColor: "var(--peach)" + "10" }}>{ctx.word}</td>
              <td style={{ padding: "6px 12px", textAlign: "left", width: "40%", color: "var(--text-secondary)" }}>{ctx.right}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ── G27 Dot Map ── */
export function DotMapChart({ categories, onElementClick, refreshKey }: ChartProps) {
  const ref = useRef<HTMLDivElement>(null);
  const cats = useCats(categories);
  useEffect(() => {
    if (!ref.current) return; ref.current.innerHTML = "";
    const w = ref.current.clientWidth, h = 400, m = { top: 20, right: 20, bottom: 30, left: 30 };
    const cnt = Math.min(5, (cats[0] as any)?.count || 1);
    const points = cats.flatMap((c, ci) => Array.from({ length: cnt }, (_, i) => ({ name: c.name, color: c.color, lat: 4.5 + ci * 0.2 + i * 0.05, lng: -74.3 + ci * 0.3 + i * 0.05, value: (c as any).count || 5 })));
    const svg = d3.select(ref.current).append("svg").attr("width", w).attr("height", h);
    const g = svg.append("g").attr("transform", `translate(${m.left},${m.top})`);
    const proj = d3.geoMercator().fitExtent([[0, 0], [w - m.left - m.right, h - m.top - m.bottom]], { type: "Feature", geometry: { type: "MultiPoint", coordinates: points.map((p) => [p.lng, p.lat]) } } as any);
    const rScale = d3.scaleSqrt().domain([0, d3.max(points, (p) => p.value)!]).range([3, 15]);
    g.selectAll("circle").data(points).join("circle")
      .attr("cx", (p) => proj([p.lng, p.lat])![0]).attr("cy", (p) => proj([p.lng, p.lat])![1])
      .attr("r", (p) => rScale(p.value)).attr("fill", (p) => p.color).attr("fill-opacity", 0.6)
      .attr("stroke", "#fff").attr("stroke-width", 1).attr("cursor", "pointer")
      .on("click", (_e, p) => onElementClick?.(p.name, `[${p.lat.toFixed(2)}, ${p.lng.toFixed(2)}]: ${p.value.toFixed(0)}`))
      .append("title").text((p) => `[${p.lat.toFixed(2)}, ${p.lng.toFixed(2)}]: ${p.name}`);
    const graticule = d3.geoGraticule();
    g.append("path").datum(graticule()).attr("d", d3.geoPath().projection(proj) as any).attr("fill", "none").attr("stroke", "var(--border)").attr("stroke-width", 0.3);
  }, [cats, onElementClick, refreshKey]);
  return <div ref={ref} />;
}
