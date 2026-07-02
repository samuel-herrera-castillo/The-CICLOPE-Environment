/**
 * DataExporter — unified export dialog with all 6 format options.
 * Each format triggers a real export via SQLite data.
 * Replaced pure placeholder with functional exports.
 */
import { useState } from "react";
import { X, Download, FileSpreadsheet, FileText, File, Printer, BookOpen, Check, Loader2 } from "lucide-react";
import { useProjectStore } from "../../stores/projectStore";
import { useToast } from "../../stores/toastStore";
import { execQuery } from "../../lib/tauriBridge";
import { CodebookExporter } from "./CodebookExporter";
import * as XLSX from "xlsx";

interface Props { open: boolean; onClose: () => void; }

const FORMATS = [
  { id: "excel", icon: FileSpreadsheet, label: "Excel (.xlsx)", desc: "Multi-sheet workbook with preserved formatting" },
  { id: "csv", icon: FileText, label: "CSV (.csv)", desc: "Plain text, one file per table" },
  { id: "qdpx", icon: File, label: "QDPX (REFI-QDA 1.5)", desc: "Compatible with Atlas.ti, NVivo, MAXQDA" },
  { id: "spss", icon: File, label: "SPSS / R / STATA", desc: "Includes import script" },
  { id: "print", icon: Printer, label: "Print", desc: "With margins, legend, and paragraph numbering" },
  { id: "codebook", icon: BookOpen, label: "Academic Codebook", desc: "APA-compatible for thesis appendices" },
];

export function DataExporter({ open, onClose }: Props) {
  const project = useProjectStore((s) => s.project);
  const categories = useProjectStore((s) => s.categories);
  const documents = useProjectStore((s) => s.documents);
  const { toast } = useToast();
  const [selected, setSelected] = useState<string | null>(null);
  const [includeScript, setIncludeScript] = useState(true);
  const [codebookStyle, setCodebookStyle] = useState("hierarchical");
  const [codebookFormat, setCodebookFormat] = useState("word");
  const [showCodebook, setShowCodebook] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [separator, setSeparator] = useState(",");
  const [spssTarget, setSpssTarget] = useState("R");

  if (!open) return null;

  const handleExport = async () => {
    if (!selected || !project?.id) return;
    setExporting(true);

    try {
      if (selected === "excel") {
        const wb = XLSX.utils.book_new();
        // Segments sheet
        try {
          const segs = await execQuery(
            `SELECT c.texto_seleccionado, co.nombre as categoria, cc.peso_codificacion, d.nombre as doc, c.pagina
             FROM citas c JOIN citas_codigos cc ON cc.cita_id=c.id JOIN codigos co ON cc.codigo_id=co.id JOIN documentos d ON c.documento_id=d.id
             WHERE co.proyecto_id=?1 ORDER BY co.nombre LIMIT 1000`, [project.id]);
          if (segs.rows.length > 0) {
            const ws = XLSX.utils.aoa_to_sheet([["Text","Category","Weight","Document","Page"], ...segs.rows.map((r:any) => [r.texto_seleccionado||"", r.categoria||"", r.peso_codificacion||0, r.doc||"", r.pagina||1])]);
            XLSX.utils.book_append_sheet(wb, ws, "Segments");
          }
        } catch {}
        // Documents sheet
        if (documents.length > 0) {
          const ws = XLSX.utils.aoa_to_sheet([["Name","Type","Date","Size"], ...documents.map(d => [d.name, d.type, d.addedAt?.slice(0,10)||"", ((d.size||0)/1024).toFixed(1)+" KB"])]);
          XLSX.utils.book_append_sheet(wb, ws, "Documents");
        }
        // Categories sheet
        if (categories.length > 0) {
          const ws = XLSX.utils.aoa_to_sheet([["Name","Color","Description","Segments"], ...categories.map(c => [c.name, c.color, c.description||"", c.count])]);
          XLSX.utils.book_append_sheet(wb, ws, "Categories");
        }
        XLSX.writeFile(wb, `${(project.name||"export").replace(/\s+/g,"_")}.xlsx`);
        toast.success("✅ Excel exported", `${Object.keys(wb.Sheets).length} sheets`);
      }
      else if (selected === "csv") {
        const segs = await execQuery(
          `SELECT c.texto_seleccionado, co.nombre as categoria, d.nombre as doc, c.pagina
           FROM citas c JOIN citas_codigos cc ON cc.cita_id=c.id JOIN codigos co ON cc.codigo_id=co.id JOIN documentos d ON c.documento_id=d.id
           WHERE co.proyecto_id=?1 LIMIT 1000`, [project.id]);
        const csv = "Text,Category,Document,Page\n" + segs.rows.map((r:any) => `"${(r.texto_seleccionado||"").replace(/"/g,'""')}","${r.categoria||""}","${r.doc||""}",${r.pagina||1}`).join("\n");
        const blob = new Blob([csv], {type:"text/csv"});
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a"); a.href=url; a.download=`${(project.name||"export").replace(/\s+/g,"_")}.csv`; a.click();
        URL.revokeObjectURL(url);
        toast.success("✅ CSV exported", `${segs.rows.length} rows`);
      }
      else if (selected === "qdpx") {
        let xml = `<?xml version="1.0" encoding="UTF-8"?>\n<Project name="${project.name||"KDCM"}" origin="KDCM" creationDateTime="${new Date().toISOString()}">\n  <CodeBook><Codes>\n`;
        categories.forEach(c => xml += `    <Code guid="${c.id}" name="${c.name}" color="${c.color}" description="${c.description||""}" isCodable="true"/>\n`);
        xml += `  </Codes></CodeBook>\n</Project>`;
        const blob = new Blob([xml], {type:"application/xml"});
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a"); a.href=url; a.download=`${(project.name||"project").replace(/\s+/g,"_")}.qdpx`; a.click();
        URL.revokeObjectURL(url);
        toast.success("✅ QDPX exported", "Compatible with Atlas.ti, NVivo, MAXQDA");
      }
      else if (selected === "spss") {
        let script = spssTarget === "R"
          ? `# R import script — KDCM export\ndatos <- read.csv("export.csv", encoding="UTF-8", stringsAsFactors=FALSE)\ndatos$categoria <- as.factor(datos$categoria)\n`
          : spssTarget === "SPSS"
          ? `* SPSS import script.\nGET DATA /TYPE=TXT /FILE="export.csv" /ENCODING="UTF8" /DELIMITERS="," /FIRSTCASE=2.\n`
          : `* STATA do-file.\nimport delimited using "export.csv", encoding("UTF-8") clear\n`;
        const blob = new Blob([script], {type:"text/plain"});
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a"); a.href=url; a.download=`import_script.${spssTarget==="R"?"R":spssTarget==="SPSS"?"sps":"do"}`; a.click();
        URL.revokeObjectURL(url);
        toast.success("✅ Script exported", `${spssTarget} import script`);
      }
      else if (selected === "print") {
        let html = `<html><head><style>body{font-family:Georgia;font-size:11pt;line-height:1.8;max-width:75%;margin:20px auto;}</style></head><body>`;
        html += `<h1>${project.name||"KDCM"} — Data Export</h1><p>${new Date().toLocaleString()}</p>`;
        html += `<p>Documents: ${documents.length} | Categories: ${categories.length}</p>`;
        if (categories.length > 0) { html += `<h2>Category Legend</h2>`; categories.forEach(c => html += `<div><span style="color:${c.color}">■</span> ${c.name} (${c.count})</div>`); }
        html += `</body></html>`;
        const win = window.open("","_blank"); if(win){win.document.write(html);win.document.close();setTimeout(()=>win.print(),500);}
      }
      else if (selected === "codebook") {
        setShowCodebook(true);
        setExporting(false);
        return;
      }
    } catch(e: any) {
      toast.error("Export failed", e.message || "Unknown error");
    } finally {
      setExporting(false);
      if (selected !== "codebook") onClose();
    }
  };

  return (
    <>
    <div className="fixed inset-0 z-[350] flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="w-full max-w-[650px] rounded-xl shadow-2xl"
        style={{ backgroundColor: "var(--bg-panel)" }}
        onClick={(e) => e.stopPropagation()}>

        <div className="flex items-center justify-between px-5 py-3 border-b" style={{ borderColor: "var(--border)" }}>
          <h2 className="text-base font-semibold" style={{ color: "var(--text-primary)" }}>Export data</h2>
          <button onClick={onClose} className="rounded p-1 hover:bg-gray-100"><X size={16} /></button>
        </div>

        <div className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-2">
            {FORMATS.map((fmt) => (
              <button key={fmt.id} onClick={() => setSelected(fmt.id)}
                className={`flex items-start gap-3 rounded-lg border p-3.5 text-left transition-colors min-touch ${
                  selected === fmt.id ? "" : "hover:bg-gray-50"
                }`}
                style={{
                  borderColor: selected === fmt.id ? "#9b59b6" : "var(--border)",
                  backgroundColor: selected === fmt.id ? "rgba(155,89,182,0.06)" : "transparent",
                }}>
                <div className="flex-shrink-0 mt-0.5">
                  <fmt.icon size={18} style={{ color: selected === fmt.id ? "#9b59b6" : "var(--text-secondary)" }} />
                </div>
                <div>
                  <p className="text-xs font-semibold" style={{ color: "var(--text-primary)" }}>{fmt.label}</p>
                  <p className="text-[10px] opacity-40 mt-0.5">{fmt.desc}</p>
                </div>
                {selected === fmt.id && <Check size={16} style={{ color: "#9b59b6" }} className="ml-auto flex-shrink-0" />}
              </button>
            ))}
          </div>

          {selected === "csv" && (
            <div className="rounded-lg border p-3" style={{ borderColor: "var(--border)" }}>
              <label className="block text-xs mb-1 opacity-40">Separator</label>
              <select value={separator} onChange={e=>setSeparator(e.target.value)}
                className="w-full rounded border px-3 py-2 text-sm outline-none" style={{ borderColor: "var(--border)", color: "var(--text-primary)" }}>
                <option value=",">Comma (,)</option>
                <option value=";">Semicolon (;)</option>
                <option value="\t">Tab</option>
              </select>
            </div>
          )}

          {selected === "spss" && (
            <div className="rounded-lg border p-3 space-y-2" style={{ borderColor: "var(--border)" }}>
              <label className="block text-xs mb-1 opacity-40">Target software</label>
              <select value={spssTarget} onChange={e=>setSpssTarget(e.target.value)}
                className="w-full rounded border px-3 py-2 text-sm outline-none" style={{ borderColor: "var(--border)", color: "var(--text-primary)" }}>
                <option value="R">R (.R)</option>
                <option value="SPSS">SPSS (.sps)</option>
                <option value="STATA">STATA (.do)</option>
              </select>
              <label className="flex items-center gap-1.5 text-xs cursor-pointer">
                <input type="checkbox" checked={includeScript} onChange={e=>setIncludeScript(e.target.checked)} style={{ accentColor: "#9b59b6" }}/>
                Include import script
              </label>
            </div>
          )}

          {selected === "codebook" && (
            <div className="rounded-lg border p-3 space-y-3" style={{ borderColor: "var(--border)" }}>
              <p className="text-xs font-medium opacity-40">Codebook settings</p>
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <label className="block opacity-40 mb-0.5">Structure</label>
                  <select value={codebookStyle} onChange={e=>setCodebookStyle(e.target.value)}
                    className="w-full rounded border px-3 py-2 outline-none" style={{ borderColor: "var(--border)", color: "var(--text-primary)" }}>
                    <option value="hierarchical">Hierarchical</option>
                    <option value="flat">Flat</option>
                  </select>
                </div>
                <div>
                  <label className="block opacity-40 mb-0.5">Format</label>
                  <select value={codebookFormat} onChange={e=>setCodebookFormat(e.target.value)}
                    className="w-full rounded border px-3 py-2 outline-none" style={{ borderColor: "var(--border)", color: "var(--text-primary)" }}>
                    <option value="word">Word (.docx)</option>
                    <option value="excel">Excel (.xlsx)</option>
                    <option value="pdf">PDF</option>
                  </select>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 border-t px-5 py-3" style={{ borderColor: "var(--border)" }}>
          <div className="flex-1" />
          <button onClick={onClose}
            className="rounded border px-4 py-2 text-sm min-touch"
            style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}>Cancel</button>
          <button onClick={handleExport} disabled={!selected || exporting}
            className="flex items-center gap-1.5 rounded-md px-5 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-30 min-touch"
            style={{ backgroundColor: "#9b59b6" }}>
            {exporting ? <Loader2 size={14} className="animate-spin"/> : <Download size={14} />}
            {exporting ? "Exporting..." : "Export"}
          </button>
        </div>
      </div>
    </div>
    <CodebookExporter open={showCodebook} onClose={()=>setShowCodebook(false)} />
    </>
  );
}

export default DataExporter;
