import { useState, useEffect } from "react";
import { X, Printer, FileText } from "lucide-react";
import { useProjectStore } from "../../stores/projectStore";
import { useLayoutStore } from "../../stores/layoutStore";
import { execQuery } from "../../lib/tauriBridge";

interface Props { open: boolean; onClose: () => void; }

const PRINT_CSS = `
@media print {
  @page { size: A4; margin: 20mm; }
  body { font-family: Georgia, serif; font-size: 11pt; line-height: 1.8; color: #1a1a1a; }
  .no-print { display: none !important; }
  .cat-margin { float: right; width: 25%; margin-left: 8px; padding-left: 8px; border-left: 1px solid #ddd; font-size: 9pt; color: #666; }
  .cat-margin .cat-bar { display: block; margin: 2px 0; padding: 1px 4px; border-radius: 2px; font-size: 8pt; color: #fff; }
  .para-num { color: #999; font-size: 8pt; margin-right: 8px; }
  .watermark { position: fixed; top: 50%; left: 50%; transform: translate(-50%,-50%) rotate(-45deg); font-size: 64px; color: rgba(0,0,0,0.05); pointer-events: none; z-index: 0; }
  .doc-meta { border-bottom: 1px solid #ccc; margin-bottom: 20px; padding-bottom: 10px; }
  .legend { margin-top: 24px; padding-top: 16px; border-top: 1px solid #ccc; page-break-before: always; }
}
`;

export function PrintManager({ open, onClose }: Props) {
  const project = useProjectStore((s) => s.project);
  const documents = useProjectStore((s) => s.documents);
  const selectedDocId = useLayoutStore((s) => s.selectedDocId);
  const categories = useProjectStore((s) => s.categories);
  const [lineNumbers, setLineNumbers] = useState(true);
  const [marginBar, setMarginBar] = useState(true);
  const [colorLegend, setColorLegend] = useState(false);
  const [includeMetadata, setIncludeMetadata] = useState(true);
  const [watermark, setWatermark] = useState("");
  const [previewHtml, setPreviewHtml] = useState("");
  const [loadingPreview, setLoadingPreview] = useState(false);

  const selectedDoc = documents.find(d => d.id === selectedDocId);

  useEffect(() => {
    if (open && selectedDoc && project?.id) generatePreview();
  }, [open, selectedDoc?.id]);

  const generatePreview = async () => {
    if (!selectedDoc || !project?.id) return;
    setLoadingPreview(true);
    try {
      // Load segments for this doc
      const segResult = await execQuery(
        `SELECT c.texto_seleccionado, c.posicion_inicio, c.posicion_fin, c.pagina, co.color_hex, co.nombre as cat_nombre
         FROM citas c JOIN citas_codigos cc ON cc.cita_id=c.id
         JOIN codigos co ON cc.codigo_id=co.id
         WHERE c.documento_id=?1 ORDER BY c.posicion_inicio`,
        [selectedDoc.id]
      );
      const segments = segResult.rows;

      let html = `<style>${PRINT_CSS}</style><div style="max-width:75%;">`;

      if (watermark) html += `<div class="watermark">${watermark}</div>`;

      if (includeMetadata && selectedDoc) {
        html += `<div class="doc-meta"><h1>${selectedDoc.name}</h1><p style="color:#666;">Type: ${selectedDoc.type} · Imported: ${selectedDoc.addedAt} · Size: ${(selectedDoc.size/1024).toFixed(1)} KB</p></div>`;
      }

      html += `<div class="content">`;
      html += `<p style="color:#888;font-style:italic;">Document has ${segments.length} coded segments across ${new Set(segments.map((s:any)=>s.cat_nombre)).size} categories.</p>`;

      if (segments.length > 0) {
        for (let i = 0; i < Math.min(segments.length, 30); i++) {
          const seg: any = segments[i];
          html += `<div style="margin-bottom:12px;padding-left:8px;border-left:3px solid ${seg.color_hex||'#9b59b6'};">`;
          if (lineNumbers && i%5===0) html += `<span class="para-num">[${i+1}]</span>`;
          html += `<p style="margin:0;">${(seg.texto_seleccionado||"").slice(0, 200)}</p>`;
          html += `<span style="font-size:10px;color:#999;">Page ${seg.pagina||"?"} · ${seg.cat_nombre||""}</span>`;
          html += `</div>`;
        }
        if (segments.length > 30) html += `<p style="color:#999;font-style:italic;">... and ${segments.length-30} more segments (truncated in preview)</p>`;
      } else {
        html += `<p style="color:#999;">No coded segments in this document yet.</p>`;
      }
      html += `</div>`;

      if (colorLegend && categories.length > 0) {
        html += `<div class="legend"><h3>Category Color Legend</h3>`;
        categories.forEach(c => {
          html += `<div style="display:inline-block;margin:4px 12px;"><span style="display:inline-block;width:14px;height:14px;background:${c.color};vertical-align:middle;margin-right:4px;border-radius:2px;"></span>${c.name} (${c.count})</div>`;
        });
        html += `</div>`;
      }

      if (marginBar && categories.length > 0) {
        html += `<div class="cat-margin"><strong>Categories</strong><br/>`;
        categories.forEach(c => html += `<span class="cat-bar" style="background:${c.color}">${c.name}</span><br/>`);
        html += `</div>`;
      }

      html += `</div>`;
      setPreviewHtml(html);
    } catch (e) {
      setPreviewHtml("<p>Could not load document data.</p>");
    } finally {
      setLoadingPreview(false);
    }
  };

  const handlePrint = () => {
    const win = window.open("","_blank","width=900,height=700");
    if (win) {
      win.document.write(`<!DOCTYPE html><html><head><title>${selectedDoc?.name||"Print"}</title></head><body>${previewHtml}</body></html>`);
      win.document.close();
      setTimeout(() => win.print(), 600);
    }
  };

  const exportPDF = () => {
    // Same as print — browser will offer "Save as PDF" in print dialog
    handlePrint();
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center" style={{backgroundColor:"rgba(0,0,0,0.5)"}}>
      <div className="w-full max-w-[560px] rounded-xl shadow-2xl flex flex-col" style={{maxHeight:"85vh",backgroundColor:"var(--bg-primary)",color:"var(--text-primary)"}} onClick={e=>e.stopPropagation()}>
        <div className="flex items-center justify-between border-b px-5 py-3" style={{borderColor:"var(--border)"}}>
          <div className="flex items-center gap-2"><Printer size={18} style={{color:"#9b59b6"}}/><h2 className="text-base font-bold">🖨 Print Document</h2></div>
          <button onClick={onClose} className="rounded p-1 hover:bg-gray-100"><X size={16}/></button>
        </div>

        <div className="p-5 space-y-4 overflow-y-auto flex-1">
          {selectedDoc ? (
            <>
              <div className="flex items-center gap-2 rounded-md p-2.5 text-xs" style={{backgroundColor:"var(--bg-secondary)"}}>
                <FileText size={14} opacity={0.5}/>
                <span className="font-medium">{selectedDoc.name}</span>
                <span className="opacity-40">· {selectedDoc.type} · {selectedDoc.addedAt.slice(0,10)}</span>
              </div>

              <div className="space-y-2.5">
                <label className="flex items-center gap-2 text-sm cursor-pointer"><input type="checkbox" checked={lineNumbers} onChange={()=>setLineNumbers(!lineNumbers)} style={{accentColor:"#9b59b6"}}/>Paragraph numbers (every 5 paragraphs)</label>
                <label className="flex items-center gap-2 text-sm cursor-pointer"><input type="checkbox" checked={marginBar} onChange={()=>setMarginBar(!marginBar)} style={{accentColor:"#9b59b6"}}/>Category margin bar (25% right)</label>
                <label className="flex items-center gap-2 text-sm cursor-pointer"><input type="checkbox" checked={colorLegend} onChange={()=>setColorLegend(!colorLegend)} style={{accentColor:"#9b59b6"}}/>Color legend at end of document</label>
                <label className="flex items-center gap-2 text-sm cursor-pointer"><input type="checkbox" checked={includeMetadata} onChange={()=>setIncludeMetadata(!includeMetadata)} style={{accentColor:"#9b59b6"}}/>Document metadata (name, date, type)</label>
              </div>

              <div>
                <label className="block text-xs opacity-40 mb-1">Watermark (optional)</label>
                <input value={watermark} onChange={e=>setWatermark(e.target.value)} placeholder="e.g. CONFIDENTIAL or DRAFT"
                  className="w-full rounded border px-3 py-2 text-sm" style={{borderColor:"var(--border)",backgroundColor:"var(--bg-primary)"}}/>
              </div>

              {/* Preview iframe */}
              <div>
                <p className="text-[10px] opacity-40 mb-1">Preview (first 2 pages)</p>
                <div className="rounded-lg border overflow-hidden bg-white" style={{borderColor:"var(--border)", height: 400}}>
                  {loadingPreview ? (
                    <div className="flex items-center justify-center h-full opacity-30">Loading document data...</div>
                  ) : previewHtml ? (
                    <iframe srcDoc={previewHtml} className="w-full h-full border-0" title="Print preview" sandbox="allow-same-origin"/>
                  ) : (
                    <div className="flex items-center justify-center h-full opacity-30">No preview</div>
                  )}
                </div>
              </div>
            </>
          ) : (
            <div className="py-16 text-center opacity-40"><Printer size={48} className="mx-auto mb-3"/><p className="text-sm font-medium">No document selected</p><p className="text-xs mt-1">Open a document in the Documents tab first, then open Print.</p></div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 border-t px-5 py-3" style={{borderColor:"var(--border)"}}>
          <button onClick={onClose} className="rounded border px-4 py-1.5 text-xs" style={{borderColor:"var(--border)"}}>Cancel</button>
          <button onClick={exportPDF} disabled={!selectedDoc}
            className="inline-flex items-center gap-2 rounded-md border px-4 py-2 text-sm font-medium disabled:opacity-30" style={{borderColor:"#9b59b6",color:"#9b59b6"}}>
            <FileText size={14}/> Export PDF
          </button>
          <button onClick={handlePrint} disabled={!selectedDoc}
            className="inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium text-white disabled:opacity-30" style={{backgroundColor:"#9b59b6"}}>
            <Printer size={14}/> 🖨 Print
          </button>
        </div>
      </div>
    </div>
  );
}
export default PrintManager;
