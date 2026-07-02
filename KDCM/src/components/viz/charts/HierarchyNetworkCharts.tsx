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

/* ── G14 Circle Packing ── */
export function CirclePackingChart({ categories, onElementClick, refreshKey }: ChartProps) {
  const ref = useRef<HTMLDivElement>(null);
  const cats = useCats(categories);
  useEffect(() => {
    if (!ref.current) return; ref.current.innerHTML = "";
    const w = 500, h = 500;
    const children = cats.slice(0, 6).map((c, i) => ({
      name: c.name, value: (c as any).count || 10, color: c.color,
      children: i < 3 ? [{ name: `${c.name} sub`, value: Math.max(2, ((c as any).count || 10) / 3), color: c.color }] : [],
    }));
    const data = { name: "root", children };
    const svg = d3.select(ref.current).append("svg").attr("width", w).attr("height", h);
    const root = d3.hierarchy(data).sum((d: any) => d.value);
    d3.pack<any>().size([w, h]).padding(6)(root);
    svg.selectAll("circle").data(root.descendants()).join("circle")
      .attr("cx", (d: any) => d.x).attr("cy", (d: any) => d.y).attr("r", (d: any) => d.r)
      .attr("fill", (d: any) => d.data.color || "var(--peach)").attr("stroke", "#fff").attr("stroke-width", 1.5).attr("opacity", 0.7)
      .attr("cursor", "pointer")
      .on("click", (_e, d: any) => onElementClick?.(d.data.name, `${d.data.value ?? d.value} segments`))
      .append("title").text((d: any) => `${d.data.name}: ${d.data.value ?? ""}`);
    svg.selectAll("text").data(root.descendants().filter((d: any) => d.r > 18)).join("text")
      .attr("x", (d: any) => d.x).attr("y", (d: any) => d.y).attr("text-anchor", "middle").attr("dy", 3)
      .attr("font-size", (d: any) => Math.max(8, d.r / 3)).attr("fill", "#fff").text((d: any) => d.data.name.slice(0, d.r / 5));
  }, [cats, onElementClick, refreshKey]);
  return <div ref={ref} />;
}

/* ── G15 Partition ── */
export function PartitionChart({ categories, onElementClick, refreshKey }: ChartProps) {
  const ref = useRef<HTMLDivElement>(null);
  const cats = useCats(categories);
  useEffect(() => {
    if (!ref.current) return; ref.current.innerHTML = "";
    const w = 450, h = 450, r = Math.min(w, h) / 2;
    const children = cats.slice(0, 3).map((c) => ({
      name: c.name, color: c.color,
      children: [{ name: `${c.name} A`, value: 10, color: c.color }, { name: `${c.name} B`, value: 8, color: c.color }],
    }));
    const data = { name: "root", children };
    const svg = d3.select(ref.current).append("svg").attr("width", w).attr("height", h).append("g").attr("transform", `translate(${w / 2},${h / 2})`);
    const root = d3.hierarchy(data).sum((d: any) => d.value).sort((a: any, b: any) => b.value! - a.value!);
    d3.partition<any>().size([2 * Math.PI, r])(root);
    const arc = d3.arc<any>().startAngle((d: any) => d.x0).endAngle((d: any) => d.x1).innerRadius((d: any) => d.y0).outerRadius((d: any) => d.y1);
    svg.selectAll("path").data(root.descendants().filter((d: any) => d.depth > 0)).join("path")
      .attr("d", arc).attr("fill", (d: any) => d.data.color || "var(--peach)").attr("stroke", "#fff").attr("stroke-width", 1).attr("opacity", 0.8)
      .attr("cursor", "pointer")
      .on("click", (_e, d: any) => onElementClick?.(d.data.name, `Value: ${d.value}`));
    svg.selectAll("text").data(root.descendants().filter((d: any) => d.depth > 0 && ((d.x1 - d.x0) * (d.y1 - d.y0) > 400))).join("text")
      .attr("transform", (d: any) => `translate(${arc.centroid(d)})`).attr("text-anchor", "middle").attr("font-size", 9).attr("fill", "#fff")
      .text((d: any) => d.data.name.slice(0, 10));
  }, [cats, onElementClick, refreshKey]);
  return <div ref={ref} />;
}

/* ── G16 Treemap ── */
export function TreemapChart({ categories, onElementClick, refreshKey }: ChartProps) {
  const ref = useRef<HTMLDivElement>(null);
  const cats = useCats(categories);
  useEffect(() => {
    if (!ref.current) return; ref.current.innerHTML = "";
    const w = ref.current.clientWidth, h = 400;
    const data = { name: "root", children: cats.slice(0, 8).map((c) => ({ name: c.name, value: (c as any).count || 10, color: c.color })) };
    const svg = d3.select(ref.current).append("svg").attr("width", w).attr("height", h);
    const root = d3.hierarchy(data).sum((d: any) => d.value);
    d3.treemap<any>().size([w, h]).padding(3).tile(d3.treemapSquarify.ratio(1))(root);
    svg.selectAll("rect").data(root.leaves()).join("rect")
      .attr("x", (d: any) => d.x0).attr("y", (d: any) => d.y0).attr("width", (d: any) => d.x1 - d.x0).attr("height", (d: any) => d.y1 - d.y0)
      .attr("fill", (d: any) => d.data.color).attr("stroke", "#fff").attr("stroke-width", 2).attr("opacity", 0.8).attr("rx", 3)
      .attr("cursor", "pointer")
      .on("click", (_e, d: any) => onElementClick?.(d.data.name, `Value: ${d.value}`))
      .append("title").text((d: any) => `${d.data.name}: ${d.value}`);
    svg.selectAll("text").data(root.leaves()).join("text")
      .attr("x", (d: any) => d.x0 + 6).attr("y", (d: any) => d.y0 + 16).attr("font-size", 11).attr("font-weight", 600).attr("fill", "#fff")
      .text((d: any) => ((d.x1 - d.x0 > 50 && d.y1 - d.y0 > 25) ? d.data.name : ""));
  }, [cats, onElementClick, refreshKey]);
  return <div ref={ref} />;
}

/* ── G17 Rose Chart ── */
export function RoseChart({ categories, onElementClick, refreshKey }: ChartProps) {
  const ref = useRef<HTMLDivElement>(null);
  const cats = useCats(categories);
  useEffect(() => {
    if (!ref.current) return; ref.current.innerHTML = "";
    const w = 400, h = 400, r = 150;
    const data = cats.slice(0, 8).map((c) => ({ name: c.name, value: (c as any).count || 8, color: c.color }));
    const svg = d3.select(ref.current).append("svg").attr("width", w).attr("height", h).append("g").attr("transform", `translate(${w / 2},${h / 2})`);
    const maxVal = d3.max(data, (d) => d.value)!;
    const angle = d3.scaleBand().domain(data.map((d) => d.name)).range([0, 2 * Math.PI]);
    const radius = d3.scaleSqrt().domain([0, maxVal]).range([10, r]);
    const arc = d3.arc<typeof data[0]>().startAngle((d) => angle(d.name)!).endAngle((d) => angle(d.name)! + angle.bandwidth()).innerRadius(20).outerRadius((d) => radius(d.value));
    svg.selectAll("path").data(data).join("path")
      .attr("d", arc).attr("fill", (d) => d.color).attr("stroke", "#fff").attr("stroke-width", 1.5).attr("opacity", 0.75)
      .attr("cursor", "pointer").on("click", (_e, d) => onElementClick?.(d.name, `Value: ${d.value}`))
      .append("title").text((d) => `${d.name}: ${d.value}`);
    svg.selectAll("text").data(data).join("text")
      .attr("transform", (d) => `rotate(${((angle(d.name)! + angle.bandwidth() / 2) * 180) / Math.PI - 90}) translate(${radius(d.value) + 10},0)`)
      .attr("text-anchor", (d) => (angle(d.name)! + angle.bandwidth() / 2 > Math.PI ? "end" : "start"))
      .attr("font-size", 9).attr("fill", "var(--text-secondary)").text((d) => d.name);
  }, [cats, onElementClick, refreshKey]);
  return <div ref={ref} />;
}

/* ── G18 Force Graph ── */
export function ForceGraph({ categories, onElementClick, refreshKey }: { categories?: { name: string; color: string; id: string }[]; onElementClick?: (label: string, detail: string) => void; refreshKey?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const cats = categories?.length ? categories.slice(0, 12) : [];
  useEffect(() => {
    if (!ref.current || cats.length < 2) return; ref.current.innerHTML = "";
    const w = ref.current.clientWidth, h = 500;
    const nodes = cats.map((c) => ({ ...c, rooting: (c as any).count || 5 }));
    const links: { source: string; target: string; value: number }[] = [];
    for (let _i = 0; _i < nodes.length; _i++) for (let j = _i + 1; j < nodes.length; j++)
      if (_i < j && j < Math.min(nodes.length, _i + 4)) links.push({ source: nodes[_i].id, target: nodes[j].id, value: Math.min((nodes[_i] as any).count || 1, (nodes[j] as any).count || 1) });
    const svg = d3.select(ref.current).append("svg").attr("width", w).attr("height", h);
    const rScale = d3.scaleSqrt().domain([0, 20]).range([6, 28]);
    const sim = d3.forceSimulation(nodes as any)
      .force("link", d3.forceLink(links).id((d: any) => d.id).distance(80))
      .force("charge", d3.forceManyBody().strength(-300)).force("center", d3.forceCenter(w / 2, h / 2))
      .force("collide", d3.forceCollide((d: any) => rScale(d.rooting) + 3));
    svg.append("g").selectAll("line").data(links).join("line")
      .attr("stroke", "var(--border)").attr("stroke-width", (d) => Math.max(1, d.value)).attr("opacity", 0.4);
    svg.append("g").selectAll("circle.node").data(nodes).join("circle")
      .attr("r", (d: any) => rScale(d.rooting)).attr("fill", (d) => d.color).attr("opacity", 0.8).attr("stroke", "#fff").attr("stroke-width", 1.5)
      .attr("cursor", "pointer")
      .on("click", (_e, d: any) => onElementClick?.(d.name, `Rooting: ${d.rooting}, Connections: ${links.filter((l: any) => l.source.id === d.id || l.target.id === d.id).length}`))
      .call(d3.drag<any, any>().on("drag", (_e, d: any) => { d.fx = _e.x; d.fy = _e.y; sim.alpha(0.3).restart(); }).on("end", (_e, d: any) => { d.fx = null; d.fy = null; }) as any)
      .append("title").text((d: any) => `${d.name}`);
    svg.append("g").selectAll("text.label").data(nodes).join("text")
      .attr("font-size", 9).attr("text-anchor", "middle").attr("dy", (d: any) => -rScale(d.rooting) - 4)
      .attr("fill", "var(--text-secondary)").text((d) => d.name.slice(0, 12));
    sim.on("tick", () => {
      svg.selectAll("line").attr("x1", (d: any) => d.source.x).attr("y1", (d: any) => d.source.y).attr("x2", (d: any) => d.target.x).attr("y2", (d: any) => d.target.y);
      svg.selectAll("circle.node").attr("cx", (d: any) => d.x).attr("cy", (d: any) => d.y);
      svg.selectAll("text.label").attr("x", (d: any) => d.x).attr("y", (d: any) => d.y);
    });
  }, [cats, onElementClick, refreshKey]);
  return <div ref={ref} />;
}

/* ── G19 Dependency Graph ── */
export function DependencyGraph({ categories, onElementClick, refreshKey }: ChartProps) {
  const ref = useRef<HTMLDivElement>(null);
  const cats = useCats(categories);
  useEffect(() => {
    if (!ref.current) return; ref.current.innerHTML = "";
    const w = 600, h = 400;
    const nodes = cats.slice(0, 6).map((c, i) => ({ ...c, level: i < 2 ? 0 : i < 4 ? 1 : 2 }));
    const links = [{ source: nodes[0].id, target: nodes[2].id }, { source: nodes[0].id, target: nodes[3].id }, { source: nodes[1].id, target: nodes[3].id }, { source: nodes[2].id, target: nodes[4].id }, { source: nodes[3].id, target: nodes[5].id }];
    const svg = d3.select(ref.current).append("svg").attr("width", w).attr("height", h);
    const x = d3.scalePoint().domain(["0","1","2"]).range([100, w - 50]);
    const y = d3.scalePoint().domain(nodes.map((n) => n.id)).range([50, h - 50]);
    svg.append("defs").append("marker").attr("id", "arrow").attr("viewBox", "0 0 10 10").attr("refX", 8).attr("refY", 5).attr("markerWidth", 7).attr("markerHeight", 7).attr("orient", "auto").append("path").attr("d", "M 0 0 L 10 5 L 0 10 z").attr("fill", "var(--text-secondary)");
    svg.selectAll("line").data(links).join("line")
      .attr("x1", (d) => x(nodes.find((n) => n.id === d.source)!.level.toString())!).attr("y1", (d) => y(d.source)!)
      .attr("x2", (d) => x(nodes.find((n) => n.id === d.target)!.level.toString())!).attr("y2", (d) => y(d.target)!)
      .attr("stroke", "var(--text-secondary)").attr("stroke-width", 1.5).attr("marker-end", "url(#arrow)").attr("opacity", 0.4);
    svg.selectAll("circle").data(nodes).join("circle")
      .attr("cx", (d) => x(d.level.toString())!).attr("cy", (d) => y(d.id)!).attr("r", 16).attr("fill", (d) => d.color)
      .attr("stroke", "#fff").attr("stroke-width", 2).attr("cursor", "pointer")
      .on("click", (_e, d) => onElementClick?.(d.name, `Level: ${d.level}, Connections: ${links.filter((l: any) => l.source === d.id || l.target === d.id).length}`));
    svg.selectAll("text").data(nodes).join("text")
      .attr("x", (d) => x(d.level.toString())!).attr("y", (d) => y(d.id)! + 4)
      .attr("text-anchor", "middle").attr("font-size", 8).attr("fill", "#fff").attr("font-weight", 600).text((d) => d.name.slice(0, 8));
  }, [cats, onElementClick, refreshKey]);
  return <div ref={ref} />;
}

/* ── G20 Dendrogram ── */
export function DendrogramChart({ categories, onElementClick, refreshKey }: ChartProps) {
  const ref = useRef<HTMLDivElement>(null);
  const cats = useCats(categories);
  useEffect(() => {
    if (!ref.current) return; ref.current.innerHTML = "";
    const w = 600, h = 400, m = { top: 20, right: 20, bottom: 20, left: 100 };
    const data = { name: "root", children: cats.slice(0, 5).map((c) => ({ name: c.name, color: c.color, children: [{ name: `${c.name} A`, value: 5 }, { name: `${c.name} B`, value: 7 }] })) };
    const svg = d3.select(ref.current).append("svg").attr("width", w).attr("height", h);
    const g = svg.append("g").attr("transform", `translate(${m.left},${m.top})`);
    const root = d3.hierarchy(data);
    d3.cluster<any>().size([h - m.top - m.bottom, w - m.left - m.right - 60])(root);
    g.selectAll("path").data(root.links()).join("path")
      .attr("d", d3.linkHorizontal<any, any>().x((d: any) => d.y).y((d: any) => d.x) as any)
      .attr("fill", "none").attr("stroke", "var(--border)").attr("stroke-width", 1.5);
    g.selectAll("circle").data(root.descendants()).join("circle")
      .attr("cx", (d: any) => d.y).attr("cy", (d: any) => d.x).attr("r", 5)
      .attr("fill", (d: any) => d.data.color || "var(--peach)").attr("stroke", "#fff").attr("stroke-width", 1.5)
      .attr("cursor", "pointer")
      .on("click", (_e, d: any) => onElementClick?.(d.data.name, `Depth: ${d.depth}`));
    g.selectAll("text").data(root.descendants()).join("text")
      .attr("x", (d: any) => d.y + 8).attr("y", (d: any) => d.x + 3).attr("font-size", 10).attr("fill", "var(--text-secondary)").text((d: any) => d.data.name);
  }, [cats, onElementClick, refreshKey]);
  return <div ref={ref} />;
}
