import { useState, useRef, useEffect, useCallback } from "react";
import {
  MousePointer2, Hand, Plus, Trash2, Undo2, Redo2, Save,
  Download, ArrowLeft, Circle, Square, Diamond, Hexagon,
} from "lucide-react";
import * as d3 from "d3";
import { useToast } from "../../stores/toastStore";

/* ── Types ── */

interface NetworkNode {
  id: string;
  type: "category" | "document" | "segment" | "memo" | "text" | "concept";
  label: string;
  color: string;
  x: number;
  y: number;
  fx?: number | null;
  fy?: number | null;
  size: number;
  shape: "circle" | "rect" | "rounded" | "diamond" | "cloud";
}

interface NetworkEdge {
  id: string;
  source: string;
  target: string;
  label: string;
  color: string;
  thickness: number;
  directed: boolean;
  curve: "bezier" | "straight" | "orthogonal";
}

type ToolType = "select" | "move" | "add-node" | "add-edge";

const NODE_SHAPES: { id: NetworkNode["shape"]; icon: React.ComponentType<{ size?: number }>; label: string }[] = [
  { id: "circle", icon: Circle, label: "Circle" },
  { id: "rect", icon: Square, label: "Rectangle" },
  { id: "rounded", icon: Square, label: "Rounded" },
  { id: "diamond", icon: Diamond, label: "Diamond" },
  { id: "cloud", icon: Hexagon, label: "Cloud" },
];

/* ── Main ── */

export function NetworkEditor() {
  const { toast } = useToast();
  const svgRef = useRef<SVGSVGElement>(null);
  const [w] = useState(800);
  const [h] = useState(600);

  const [nodes, setNodes] = useState<NetworkNode[]>([]);
  const [edges, setEdges] = useState<NetworkEdge[]>([]);
  const [tool, setTool] = useState<ToolType>("select");
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [, setSelectedEdgeId] = useState<string | null>(null);
  const [showGrid] = useState(true);
  const [undoStack, setUndoStack] = useState<{ nodes: NetworkNode[]; edges: NetworkEdge[] }[]>([]);
  const [redoStack, setRedoStack] = useState<{ nodes: NetworkNode[]; edges: NetworkEdge[] }[]>([]);
  const [networkName, setNetworkName] = useState("Untitled network");

  // Drag from tree
  const handleDragOver = useCallback((e: React.DragEvent) => { e.preventDefault(); e.dataTransfer.dropEffect = "copy"; }, []);
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    try {
      const data = JSON.parse(e.dataTransfer.getData("text/plain"));
      const svgRect = svgRef.current?.getBoundingClientRect();
      if (!svgRect) return;
      pushUndo();
      const node: NetworkNode = {
        id: `nn-${Date.now()}`, type: data.id?.startsWith("d") ? "document" : "category",
        label: data.name, color: data.color ?? "#F1D7FF",
        x: e.clientX - svgRect.left, y: e.clientY - svgRect.top,
        size: 20, shape: "circle",
      };
      setNodes((prev) => [...prev, node]);
      toast.success("Added", `Node "${data.name}"`);
    } catch { /* */ }
  }, [toast]);

  const pushUndo = useCallback(() => {
    setUndoStack((prev) => [...prev, { nodes: [...nodes], edges: [...edges] }]);
    setRedoStack([]);
  }, [nodes, edges]);

  const handleUndo = () => {
    if (undoStack.length === 0) return;
    const prev = undoStack[undoStack.length - 1];
    setRedoStack((s) => [...s, { nodes: [...nodes], edges: [...edges] }]);
    setNodes(prev.nodes);
    setEdges(prev.edges);
    setUndoStack((s) => s.slice(0, -1));
  };

  const handleRedo = () => {
    if (redoStack.length === 0) return;
    const next = redoStack[redoStack.length - 1];
    setUndoStack((s) => [...s, { nodes: [...nodes], edges: [...edges] }]);
    setNodes(next.nodes);
    setEdges(next.edges);
    setRedoStack((s) => s.slice(0, -1));
  };

  // D3 simulation
  useEffect(() => {
    if (!svgRef.current || nodes.length === 0) return;
    const svg = d3.select(svgRef.current);
    svg.selectAll("g.edge-group").remove();
    svg.selectAll("g.node-group").remove();

    const edgeG = svg.append("g").attr("class", "edge-group");
    const nodeG = svg.append("g").attr("class", "node-group");

    const simNodes = nodes.map((n) => ({ ...n }));
    const simEdges = edges.map((e) => ({ ...e }));

    if (simEdges.length > 0) {
      const sim = d3.forceSimulation(simNodes as any)
        .force("link", d3.forceLink(simEdges).id((d: any) => d.id).distance(100))
        .force("charge", d3.forceManyBody().strength(-200))
        .force("center", d3.forceCenter(w / 2, h / 2))
        .force("collide", d3.forceCollide(25));

      // Lines
      edgeG.selectAll("line").data(simEdges).join("line")
        .attr("stroke", (d) => d.color).attr("stroke-width", (d) => d.thickness)
        .attr("opacity", 0.5).attr("marker-end", (d) => d.directed ? "url(#arrowhead)" : "");

      // Arrow marker
      svg.append("defs").append("marker")
        .attr("id", "arrowhead").attr("viewBox", "0 0 10 10")
        .attr("refX", 20).attr("refY", 5).attr("markerWidth", 8).attr("markerHeight", 8)
        .attr("orient", "auto-start-reverse")
        .append("path").attr("d", "M 0 0 L 10 5 L 0 10 z").attr("fill", "var(--peach)");

      // Nodes
      const nodeSel = nodeG.selectAll("g").data(simNodes).join("g")
        .call(d3.drag<any, any>().on("start", (_event, d: any) => { if (!_event.active) sim.alphaTarget(0.3).restart(); d.fx = d.x; d.fy = d.y; })
          .on("drag", (_event, d: any) => { d.fx = _event.x; d.fy = _event.y; })
          .on("end", (_event, d: any) => { if (!_event.active) sim.alphaTarget(0); d.fx = null; d.fy = null; }) as any)
        .on("click", (_event, d: any) => { setSelectedNodeId(d.id); setSelectedEdgeId(null); });

      nodeSel.append("circle").attr("r", (d: any) => d.size).attr("fill", (d: any) => d.color).attr("stroke", "#fff").attr("stroke-width", 2);
      nodeSel.append("text").attr("dy", (d: any) => -d.size - 4).attr("text-anchor", "middle")
        .attr("font-size", 10).attr("fill", "var(--text-secondary)").text((d: any) => d.label.slice(0, 15));

      sim.on("tick", () => {
        edgeG.selectAll("line")
          .attr("x1", (d: any) => d.source.x).attr("y1", (d: any) => d.source.y)
          .attr("x2", (d: any) => d.target.x).attr("y2", (d: any) => d.target.y);
        nodeSel.attr("transform", (d: any) => `translate(${d.x},${d.y})`);
      });
    } else {
      // Just render nodes without simulation
      nodeG.selectAll("g").data(simNodes).join("g")
        .attr("transform", (d) => `translate(${d.x},${d.y})`)
        .call(d3.drag<any, any>().on("drag", (_event: any, d: any) => {
          setNodes((prev) => prev.map((n) => n.id === d.id ? { ...n, x: _event.x, y: _event.y } : n));
        }) as any)
        .on("click", (_event, d: any) => { setSelectedNodeId(d.id); setSelectedEdgeId(null); });

      nodeG.selectAll("circle").data(simNodes).join("circle")
        .attr("r", (d) => d.size).attr("fill", (d) => d.color).attr("stroke", "#fff").attr("stroke-width", 2);
      nodeG.selectAll("text").data(simNodes).join("text")
        .attr("dy", (d) => -d.size - 4).attr("text-anchor", "middle").attr("font-size", 10)
        .attr("fill", "var(--text-secondary)").text((d) => d.label.slice(0, 15));
    }

    // Cleanup
    return () => { svg.selectAll("g.edge-group").remove(); svg.selectAll("g.node-group").remove(); };
  }, [nodes, edges, w, h]);

  const selectedNode = nodes.find((n) => n.id === selectedNodeId);

  return (
    <div className="flex h-full flex-col" style={{ backgroundColor: "var(--bg-primary)" }}>
      {/* Top bar */}
      <div className="flex items-center gap-2 border-b px-3 py-1.5" style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-panel)" }}>
        <button onClick={() => toast.info("Back", "Return to the previous view")}
          className="flex items-center gap-1 rounded p-1 hover:bg-gray-100" title="Back"><ArrowLeft size={14} opacity={0.5} /></button>
        <input value={networkName} onChange={(e) => setNetworkName(e.target.value)}
          className="rounded border px-2 py-1 text-sm font-semibold outline-none w-[200px]"
          style={{ borderColor: "var(--border)", backgroundColor: "transparent", color: "var(--text-primary)" }} />
        <button onClick={() => toast.success("Saved", "Network saved")}
          className="flex items-center gap-1 rounded px-2 py-1 text-[11px] hover:bg-gray-100 min-touch" style={{ color: "var(--text-secondary)" }}>
          <Save size={12} /> Save
        </button>
        <div className="flex-1" />
        <div className="flex items-center gap-0.5">
          {([{ id: "select", icon: MousePointer2 }, { id: "move", icon: Hand }, { id: "add-node", icon: Plus }] as const).map((t) => (
            <button key={t.id} onClick={() => setTool(t.id)}
              className={`rounded p-1.5 min-touch ${tool === t.id ? "bg-peach-500 text-white" : "hover:bg-gray-100"}`}
              style={{ color: tool === t.id ? "#fff" : "var(--text-secondary)" }} title={t.id}>
              <t.icon size={14} />
            </button>
          ))}
          <div className="w-px h-5 opacity-20 mx-1" style={{ backgroundColor: "var(--text-secondary)" }} />
          <button onClick={handleUndo} className="rounded p-1.5 hover:bg-gray-100 min-touch"><Undo2 size={14} /></button>
          <button onClick={handleRedo} className="rounded p-1.5 hover:bg-gray-100 min-touch"><Redo2 size={14} /></button>
          <button onClick={() => toast.info("Export", "Exporting network...")}
            className="rounded p-1.5 hover:bg-gray-100 min-touch"><Download size={14} opacity={0.5} /></button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Left — node/edge types */}
        <div className="w-[200px] flex-shrink-0 border-r flex flex-col" style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-panel)" }}>
          <div className="border-b px-3 py-2 text-[10px] font-semibold uppercase opacity-30" style={{ borderColor: "var(--border)" }}>Node types</div>
          <div className="p-2 space-y-1">
            {[
              { label: "Category", type: "category", color: "#F1D7FF" },
              { label: "Document", type: "document", color: "#2196F3" },
              { label: "Segment", type: "segment", color: "#4CAF50" },
              { label: "Memo", type: "memo", color: "#9C27B0" },
              { label: "Free text", type: "text", color: "#607D8B" },
              { label: "Concept", type: "concept", color: "#F1D7FF" },
            ].map((nt) => (
              <div key={nt.type} draggable onDragStart={(e) => { e.dataTransfer.setData("text/plain", JSON.stringify({ name: nt.label, color: nt.color, id: nt.type })); }}
                className="flex items-center gap-2 rounded px-2 py-1.5 text-[11px] cursor-grab hover:bg-gray-50"
                style={{ color: "var(--text-primary)" }}>
                <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: nt.color }} /> {nt.label}
              </div>
            ))}
          </div>
        </div>

        {/* Center — SVG canvas */}
        <div className="flex-1 overflow-hidden" onDragOver={handleDragOver} onDrop={handleDrop}>
          <svg ref={svgRef} width="100%" height="100%"
            style={{
              backgroundImage: showGrid ? "radial-gradient(circle, #ddd 1px, transparent 1px)" : undefined,
              backgroundSize: "20px 20px",
              cursor: tool === "move" ? "grab" : tool === "add-node" ? "crosshair" : "default",
            }}
            onClick={(e) => {
              if (tool !== "add-node") return;
              const rect = svgRef.current?.getBoundingClientRect();
              if (!rect) return;
              pushUndo();
              const node: NetworkNode = {
                id: `nn-${Date.now()}`, type: "concept",
                label: "New node", color: "#F1D7FF",
                x: e.clientX - rect.left, y: e.clientY - rect.top,
                size: 20, shape: "circle",
              };
              setNodes((prev) => [...prev, node]);
            }} />
        </div>

        {/* Right — properties */}
        <div className="w-[260px] flex-shrink-0 border-l flex flex-col" style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-panel)" }}>
          <div className="border-b px-3 py-2 text-[10px] font-semibold uppercase opacity-30" style={{ borderColor: "var(--border)" }}>Properties</div>
          <div className="flex-1 overflow-y-auto p-3">
            {selectedNode ? (
              <div className="space-y-3 text-xs">
                <div>
                  <label className="block text-[10px] opacity-40 mb-0.5">Label</label>
                  <input value={selectedNode.label} onChange={(e) => setNodes((prev) => prev.map((n) => n.id === selectedNodeId ? { ...n, label: e.target.value } : n))}
                    className="w-full rounded border px-2 py-1.5 outline-none text-xs"
                    style={{ borderColor: "var(--border)", color: "var(--text-primary)" }} />
                </div>
                <div>
                  <label className="block text-[10px] opacity-40 mb-0.5">Color</label>
                  <input type="color" value={selectedNode.color}
                    onChange={(e) => setNodes((prev) => prev.map((n) => n.id === selectedNodeId ? { ...n, color: e.target.value } : n))}
                    className="w-8 h-7 cursor-pointer rounded border" style={{ borderColor: "var(--border)" }} />
                </div>
                <div>
                  <label className="block text-[10px] opacity-40 mb-0.5">Shape</label>
                  <div className="flex gap-1">
                    {NODE_SHAPES.map((s) => (
                      <button key={s.id} onClick={() => setNodes((prev) => prev.map((n) => n.id === selectedNodeId ? { ...n, shape: s.id } : n))}
                        className={`rounded p-1 min-touch ${selectedNode.shape === s.id ? "bg-peach-100" : "hover:bg-gray-100"}`}
                        title={s.label}><span style={{ color: selectedNode.shape === s.id ? "#000" : "#000" }}><s.icon size={14} /></span></button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="block text-[10px] opacity-40 mb-0.5">Size</label>
                  <input type="range" min={10} max={60} value={selectedNode.size}
                    onChange={(e) => setNodes((prev) => prev.map((n) => n.id === selectedNodeId ? { ...n, size: Number(e.target.value) } : n))}
                    className="w-full" style={{ accentColor: "var(--peach)" }} />
                </div>
                <button onClick={() => {
                  pushUndo();
                  setNodes((prev) => prev.filter((n) => n.id !== selectedNodeId));
                  setSelectedNodeId(null);
                }} className="flex items-center gap-1 rounded px-2 py-1 text-[11px] text-red-500 hover:bg-red-50 min-touch">
                  <Trash2 size={12} /> Delete node
                </button>
              </div>
            ) : (
              <p className="text-[10px] opacity-20 text-center pt-6">Select a node to edit properties</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default NetworkEditor;
