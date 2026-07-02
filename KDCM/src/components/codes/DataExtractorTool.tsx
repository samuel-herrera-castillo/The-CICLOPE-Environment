import { useState } from "react";
import { Download, FileSpreadsheet, FileText, File, Database } from "lucide-react";
import { useProjectStore } from "../../stores/projectStore";
import { useToast } from "../../stores/toastStore";
import { execQuery, getCitations } from "../../lib/tauriBridge";
import * as XLSX from "xlsx";

export function DataExtractor() {
  const documents = useProjectStore((s) => s.documents);
  const categories = useProjectStore((s) => s.categories);
  const proyectoId = useProjectStore((s) => s.project?.id);
  const { toast } = useToast();
  const [step, setStep] = useState(1);
  const [extractSegments, setExtractSegments] = useState(true);
  const [extractMemos, setExtractMemos] = useState(false);
  const [extractVars, setExtractVars] = useState(false);
  const [format, setFormat] = useState("xlsx");
  const [extracting, setExtracting] = useState(false);
  const itemCount = (extractSegments ? categories.reduce((s, c) => s + c.count, 0) : 0) + (extractMemos ? 0 : 0);

  const handleExport = async () => {
    if (!proyectoId) { toast.info("No project", "Open a project first"); return; }
    setExtracting(true);
    try {
      let csvRows: string[] = [];
      if (extractSegments) {
        const res = await getCitations(proyectoId);
        const rows = res?.rows || [];
        csvRows.push("ID,Documento,Texto,Página");
        rows.forEach((r: any) => {
          csvRows.push(`"${r.id || ""}","${r.doc || r.doc_nombre || ""}","${(r.texto || r.texto_seleccionado || "").slice(0, 200).replace(/"/g, '""')}",${r.pagina || 0}`);
        });
      }
      if (extractMemos && proyectoId) {
        const res = await execQuery("SELECT id, titulo, contenido_html FROM memos WHERE proyecto_id = ?1", [proyectoId]);
        const rows = res?.rows || [];
        if (csvRows.length === 0) csvRows.push("ID,Título,Contenido");
        rows.forEach((r: any) => {
          csvRows.push(`"${r.id || ""}","${r.titulo || r[1] || ""}","${(r.contenido_html || r.contenido || "").slice(0, 500).replace(/"/g, '""')}"`);
        });
      }
      if (format === "xlsx") {
        // Use SheetJS for proper Excel export
        const headerRow = csvRows[0].split(",");
        const dataRows = csvRows.slice(1).map((row) => {
          // Parse CSV row respecting quoted fields
          const result: string[] = [];
          let inQuotes = false;
          let current = "";
          for (let i = 0; i < row.length; i++) {
            const ch = row[i];
            if (ch === '"') { inQuotes = !inQuotes; continue; }
            if (ch === "," && !inQuotes) { result.push(current); current = ""; continue; }
            if (ch === '"' && row[i + 1] === '"') { current += '"'; i++; continue; }
            current += ch;
          }
          result.push(current);
          return result;
        });
        const ws = XLSX.utils.aoa_to_sheet([headerRow, ...dataRows]);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "KDCM Export");
        XLSX.writeFile(wb, `kdcm_export.xlsx`);
        toast.success("Exported", `${dataRows.length} rows exported as XLSX`);
      } else {
        const content = csvRows.join("\n");
        const ext = format;
        const blob = new Blob(["﻿" + content], { type: "text/csv;charset=utf-8" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a"); a.href = url; a.download = `kdcm_export.${ext}`; a.click();
        URL.revokeObjectURL(url);
        toast.success("Exported", `${csvRows.length - 1} rows exported as ${ext.toUpperCase()}`);
      }
    } catch { toast.error("Error", "Could not export data"); }
    setExtracting(false);
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 overflow-auto p-6">
        <div className="mx-auto max-w-[500px]">
          {/* Step indicators */}
          <div className="flex items-center justify-center gap-2 mb-6">
            {[1, 2, 3].map((s) => (
              <div key={s} className={`flex items-center gap-2 ${s < 3 ? "flex-1" : ""}`}>
                <div className={`flex h-7 w-7 items-center justify-center rounded-full text-[11px] font-bold ${step >= s ? "bg-peach-500 text-white" : "bg-gray-200 text-gray-400"}`}>{s}</div>
                {s < 3 && <div className="flex-1 h-px" style={{ backgroundColor: step > s ? "var(--peach)" : "var(--border)" }} />}
              </div>
            ))}
          </div>

          {step === 1 && (
            <div className="space-y-3">
              <h3 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>What to extract</h3>
              <label className="flex items-center gap-2 cursor-pointer text-xs" style={{ color: "var(--text-primary)" }}><input type="checkbox" checked={extractSegments} onChange={() => setExtractSegments(!extractSegments)} /> Coded segments ({categories.reduce((s, c) => s + c.count, 0)})</label>
              <label className="flex items-center gap-2 cursor-pointer text-xs" style={{ color: "var(--text-primary)" }}><input type="checkbox" checked={extractMemos} onChange={() => setExtractMemos(!extractMemos)} /> Memos</label>
              <label className="flex items-center gap-2 cursor-pointer text-xs" style={{ color: "var(--text-primary)" }}><input type="checkbox" checked={extractVars} onChange={() => setExtractVars(!extractVars)} /> Variables & values</label>
              <div className="rounded-md border p-3 mt-3" style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-secondary)" }}>
                <p className="text-xs" style={{ color: "var(--text-secondary)" }}>Preview: <strong style={{ color: "var(--text-primary)" }}>{itemCount}</strong> items found across {documents.length} documents</p>
              </div>
              <button onClick={() => setStep(2)} disabled={itemCount === 0}
                className="w-full rounded-md bg-peach-500 px-4 py-2.5 text-sm font-medium text-white hover:bg-peach-700 disabled:opacity-30 min-touch">Continue</button>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-3">
              <h3 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>Filters (optional)</h3>
              <div className="rounded-md border p-3 text-xs opacity-30" style={{ borderColor: "var(--border)" }}>All documents · All categories · All researchers</div>
              <p className="text-xs" style={{ color: "var(--text-secondary)" }}><strong style={{ color: "var(--text-primary)" }}>{itemCount}</strong> items match current filters</p>
              <div className="flex gap-2">
                <button onClick={() => setStep(1)} className="flex-1 rounded-md border px-4 py-2.5 text-xs font-medium hover:bg-gray-50 min-touch" style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}>Back</button>
                <button onClick={() => setStep(3)} className="flex-1 rounded-md bg-peach-500 px-4 py-2.5 text-xs font-medium text-white hover:bg-peach-700 min-touch">Continue</button>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-3">
              <h3 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>Export format</h3>
              <div className="grid grid-cols-2 gap-2">
                {[{ id: "xlsx", icon: FileSpreadsheet, label: "Excel" }, { id: "csv", icon: File, label: "CSV" }, { id: "docx", icon: FileText, label: "Word" }, { id: "txt", icon: Database, label: "TXT" }].map((f) => (
                  <button key={f.id} onClick={() => setFormat(f.id)}
                    className={`flex items-center gap-3 rounded-lg border p-3 text-left transition-all min-touch ${format === f.id ? "border-peach-500 bg-peach-50" : "hover:bg-gray-50"}`}
                    style={{ borderColor: format === f.id ? "var(--peach)" : "var(--border)" }}>
                    <f.icon size={20} style={{ color: format === f.id ? "#000" : "#000" }} />
                    <span className="text-xs font-medium" style={{ color: "var(--text-primary)" }}>{f.label}</span>
                  </button>
                ))}
              </div>
              <div className="flex gap-2 pt-2">
                <button onClick={() => setStep(2)} className="flex-1 rounded-md border px-4 py-2.5 text-xs font-medium hover:bg-gray-50 min-touch" style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}>Back</button>
                <button onClick={handleExport} disabled={extracting}
                  className="flex items-center gap-1.5 rounded-md bg-peach-500 px-5 py-2.5 text-xs font-medium text-white hover:bg-peach-700 min-touch disabled:opacity-50">
                  <Download size={14} /> {extracting ? "Exporting..." : "Export"}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
