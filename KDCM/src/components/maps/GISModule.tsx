import { useState, useEffect, useRef } from "react";
import {
  MapPin, Layers, ZoomIn, ZoomOut, Maximize2,
  Ruler, Camera, Download, X, Target, Navigation, Filter, Trash2, Pencil,
  Plus, Search, Copy, Check, Square, Minus,
} from "lucide-react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { useToast } from "../../stores/toastStore";
import { saveGISCategory } from "../../lib/tauriBridge";
import { useProjectStore } from "../../stores/projectStore";

/* ── Fix default Leaflet icon paths ── */
import markerIcon2x from "leaflet/dist/images/marker-icon-2x.png";
import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";

delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({ iconRetinaUrl: markerIcon2x, iconUrl: markerIcon, shadowUrl: markerShadow });

/* ── Exported types ── */

export interface GISPoint {
  id: string;
  lat: number;
  lng: number;
  name: string;
  description: string;
  category: string;
  color: string;
}

/* ── Internal types ── */

type BaseMap = "osm" | "satellite" | "relief" | "none";
type GISTool = "move" | "marker" | "region" | "line" | "measure";

interface GISCategory {
  id: string;
  name: string;
  color: string;
  visible: boolean;
}

const DEFAULT_CAT_COLORS = ["#2196F3", "#4CAF50", "#F44336", "#F1D7FF", "#9C27B0", "#00BCD4", "#FF5722", "#607D8B"];

const BASEMAP_TILES: Record<BaseMap, { url: string; attribution: string } | null> = {
  osm:       { url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", attribution: "© OpenStreetMap" },
  satellite: { url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", attribution: "© Esri" },
  relief:    { url: "https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png", attribution: "© OpenTopoMap" },
  none:      null,
};

/* ── Props ── */

interface GISModuleProps {
  docName?: string | null;
  initialPoints?: GISPoint[];
  standalone?: boolean;
  onSave?: (points: GISPoint[], name: string) => void;
  onDelete?: () => void;
}

/* ── Main ── */

export function GISModule({
  docName = null,
  initialPoints = [],
  standalone = false,
  onSave,
  onDelete,
}: GISModuleProps) {
  const mapRef = useRef<L.Map | null>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const tileLayerRef = useRef<L.TileLayer | null>(null);

  const [basemap, setBasemap] = useState<BaseMap>("osm");
  const [categories, setCategories] = useState<GISCategory[]>([]);
  const [points, setPoints] = useState<GISPoint[]>(initialPoints);
  const [selectedPointId, setSelectedPointId] = useState<string | null>(null);
  const [tool, setTool] = useState<GISTool>("move");
  const [measurePoints, setMeasurePoints] = useState<L.LatLng[]>([]);
  const [measurePolyline, setMeasurePolyline] = useState<L.Polyline | null>(null);
  const [editName, setEditName] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [editLat, setEditLat] = useState("");
  const [editLng, setEditLng] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; lat: number; lng: number } | null>(null);
  const [contextAddress, setContextAddress] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [newMarkerCat, setNewMarkerCat] = useState("");
  const [showNewMarkerPanel, setShowNewMarkerPanel] = useState(false);
  const [pendingMarker, setPendingMarker] = useState<{ lat: number; lng: number } | null>(null);
  const [newMarkerName, setNewMarkerName] = useState("");
  const [newMarkerDesc, setNewMarkerDesc] = useState("");
  const [newCatName, setNewCatName] = useState("");
  const [newCatColor, setNewCatColor] = useState(DEFAULT_CAT_COLORS[0]);
  const [showAddCategory, setShowAddCategory] = useState(false);
  const [docNameState, setDocNameState] = useState(docName ?? (standalone ? "" : "New geographic document"));
  const { toast } = useToast();

  const selectedPoint = points.find((p) => p.id === selectedPointId);
  const visiblePoints = points.filter((p) => {
    const cat = categories.find((c) => c.name === p.category);
    return cat?.visible ?? true;
  });

  // ── Sync initialPoints when prop changes ──
  useEffect(() => {
    setPoints(initialPoints);
  }, [initialPoints]);

  // ── Init map ──
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    // Center on first point if available, otherwise default
    const center: [number, number] = initialPoints.length > 0
      ? [initialPoints[0].lat, initialPoints[0].lng]
      : [4.711, -74.072];
    const zoom = initialPoints.length > 0 ? 14 : 13;

    const map = L.map(mapContainerRef.current, {
      center, zoom,
      zoomControl: false,
      attributionControl: true,
    });
    mapRef.current = map;

    const tileUrl = BASEMAP_TILES["osm"]!.url;
    const tileAttrib = BASEMAP_TILES["osm"]!.attribution;
    tileLayerRef.current = L.tileLayer(tileUrl, { attribution: tileAttrib }).addTo(map);

    // Right-click context menu
    map.on("contextmenu", (e) => {
      setContextMenu({
        x: (e as any).originalEvent.clientX,
        y: (e as any).originalEvent.clientY,
        lat: e.latlng.lat, lng: e.latlng.lng,
      });
      setContextAddress(null);
      fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${e.latlng.lat}&lon=${e.latlng.lng}`)
        .then((r) => r.json()).then((d) => { if (d?.display_name) setContextAddress(d.display_name); }).catch(() => {});
    });

    map.on("click", () => { setContextMenu(null); });

    // Fit bounds if initial points exist
    if (initialPoints.length > 0) {
      const bounds = L.latLngBounds(initialPoints.map((p) => [p.lat, p.lng]));
      map.fitBounds(bounds.pad(0.2));
    }

    return () => { map.remove(); mapRef.current = null; tileLayerRef.current = null; };
  }, []);

  // ── Change basemap ──
  useEffect(() => {
    if (!mapRef.current) return;
    if (tileLayerRef.current) { mapRef.current.removeLayer(tileLayerRef.current); tileLayerRef.current = null; }
    const cfg = BASEMAP_TILES[basemap];
    if (cfg) {
      tileLayerRef.current = L.tileLayer(cfg.url, { attribution: cfg.attribution }).addTo(mapRef.current);
    }
  }, [basemap]);

  // ── Map click handler ──
  useEffect(() => {
    if (!mapRef.current) return;
    const map = mapRef.current;

    const handler = (e: L.LeafletMouseEvent) => {
      if (tool === "marker") {
        setPendingMarker({ lat: e.latlng.lat, lng: e.latlng.lng });
        setNewMarkerName("");
        setNewMarkerDesc("");
        setNewMarkerCat(categories[0]?.name ?? "");
        setShowNewMarkerPanel(true);
      } else if (tool === "measure") {
        const newPts = [...measurePoints, e.latlng];
        setMeasurePoints(newPts);
        if (measurePolyline) map.removeLayer(measurePolyline);
        const poly = L.polyline(newPts, { color: "#F44336", weight: 2, dashArray: "6 4" }).addTo(map);
        setMeasurePolyline(poly);
      } else if (tool === "region") {
        toast.info("Region tool", "Click opposite corners to draw a rectangle region");
        // Reset to move after first click; region drawing is complex, keep as placeholder for now
        setTool("move");
      } else if (tool === "line") {
        toast.info("Line tool", "Click to add vertices. Double-click to finish.");
        setTool("move");
      }
    };

    map.on("click", handler);
    return () => { map.off("click", handler); };
  }, [tool, measurePoints, measurePolyline]);

  // ── Update markers on map ──
  useEffect(() => {
    if (!mapRef.current) return;
    const map = mapRef.current;
    // Remove existing markers
    map.eachLayer((layer) => {
      if (layer instanceof L.Marker || layer instanceof L.CircleMarker) {
        // Don't remove tile layers
        if (!(layer instanceof L.TileLayer)) {
          map.removeLayer(layer);
        }
      }
    });

    // Create custom colored circle markers
    visiblePoints.forEach((pt) => {
      const circle = L.circleMarker([pt.lat, pt.lng], {
        radius: 8,
        fillColor: pt.color,
        color: "#fff",
        weight: 2,
        opacity: 1,
        fillOpacity: 0.8,
      });
      circle.bindTooltip(pt.name, { direction: "top", offset: [0, -8] });
      circle.on("click", (ev) => {
        L.DomEvent.stopPropagation(ev);
        setSelectedPointId(pt.id);
      });
      circle.addTo(map);
    });

    // Re-add measure polyline
    if (measurePolyline) measurePolyline.addTo(map);
  }, [visiblePoints, measurePolyline]);

  /* ── Handlers ── */

  const addCategory = () => {
    if (!newCatName.trim()) return;
    const cat: GISCategory = {
      id: `gcat-${Date.now()}`,
      name: newCatName.trim(),
      color: newCatColor,
      visible: true,
    };
    setCategories((prev) => [...prev, cat]);
    setNewCatName("");
    setNewCatColor(DEFAULT_CAT_COLORS[new Date().getTime() % DEFAULT_CAT_COLORS.length]);
    setShowAddCategory(false);
    // Persist to SQLite
    const proyectoId = useProjectStore.getState().project?.id;
    if (proyectoId) {
      saveGISCategory(cat.id, proyectoId, cat.name, cat.color).catch(() => {});
    }
    // If no category was selected for new marker, auto-select this one
    if (!newMarkerCat) setNewMarkerCat(cat.name);
    toast.success("Category created", cat.name);
  };

  const handleDeleteCategory = (id: string) => {
    const cat = categories.find((c) => c.id === id);
    setCategories((prev) => prev.filter((c) => c.id !== id));
    if (cat && newMarkerCat === cat.name) setNewMarkerCat("");
    toast.success("Category removed", cat?.name);
  };

  const handleCreateMarker = () => {
    if (!pendingMarker || !newMarkerName.trim()) return;
    const cat = categories.find((c) => c.name === newMarkerCat);
    const color = cat?.color ?? "#F1D7FF";
    const category = cat?.name ?? "Uncategorized";
    const pt: GISPoint = {
      id: `pt-${Date.now()}`,
      lat: pendingMarker.lat, lng: pendingMarker.lng,
      name: newMarkerName.trim(), description: newMarkerDesc.trim(),
      category, color,
    };
    const updated = [...points, pt];
    setPoints(updated);
    setShowNewMarkerPanel(false);
    setPendingMarker(null);
    setTool("move");
    toast.success("Marker created", pt.name);
  };

  const handleDeletePoint = (id: string) => {
    setPoints((prev) => prev.filter((p) => p.id !== id));
    if (selectedPointId === id) setSelectedPointId(null);
    toast.success("Deleted", "Marker removed");
  };

  const handleSavePoint = () => {
    if (!selectedPointId) return;
    const lat = parseFloat(editLat);
    const lng = parseFloat(editLng);
    if (isNaN(lat) || isNaN(lng)) return;
    setPoints((prev) => prev.map((p) => p.id === selectedPointId ? { ...p, name: editName, description: editDesc, lat, lng } : p));
    toast.success("Saved", "Marker updated");
  };

  const handleSearchAddress = async () => {
    if (!searchQuery.trim()) return;
    setSearching(true);
    try {
      const r = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery)}`);
      const results = await r.json();
      if (results.length > 0) {
        const { lat, lon } = results[0];
        mapRef.current?.flyTo([parseFloat(lat), parseFloat(lon)], 15, { duration: 1.2 });
        toast.success("Found", results[0].display_name.slice(0, 60));
      } else {
        toast.info("Not found", "No results for that address");
      }
    } catch { toast.info("Error", "Search failed. Try again."); }
    setSearching(false);
  };

  const handleExportPNG = () => {
    toast.info("Export", "PNG export with scale bar + north arrow + legend");
  };

  const handleExportGeoJSON = () => {
    const geojson = {
      type: "FeatureCollection",
      features: points.map((p) => ({
        type: "Feature",
        geometry: { type: "Point", coordinates: [p.lng, p.lat] },
        properties: { name: p.name, description: p.description, category: p.category },
      })),
    };
    const blob = new Blob([JSON.stringify(geojson, null, 2)], { type: "application/geo+json" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "map.geojson"; a.click();
    toast.success("Exported", "GeoJSON downloaded");
  };

  const handleSaveDoc = () => {
    onSave?.(points, docNameState || "Untitled geographic document");
  };

  const toggleCategory = (id: string) => {
    setCategories((prev) => prev.map((c) => c.id === id ? { ...c, visible: !c.visible } : c));
  };

  const finishMeasuring = () => {
    if (measurePoints.length >= 2) {
      let totalDist = 0;
      for (let i = 1; i < measurePoints.length; i++) {
        totalDist += measurePoints[i - 1].distanceTo(measurePoints[i]);
      }
      const km = (totalDist / 1000).toFixed(2);
      toast.info("Distance", `≈ ${km} km`);
    }
    if (measurePolyline) mapRef.current?.removeLayer(measurePolyline);
    setMeasurePoints([]);
    setMeasurePolyline(null);
    setTool("move");
  };

  // Sync editing state
  useEffect(() => {
    if (selectedPoint) {
      setEditName(selectedPoint.name);
      setEditDesc(selectedPoint.description);
      setEditLat(selectedPoint.lat.toString());
      setEditLng(selectedPoint.lng.toString());
    }
  }, [selectedPoint]);

  return (
    <div className="flex h-full flex-col" style={{ backgroundColor: "var(--bg-primary)" }}>
      {/* Toolbar */}
      <div className="flex items-center gap-1 border-b px-3 py-1.5 flex-wrap" style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-panel)" }}>
        {/* Basemap selector */}
        <div className="flex items-center gap-0.5 mr-2">
          <Layers size={12} opacity={0.4} />
          {(["osm","satellite","relief","none"] as BaseMap[]).map((bm) => (
            <button key={bm} onClick={() => setBasemap(bm)}
              className={`rounded px-2 py-1 text-[10px] font-medium capitalize min-touch ${basemap === bm ? "bg-peach-500 text-white" : "hover:bg-gray-100"}`}
              style={{ color: basemap === bm ? "#fff" : "var(--text-secondary)" }}>
              {bm === "osm" ? "Streets" : bm === "satellite" ? "Satellite" : bm === "relief" ? "Relief" : "None"}
            </button>
          ))}
        </div>
        <div className="w-px h-5 opacity-20" style={{ backgroundColor: "var(--text-secondary)" }} />

        {/* Tools */}
        <button onClick={() => { setTool("move"); setSelectedPointId(null); }}
          className={`rounded p-1.5 min-touch ${tool === "move" && !showNewMarkerPanel ? "bg-peach-100" : "hover:bg-gray-100"}`}
          style={{ color: tool === "move" ? "#000" : "#000" }} title="Move / Select">
          <Target size={14} />
        </button>
        <button onClick={() => setTool("marker")}
          className={`rounded p-1.5 min-touch ${tool === "marker" ? "bg-peach-100" : "hover:bg-gray-100"}`}
          style={{ color: tool === "marker" ? "#000" : "#000" }} title="New marker">
          <MapPin size={14} />
        </button>
        <button onClick={() => setTool("region")}
          className={`rounded p-1.5 min-touch ${tool === "region" ? "bg-peach-100" : "hover:bg-gray-100"}`}
          style={{ color: tool === "region" ? "#000" : "#000" }} title="New region">
          <Square size={14} />
        </button>
        <button onClick={() => setTool("line")}
          className={`rounded p-1.5 min-touch ${tool === "line" ? "bg-peach-100" : "hover:bg-gray-100"}`}
          style={{ color: tool === "line" ? "#000" : "#000" }} title="New line">
          <Minus size={14} />
        </button>
        <button onClick={() => { setTool("measure"); setMeasurePoints([]); if (measurePolyline) { mapRef.current?.removeLayer(measurePolyline); setMeasurePolyline(null); } }}
          className={`rounded p-1.5 min-touch ${tool === "measure" ? "bg-peach-100" : "hover:bg-gray-100"}`}
          style={{ color: tool === "measure" ? "#000" : "#000" }} title="Measure distance">
          <Ruler size={14} />
        </button>
        {tool === "measure" && measurePoints.length > 0 && (
          <button onClick={finishMeasuring}
            className="rounded px-2 py-1 text-[10px] font-medium bg-green-100 text-green-700 hover:bg-green-200 min-touch">
            Finish ({measurePoints.length} pts)
          </button>
        )}

        <div className="w-px h-5 opacity-20" style={{ backgroundColor: "var(--text-secondary)" }} />

        {/* Search */}
        <div className="flex items-center gap-1">
          <Search size={12} opacity={0.3} />
          <input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") handleSearchAddress(); }}
            placeholder="Search address..."
            className="w-[140px] bg-transparent text-[10px] outline-none" style={{ color: "var(--text-primary)" }} />
          <button onClick={handleSearchAddress} disabled={searching}
            className="rounded px-2 py-1 text-[10px] font-medium bg-peach-500 text-white hover:bg-peach-700 min-touch disabled:opacity-40">
            {searching ? "..." : "Go"}
          </button>
        </div>

        <div className="flex-1" />

        {/* Doc name (standalone mode) */}
        {standalone && (
          <input value={docNameState} onChange={(e) => setDocNameState(e.target.value)}
            placeholder="Document name"
            className="w-[160px] rounded border px-2 py-0.5 text-[10px] outline-none"
            style={{ borderColor: "var(--border)", color: "var(--text-primary)", backgroundColor: "transparent" }} />
        )}

        {/* Save / Zoom / Export */}
        {onSave && (
          <button onClick={handleSaveDoc}
            className="rounded px-2 py-1 text-[10px] font-medium bg-peach-500 text-white hover:bg-peach-700 min-touch">
            Save
          </button>
        )}
        {onDelete && (
          <button onClick={onDelete}
            className="rounded px-2 py-1 text-[10px] font-medium text-red-500 hover:bg-red-50 min-touch">
            Delete
          </button>
        )}
        <button onClick={() => mapRef.current?.zoomIn()} className="rounded p-1.5 hover:bg-gray-100 min-touch"><ZoomIn size={14} opacity={0.5} /></button>
        <button onClick={() => mapRef.current?.zoomOut()} className="rounded p-1.5 hover:bg-gray-100 min-touch"><ZoomOut size={14} opacity={0.5} /></button>
        <button onClick={() => { if (points.length > 0) { const allPts = visiblePoints.map((p) => L.latLng(p.lat, p.lng)); const bounds = L.latLngBounds(allPts); mapRef.current?.fitBounds(bounds.pad(0.1)); } }}
          className="rounded p-1.5 hover:bg-gray-100 min-touch"><Maximize2 size={14} opacity={0.5} /></button>
        <button onClick={handleExportPNG} className="rounded p-1.5 hover:bg-gray-100 min-touch" title="Export PNG"><Camera size={14} opacity={0.5} /></button>
        <button onClick={handleExportGeoJSON} className="rounded p-1.5 hover:bg-gray-100 min-touch" title="Export GeoJSON"><Download size={14} opacity={0.5} /></button>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Map */}
        <div className="flex-1 relative">
          <div ref={mapContainerRef} className="w-full h-full" style={{ minHeight: 400, zIndex: 0 }} />

          {/* New marker floating panel */}
          {showNewMarkerPanel && pendingMarker && (
            <div className="absolute top-4 left-4 z-[1000] w-[280px] rounded-lg border shadow-xl p-3"
              style={{ backgroundColor: "var(--bg-panel)", borderColor: "var(--border)" }}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold" style={{ color: "var(--text-primary)" }}>New marker</span>
                <button onClick={() => { setShowNewMarkerPanel(false); setPendingMarker(null); }} className="rounded p-0.5 hover:bg-gray-100"><X size={13} /></button>
              </div>
              <input value={newMarkerName} onChange={(e) => setNewMarkerName(e.target.value)}
                placeholder="Name *" autoFocus
                className="w-full rounded border px-2.5 py-1.5 text-xs outline-none mb-2"
                style={{ borderColor: "var(--border)", color: "var(--text-primary)" }} />
              <textarea value={newMarkerDesc} onChange={(e) => setNewMarkerDesc(e.target.value)}
                placeholder="Description (optional)" rows={2}
                className="w-full rounded border px-2.5 py-1.5 text-xs outline-none resize-none mb-2"
                style={{ borderColor: "var(--border)", color: "var(--text-primary)" }} />
              <div className="mb-2">
                <label className="block text-[9px] opacity-40 mb-0.5">GIS Category</label>
                <select value={newMarkerCat} onChange={(e) => setNewMarkerCat(e.target.value)}
                  className="w-full rounded border px-2.5 py-1.5 text-xs outline-none"
                  style={{ borderColor: "var(--border)", color: "var(--text-primary)" }}>
                  {categories.length === 0 && <option value="">— No categories —</option>}
                  {categories.map((c) => (<option key={c.id} value={c.name}>{c.name}</option>))}
                </select>
              </div>
              <div className="text-[9px] opacity-30 mb-2 font-mono">
                {pendingMarker.lat.toFixed(6)}, {pendingMarker.lng.toFixed(6)}
              </div>
              <div className="flex justify-end gap-1.5">
                <button onClick={() => { setShowNewMarkerPanel(false); setPendingMarker(null); }}
                  className="rounded border px-2.5 py-1.5 text-[10px] min-touch"
                  style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}>Cancel</button>
                <button onClick={handleCreateMarker} disabled={!newMarkerName.trim()}
                  className="rounded bg-peach-500 px-3 py-1.5 text-[10px] font-medium text-white hover:bg-peach-700 disabled:opacity-30 min-touch">
                  Save
                </button>
              </div>
            </div>
          )}

          {/* Tool indicator */}
          {tool !== "move" && (
            <div className="absolute bottom-3 left-3 z-[1000] rounded-full px-3 py-1 text-[10px] font-medium shadow"
              style={{ backgroundColor: "var(--peach)", color: "#fff" }}>
              {tool === "marker" ? "Click on map to place marker"
                : tool === "region" ? "Click to draw region"
                : tool === "line" ? "Click to draw line"
                : "Click to start measuring"}
            </div>
          )}

          {/* Context menu */}
          {contextMenu && (
            <>
              <div className="fixed inset-0 z-[1000]" onClick={() => setContextMenu(null)} />
              <div className="fixed z-[1010] min-w-[200px] rounded-lg border py-1 shadow-xl"
                style={{
                  left: Math.min(contextMenu.x, window.innerWidth - 210),
                  top: Math.min(contextMenu.y, window.innerHeight - 200),
                  borderColor: "var(--border)", backgroundColor: "var(--bg-panel)",
                }}>
                <div className="px-3 py-1 text-[10px] font-mono opacity-30">
                  {contextMenu.lat.toFixed(6)}, {contextMenu.lng.toFixed(6)}
                </div>
                {contextAddress && (
                  <div className="px-3 py-1 text-[9px] opacity-40 max-w-[200px] truncate">{contextAddress}</div>
                )}
                <button onClick={() => { navigator.clipboard.writeText(`${contextMenu.lat}, ${contextMenu.lng}`); setCopied(true); setTimeout(() => setCopied(false), 1500); setContextMenu(null); }}
                  className="flex w-full items-center gap-2 px-3 py-1 text-[10px] hover:bg-gray-100 min-touch" style={{ color: "var(--text-primary)" }}>
                  {copied ? <Check size={11} /> : <Copy size={11} />} Copy coordinates
                </button>
                <button onClick={() => {
                  setPendingMarker({ lat: contextMenu.lat, lng: contextMenu.lng });
                  setNewMarkerName(""); setNewMarkerDesc("");
                  setNewMarkerCat(categories[0]?.name ?? "");
                  setShowNewMarkerPanel(true);
                  setContextMenu(null);
                }}
                  className="flex w-full items-center gap-2 px-3 py-1 text-[10px] hover:bg-gray-100 min-touch" style={{ color: "#000" }}>
                  <Plus size={11} /> Create marker here
                </button>
              </div>
            </>
          )}
        </div>

        {/* Right panel */}
        <div className="w-[260px] flex-shrink-0 border-l flex flex-col" style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-panel)" }}>
          {/* Category filters — user created */}
          <div className="border-b px-3 py-2.5" style={{ borderColor: "var(--border)" }}>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-[10px] font-semibold uppercase opacity-30 flex items-center gap-1">
                <Filter size={10} /> GIS Categories
              </h3>
              <button onClick={() => setShowAddCategory(!showAddCategory)}
                className="rounded p-0.5 hover:bg-gray-100 min-touch" title="New category">
                <Plus size={12} opacity={0.4} />
              </button>
            </div>

            {/* Add category form */}
            {showAddCategory && (
              <div className="mb-2 rounded border p-2 space-y-1.5" style={{ borderColor: "var(--border)" }}>
                <input value={newCatName} onChange={(e) => setNewCatName(e.target.value)}
                  placeholder="Category name" autoFocus
                  className="w-full rounded border px-2 py-1 text-[10px] outline-none"
                  style={{ borderColor: "var(--border)", color: "var(--text-primary)" }}
                  onKeyDown={(e) => { if (e.key === "Enter") addCategory(); if (e.key === "Escape") setShowAddCategory(false); }} />
                <div className="flex items-center gap-1.5">
                  <span className="text-[9px] opacity-30">Color:</span>
                  {DEFAULT_CAT_COLORS.slice(0, 6).map((c) => (
                    <button key={c} onClick={() => setNewCatColor(c)}
                      className="h-4 w-4 rounded-full border-2 transition-transform"
                      style={{ backgroundColor: c, borderColor: newCatColor === c ? "var(--text-primary)" : "transparent", transform: newCatColor === c ? "scale(1.2)" : "scale(1)" }} />
                  ))}
                </div>
                <div className="flex justify-end gap-1">
                  <button onClick={() => setShowAddCategory(false)}
                    className="rounded px-2 py-0.5 text-[9px] min-touch" style={{ color: "var(--text-secondary)" }}>Cancel</button>
                  <button onClick={addCategory} disabled={!newCatName.trim()}
                    className="rounded bg-peach-500 px-2 py-0.5 text-[9px] font-medium text-white hover:bg-peach-700 disabled:opacity-30 min-touch">
                    Create
                  </button>
                </div>
              </div>
            )}

            {categories.length === 0 && !showAddCategory ? (
              <p className="text-[10px] opacity-20 text-center py-2">
                No categories yet.<br/>Click <Plus size={8} className="inline" /> to create one.
              </p>
            ) : (
              categories.map((cat) => (
                <label key={cat.id} className="flex items-center gap-2 py-1 cursor-pointer text-[11px] group" style={{ color: "var(--text-primary)" }}>
                  <input type="checkbox" checked={cat.visible} onChange={() => toggleCategory(cat.id)}
                    style={{ accentColor: cat.color }} />
                  <span className="inline-block h-2.5 w-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: cat.color }} />
                  <span className="flex-1 truncate">{cat.name}</span>
                  <button onClick={(e) => { e.stopPropagation(); handleDeleteCategory(cat.id); }}
                    className="rounded p-0.5 opacity-0 group-hover:opacity-50 hover:opacity-100 hover:bg-red-50 min-touch"
                    title="Delete category">
                    <X size={9} style={{ color: "#F44336" }} />
                  </button>
                </label>
              ))
            )}
          </div>

          {/* Points list */}
          <div className="flex-1 overflow-y-auto">
            <div className="px-3 py-2 text-[10px] font-semibold uppercase opacity-30">
              Elements ({visiblePoints.length})
            </div>
            {visiblePoints.length === 0 ? (
              <p className="px-3 py-6 text-[10px] opacity-20 text-center">
                No markers yet.<br/>Use the marker tool to add points.
              </p>
            ) : (
              visiblePoints.map((pt) => (
                <div key={pt.id}
                  onClick={() => { setSelectedPointId(pt.id); mapRef.current?.flyTo([pt.lat, pt.lng], 16, { duration: 0.8 }); }}
                  className={`flex items-center gap-2 px-3 py-1.5 text-xs cursor-pointer min-touch ${
                    selectedPointId === pt.id ? "" : "hover:bg-gray-50"
                  }`}
                  style={{
                    backgroundColor: selectedPointId === pt.id ? "var(--peach)" + "10" : "transparent",
                    borderLeft: selectedPointId === pt.id ? "2px solid var(--peach)" : "2px solid transparent",
                  }}>
                  <MapPin size={12} style={{ color: pt.color }} />
                  <span className="flex-1 truncate" style={{ color: "var(--text-primary)" }}>{pt.name}</span>
                  <span className="text-[9px] opacity-30">{pt.category}</span>
                </div>
              ))
            )}
          </div>

          {/* Selected point inspector */}
          {selectedPoint && (
            <div className="border-t" style={{ borderColor: "var(--border)" }}>
              <div className="flex items-center justify-between px-3 py-2 border-b" style={{ borderColor: "var(--border)" }}>
                <span className="text-xs font-semibold" style={{ color: "var(--text-primary)" }}>Inspector</span>
                <button onClick={() => setSelectedPointId(null)} className="rounded p-0.5 hover:bg-gray-100"><X size={13} /></button>
              </div>
              <div className="p-3 space-y-2 text-xs">
                <input value={editName} onChange={(e) => setEditName(e.target.value)}
                  className="w-full rounded border px-2 py-1.5 text-xs font-medium outline-none"
                  style={{ borderColor: "var(--border)", color: "var(--text-primary)" }} />
                <div className="grid grid-cols-2 gap-1.5">
                  <input value={editLat} onChange={(e) => setEditLat(e.target.value)}
                    className="rounded border px-2 py-1.5 text-[10px] font-mono outline-none"
                    style={{ borderColor: "var(--border)", color: "var(--text-primary)" }} placeholder="Lat" />
                  <input value={editLng} onChange={(e) => setEditLng(e.target.value)}
                    className="rounded border px-2 py-1.5 text-[10px] font-mono outline-none"
                    style={{ borderColor: "var(--border)", color: "var(--text-primary)" }} placeholder="Lng" />
                </div>
                <textarea value={editDesc} onChange={(e) => setEditDesc(e.target.value)} rows={2}
                  className="w-full rounded border px-2 py-1.5 text-xs outline-none resize-none"
                  style={{ borderColor: "var(--border)", color: "var(--text-primary)" }} placeholder="Description" />
                <div className="flex items-center gap-1">
                  <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: selectedPoint.color }} />
                  <span className="text-[10px] opacity-50">{selectedPoint.category}</span>
                </div>
                <div className="flex gap-1.5 pt-1">
                  <button onClick={handleSavePoint}
                    className="flex items-center gap-1 rounded bg-peach-500 px-2.5 py-1.5 text-[10px] font-medium text-white hover:bg-peach-700 min-touch">
                    <Pencil size={10} /> Save
                  </button>
                  <button onClick={() => window.open(`https://www.google.com/maps?q=${selectedPoint.lat},${selectedPoint.lng}`, "_blank")}
                    className="flex items-center gap-1 rounded border px-2.5 py-1.5 text-[10px] min-touch"
                    style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}>
                    <Navigation size={10} /> Maps
                  </button>
                  <button onClick={() => handleDeletePoint(selectedPoint.id)}
                    className="rounded p-1.5 hover:bg-red-50 min-touch" title="Delete"><Trash2 size={11} style={{ color: "#F44336" }} /></button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default GISModule;
