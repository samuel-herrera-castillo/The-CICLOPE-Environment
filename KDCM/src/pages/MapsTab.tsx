import { useState } from "react";
import { Plus, MapPin, Map as MapIcon, GitGraph, ArrowLeft, Globe } from "lucide-react";
import { EmptyState } from "../components/ui/EmptyState";
import { ConceptMapEditor, type MapElement, type MapLayer } from "../components/maps/ConceptMapEditor";
import { GISModule, type GISPoint } from "../components/maps/GISModule";
import { useProjectStore } from "../stores/projectStore";
import { saveGISMarker, getGISMarkers, saveConceptMap, deleteConceptMap } from "../lib/tauriBridge";

/* ── Types ── */

type ActiveView = "hub" | "concept" | "gis";
type ConceptMapType = "causal" | "arguments" | "cases" | "process" | "blank";

interface StoredConceptMap {
  id: string;
  name: string;
  type: ConceptMapType;
  nodes: number;
  elements: MapElement[];
  layers: MapLayer[];
}

interface StoredGeoDoc {
  id: string;
  name: string;
  markers: GISPoint[];
}

/* ── Helpers ── */

const MAP_TYPES: { id: ConceptMapType; label: string }[] = [
  { id: "causal", label: "Causal" },
  { id: "arguments", label: "Arguments" },
  { id: "cases", label: "Cases" },
  { id: "process", label: "Process" },
  { id: "blank", label: "Blank" },
];

function createEmptyMap(type: ConceptMapType): StoredConceptMap {
  return {
    id: `cm-${Date.now()}`,
    name: `New ${type} map`,
    type,
    nodes: 0,
    elements: [],
    layers: [{ id: "l1", name: "Layer 1", visible: true, locked: false, order: 0 }],
  };
}

/* ── Left panel ── */

export function MapsTabLeft() {
  // Read from parent window's state via a simple event bridge, or just show recent
  return (
    <div className="flex h-full flex-col">
      <div className="border-b px-3 py-2" style={{ borderColor: "var(--border)" }}>
        <span className="text-xs font-semibold" style={{ color: "var(--text-secondary)" }}>Recent maps</span>
      </div>
      <div className="flex-1 overflow-y-auto py-1">
        <p className="px-3 pt-6 text-[10px] opacity-20 text-center">Maps you create<br />will appear here</p>
      </div>
    </div>
  );
}

/* ── Center panel ── */

export function MapsTabCenter() {
  const [activeView, setActiveView] = useState<ActiveView>("hub");
  const [conceptMaps, setConceptMaps] = useState<StoredConceptMap[]>([]);
  const [geoDocs, setGeoDocs] = useState<StoredGeoDoc[]>([]);

  // Data passed to editors
  const [selectedMap, setSelectedMap] = useState<StoredConceptMap | null>(null);
  const [selectedGeo, setSelectedGeo] = useState<StoredGeoDoc | null>(null);

  const [showTypeDropdown, setShowTypeDropdown] = useState(false);

  /* ── Concept map actions ── */

  const handleNewConceptMap = (type: ConceptMapType) => {
    const map = createEmptyMap(type);
    setConceptMaps((prev) => [...prev, map]);
    setSelectedMap(map);
    setShowTypeDropdown(false);
    setActiveView("concept");
  };

  const handleOpenConceptMap = (map: StoredConceptMap) => {
    setSelectedMap(map);
    setActiveView("concept");
  };

  const handleSaveConceptMap = (elements: MapElement[], layers: MapLayer[], name: string) => {
    if (!selectedMap) return;
    const updated: StoredConceptMap = {
      ...selectedMap, name, elements, layers, nodes: elements.length,
    };
    setConceptMaps((prev) => prev.map((m) => (m.id === selectedMap.id ? updated : m)));
    setSelectedMap(updated);
    // Persist to SQLite
    const proyectoId = useProjectStore.getState().project?.id;
    if (proyectoId) {
      saveConceptMap(selectedMap.id, proyectoId, name, selectedMap.type, JSON.stringify({ elements, layers }), JSON.stringify(layers)).catch(() => {});
    }
  };

  const handleDeleteConceptMap = (id: string) => {
    setConceptMaps((prev) => prev.filter((m) => m.id !== id));
    if (selectedMap?.id === id) { setSelectedMap(null); setActiveView("hub"); }
    deleteConceptMap(id).catch(() => {});
  };

  /* ── Geo doc actions ── */

  const handleNewGeoDoc = () => {
    const doc: StoredGeoDoc = {
      id: `geo-${Date.now()}`,
      name: `New geographic document`,
      markers: [],
    };
    setGeoDocs((prev) => [...prev, doc]);
    setSelectedGeo(doc);
    setActiveView("gis");
  };

  const handleOpenGeoDoc = (doc: StoredGeoDoc) => {
    setSelectedGeo(doc);
    setActiveView("gis");
    // Load markers from backend
    getGISMarkers(doc.id).then((res) => {
      if (res?.rows?.length) {
        const loadedMarkers: GISPoint[] = res.rows.map((r: any) => {
          const coords = JSON.parse(r.coordenadas || r.coordenadas_json || "{}");
          return {
            id: String(r.id), lat: coords.lat || 0, lng: coords.lng || 0,
            name: r.nombre || "", description: r.descripcion || "",
            category: r.categoria || r.categoria_gis || "", color: r.color || r.color_hex || "#F1D7FF",
          };
        });
        setGeoDocs((prev) => prev.map((d) => d.id === doc.id ? { ...d, markers: loadedMarkers } : d));
        setSelectedGeo((prev) => prev ? { ...prev, markers: loadedMarkers } : null);
      }
    }).catch(() => {});
  };

  const handleOpenBlankGIS = () => {
    setSelectedGeo(null);
    setActiveView("gis");
  };

  const handleSaveGeoDoc = (points: GISPoint[], name: string) => {
    const proyectoId = useProjectStore.getState().project?.id;
    if (selectedGeo) {
      const updated: StoredGeoDoc = { ...selectedGeo, name, markers: points };
      setGeoDocs((prev) => prev.map((d) => (d.id === selectedGeo.id ? updated : d)));
      setSelectedGeo(updated);
      // Persist markers to backend
      if (proyectoId) {
        points.forEach((p) => {
          saveGISMarker(null, selectedGeo.id, proyectoId, "punto", p.name, p.description, p.category, JSON.stringify({ lat: p.lat, lng: p.lng }), p.color, null).catch(() => {});
        });
      }
    } else {
      const doc: StoredGeoDoc = {
        id: `geo-${Date.now()}`,
        name: name || "New geographic document",
        markers: points,
      };
      setGeoDocs((prev) => [...prev, doc]);
      setSelectedGeo(doc);
      if (proyectoId) {
        points.forEach((p) => {
          saveGISMarker(null, doc.id, proyectoId, "punto", p.name, p.description, p.category, JSON.stringify({ lat: p.lat, lng: p.lng }), p.color, null).catch(() => {});
        });
      }
    }
  };

  const handleDeleteGeoDoc = (id: string) => {
    setGeoDocs((prev) => prev.filter((d) => d.id !== id));
    if (selectedGeo?.id === id) {
      setSelectedGeo(null);
      setActiveView("hub");
    }
  };

  const handleBackToHub = () => {
    setActiveView("hub");
  };

  /* ── View: Concept map editor ── */

  if (activeView === "concept" && selectedMap) {
    return (
      <div className="flex h-full flex-col">
        <div className="flex items-center gap-2 border-b px-3 py-1.5" style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-panel)" }}>
          <button onClick={handleBackToHub}
            className="flex items-center gap-1 rounded px-2 py-1 text-xs hover:bg-gray-100 min-touch"
            style={{ color: "var(--text-secondary)" }}>
            <ArrowLeft size={13} /> Back to hub
          </button>
          <span className="text-xs font-semibold" style={{ color: "var(--text-primary)" }}>
            {selectedMap.name} · {selectedMap.type}
          </span>
        </div>
        <div className="flex-1 overflow-hidden">
          <ConceptMapEditor
            initialName={selectedMap.name}
            initialElements={selectedMap.elements}
            initialLayers={selectedMap.layers}
            mapType={selectedMap.type}
            onSave={(elements, layers, name) => handleSaveConceptMap(elements, layers, name)}
            onDelete={() => handleDeleteConceptMap(selectedMap.id)}
          />
        </div>
      </div>
    );
  }

  /* ── View: GIS module ── */

  if (activeView === "gis") {
    return (
      <div className="flex h-full flex-col">
        <div className="flex items-center gap-2 border-b px-3 py-1.5" style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-panel)" }}>
          <button onClick={handleBackToHub}
            className="flex items-center gap-1 rounded px-2 py-1 text-xs hover:bg-gray-100 min-touch"
            style={{ color: "var(--text-secondary)" }}>
            <ArrowLeft size={13} /> Back to hub
          </button>
          <span className="text-xs font-semibold" style={{ color: "var(--text-primary)" }}>
            {selectedGeo ? selectedGeo.name : "Geographic document — standalone"}
          </span>
        </div>
        <div className="flex-1 overflow-hidden">
          <GISModule
            docName={selectedGeo?.name ?? null}
            initialPoints={selectedGeo?.markers ?? []}
            standalone={!selectedGeo}
            onSave={(points, name) => handleSaveGeoDoc(points, name)}
            onDelete={selectedGeo ? () => handleDeleteGeoDoc(selectedGeo.id) : undefined}
          />
        </div>
      </div>
    );
  }

  /* ── View: Hub ── */

  return (
    <div className="flex-1 overflow-y-auto p-6">
      {/* Concept maps section */}
      <section className="mb-8">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
            <GitGraph size={16} style={{ color: "#000" }} /> Concept maps
          </h2>
          <div className="relative">
            <button onClick={() => setShowTypeDropdown(!showTypeDropdown)}
              className="flex items-center gap-1 rounded-md bg-peach-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-peach-700 min-touch">
              <Plus size={13} /> New map
            </button>
            {showTypeDropdown && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowTypeDropdown(false)} />
                <div className="absolute right-0 top-full z-50 mt-1 w-[160px] rounded-md border bg-white py-1 shadow-lg"
                  style={{ borderColor: "var(--border)" }}>
                  {MAP_TYPES.map((t) => (
                    <button key={t.id} onClick={() => handleNewConceptMap(t.id)}
                      className="flex w-full items-center gap-2 px-3 py-1.5 text-xs hover:bg-gray-100 min-touch"
                      style={{ color: "var(--text-primary)" }}>
                      + {t.label}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>

        {conceptMaps.length > 0 ? (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {conceptMaps.map((m) => (
              <button key={m.id} onClick={() => handleOpenConceptMap(m)}
                className="flex items-center gap-3 rounded-lg border p-3 text-left transition-all hover:shadow-md min-touch"
                style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-panel)" }}>
                <div className="flex h-[60px] w-[100px] flex-shrink-0 items-center justify-center rounded-md"
                  style={{ backgroundColor: "var(--bg-secondary)" }}><MapIcon size={24} opacity={0.25} /></div>
                <div>
                  <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>{m.name}</p>
                  <p className="text-xs" style={{ color: "var(--text-secondary)" }}>{m.type} · {m.nodes} nodes</p>
                </div>
              </button>
            ))}
          </div>
        ) : (
          <div className="rounded-lg border border-dashed py-10 text-center" style={{ borderColor: "var(--border)" }}>
            <GitGraph size={32} opacity={0.1} className="mx-auto mb-2" />
            <p className="text-xs opacity-20">No concept maps yet. Click "+ New map" to create one.</p>
          </div>
        )}
      </section>

      {/* Geographic documents section */}
      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
            <MapPin size={16} style={{ color: "#000" }} /> Geographic documents
          </h2>
          <div className="flex items-center gap-2">
            <button onClick={handleOpenBlankGIS}
              className="flex items-center gap-1 rounded-md border px-3 py-1.5 text-xs font-medium hover:bg-gray-50 min-touch"
              style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}>
              <Globe size={13} /> Open GIS
            </button>
            <button onClick={handleNewGeoDoc}
              className="flex items-center gap-1 rounded-md bg-peach-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-peach-700 min-touch">
              <Plus size={13} /> New geo doc
            </button>
          </div>
        </div>

        {geoDocs.length > 0 ? (
          <div className="space-y-1">
            {geoDocs.map((d) => (
              <div key={d.id} onClick={() => handleOpenGeoDoc(d)}
                className="flex items-center gap-3 rounded-md px-3 py-2 text-sm hover:bg-gray-50 cursor-pointer min-touch"
                style={{ color: "var(--text-primary)" }}>
                <span>🗺</span>
                <span className="flex-1">{d.name}</span>
                <span className="text-xs opacity-40">{d.markers.length} markers</span>
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-lg border border-dashed py-10 text-center" style={{ borderColor: "var(--border)" }}>
            <MapPin size={32} opacity={0.1} className="mx-auto mb-2" />
            <p className="text-xs opacity-20">No geographic documents yet.</p>
            <p className="text-xs opacity-15 mt-1">Click "Open GIS" to start a blank map, or "New geo doc" to create one.</p>
          </div>
        )}
      </section>
    </div>
  );
}

/* ── Right panel ── */

export function MapsTabRight() {
  return <EmptyState variant="no-selection" subtitle="Select a map element to inspect" />;
}
