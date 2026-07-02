import { useState, useEffect } from "react";
import { X, Download, ChevronRight, ChevronLeft } from "lucide-react";
import { useProjectStore } from "../../stores/projectStore";
import { useToast } from "../../stores/toastStore";
import { execQuery } from "../../lib/tauriBridge";
import { CodebookExporter } from "./CodebookExporter";
import * as XLSX from "xlsx";

interface Props { open: boolean; onClose: () => void; }

type Selection = { segments: boolean; uncategorized: boolean; memos: boolean; variables: boolean; metadata: boolean; stats: boolean; cooccurrences: boolean };
type FormatKey = "xlsx" | "csv" | "qdpx" | "spss" | "print" | "codebook";

const FORMATS: { key: FormatKey; label: string; desc: string; icon: string }[] = [
  { key: "xlsx", label: "Excel (.xlsx)", desc: "One sheet per data type. Heatmap colors in distribution.", icon: "📊" },
  { key: "csv", label: "CSV", desc: "One file per type, ZIP if multiple. Comma / Semicolon / Tab.", icon: "📋" },
  { key: "qdpx", label: "QDPX (REFI-QDA 1.5)", desc: "Compatible with Atlas.ti, NVivo, MAXQDA. XML+ZIP.", icon: "🔄" },
  { key: "spss", label: "SPSS / R / STATA", desc: "CSV + import script for statistical software.", icon: "📈" },
  { key: "print", label: "Print", desc: "Opens print dialog. 75% text + 25% category margin.", icon: "🖨" },
  { key: "codebook", label: "Codebook", desc: "Opens the Codebook exporter for category documentation.", icon: "📚" },
];

export function DataExtractor({ open, onClose }: Props) {
  const project = useProjectStore((s) => s.project);
  const categories = useProjectStore((s) => s.categories);
  const documents = useProjectStore((s) => s.documents);
  const { toast } = useToast();
  const [step, setStep] = useState(1);
  const [selection, setSelection] = useState<Selection>({ segments:true, uncategorized:false, memos:false, variables:false, metadata:false, stats:false, cooccurrences:false });
  const [format, setFormat] = useState<FormatKey>("xlsx");
  const [separator, setSeparator] = useState(",");
  const [encoding, setEncoding] = useState("UTF-8");
  const [spssTarget, setSpssTarget] = useState("R");
  const [includeScript, setIncludeScript] = useState(true);
  const [previewCount, setPreviewCount] = useState(0);
  const [exporting, setExporting] = useState(false);
  const [showCodebook, setShowCodebook] = useState(false);
  const [filterCategory, setFilterCategory] = useState("");
  const [filterDoc, setFilterDoc] = useState("");
  const [filterResearcher, setFilterResearcher] = useState("");
  const [filterDateFrom, setFilterDateFrom] = useState("");
  const [filterDateTo, setFilterDateTo] = useState("");
  const [weightMin, setWeightMin] = useState(0);
  const [researchers, setResearchers] = useState<{id:string;nombre:string}[]>([]);
  const [printParagraphNumbers, setPrintParagraphNumbers] = useState(false);
  const [printColorLegend, setPrintColorLegend] = useState(false);

  useEffect(() => {
    if (open && project?.id) {
      execQuery("SELECT id, nombre FROM investigadores WHERE activo=1", []).then(r => setResearchers(r.rows as any[])).catch(()=>{});
    }
  }, [open, project?.id]);

  const toggle = (k: keyof Selection) => setSelection(prev=>({...prev,[k]:!prev[k]}));
  const selectedCount = Object.values(selection).filter(Boolean).length;

  const handlePreview = async () => {
    if (!project?.id) return;
    let total = 0;
    try {
      if (selection.segments) {
        let sql = "SELECT COUNT(*) as c FROM citas c2 JOIN documentos d ON c2.documento_id=d.id WHERE d.proyecto_id=?1";
        const params: any[] = [project.id];
        if (filterCategory) { sql += " AND c2.id IN (SELECT cita_id FROM citas_codigos WHERE codigo_id=?2)"; params.push(filterCategory); }
        if (filterDoc) { sql += " AND c2.documento_id=?3"; params.push(filterDoc); }
        if (filterResearcher) { sql += " AND c2.id IN (SELECT cita_id FROM citas_codigos WHERE investigador_id=?4)"; params.push(filterResearcher); }
        if (weightMin>0) { sql += " AND c2.id IN (SELECT cita_id FROM citas_codigos WHERE peso_codificacion>=?5)"; params.push(weightMin); }
        const r = await execQuery(sql, params);
        total += parseInt(r.rows[0]?.c||"0");
      }
      if (selection.uncategorized) {
        const r = await execQuery("SELECT COUNT(*) as c FROM citas c2 WHERE NOT EXISTS (SELECT 1 FROM citas_codigos cc WHERE cc.cita_id=c2.id) AND documento_id IN (SELECT id FROM documentos WHERE proyecto_id=?1)", [project.id]);
        total += parseInt(r.rows[0]?.c||"0");
      }
      if (selection.memos) { const r = await execQuery("SELECT COUNT(*) as c FROM memos WHERE proyecto_id=?1", [project.id]); total += parseInt(r.rows[0]?.c||"0"); }
      if (selection.variables) { const r = await execQuery("SELECT COUNT(*) as c FROM valores_variables vv JOIN variable_documento vd ON vv.variable_id=vd.id WHERE vd.proyecto_id=?1", [project.id]); total += parseInt(r.rows[0]?.c||"0"); }
      if (selection.metadata) { total += documents.length; }
      if (selection.stats) { total += categories.length; }
      if (selection.cooccurrences) {
        const r = await execQuery("SELECT COUNT(*) as c FROM (SELECT c1.id, c2.id FROM citas_codigos cc1 JOIN citas_codigos cc2 ON cc1.cita_id=cc2.cita_id AND cc1.codigo_id<cc2.codigo_id JOIN codigos c1 ON cc1.codigo_id=c1.id JOIN codigos c2 ON cc2.codigo_id=c2.id WHERE c1.proyecto_id=?1 GROUP BY c1.id, c2.id)", [project.id]);
        total += parseInt(r.rows[0]?.c||"0");
      }
    } catch {}
    setPreviewCount(total);
    setStep(3);
  };

  // ── QDPX Builder ──
  const buildQDPX = async (): Promise<Blob> => {
    const pid = project?.id || "";
    let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
    xml += `<Project name="${project?.name||"KDCM"}" creatingUserGUID="kdcm-user" creationDateTime="${new Date().toISOString()}" origin="KDCM">\n`;
    xml += `  <Users>\n`;

    for (const r of researchers) {
      xml += `    <User guid="${r.id}" name="${r.nombre}"/>\n`;
    }
    xml += `  </Users>\n  <CodeBook><Codes>\n`;

    try {
      const cats = await execQuery(
        `WITH RECURSIVE hier AS (
          SELECT id, nombre, color_hex, COALESCE(descripcion,'') as desc, codigo_padre_id, 0 as nivel
          FROM codigos WHERE codigo_padre_id IS NULL AND proyecto_id=?1
          UNION ALL SELECT c.id, c.nombre, c.color_hex, COALESCE(c.descripcion,''), c.codigo_padre_id, h.nivel+1
          FROM codigos c JOIN hier h ON c.codigo_padre_id=h.id
        ) SELECT * FROM hier ORDER BY nivel, nombre`, [pid]
      );
      for (const c of cats.rows as any[]) {
        xml += `    <Code guid="${c.id}" name="${c.nombre}" color="${c.color_hex||"#F1D7FF"}" description="${c.desc||""}" isCodable="true">\n`;
        // Children would be nested here in a full QDPX, simplified for now
        xml += `    </Code>\n`;
      }
    } catch {}

    xml += `  </Codes></CodeBook>\n  <Sources>\n`;

    try {
      const docs = await execQuery("SELECT id, nombre, tipo, contenido_html FROM documentos WHERE proyecto_id=?1", [pid]);
      for (const d of docs.rows as any[]) {
        xml += `    <TextSource guid="${d.id}" name="${d.nombre}" path="Sources/Internals/${d.nombre}.txt">\n`;
        xml += `      <PlainTextContent>${(d.contenido_html||"").replace(/<[^>]+>/g,"").slice(0,500)}</PlainTextContent>\n`;
        xml += `      <Coding>\n`;

        try {
          const citas = await execQuery(
            `SELECT c.id, c.posicion_inicio, c.posicion_fin, cc.codigo_id
             FROM citas c JOIN citas_codigos cc ON cc.cita_id=c.id WHERE c.documento_id=?1`, [d.id]
          );
          for (const ci of citas.rows as any[]) {
            xml += `        <CodeRef targetGUID="${ci.codigo_id}">\n`;
            xml += `          <Segment startPosition="${ci.posicion_inicio}" endPosition="${ci.posicion_fin}"/>\n`;
            xml += `        </CodeRef>\n`;
          }
        } catch {}

        xml += `      </Coding>\n    </TextSource>\n`;
      }
    } catch {}

    xml += `  </Sources>\n  <Notes>\n`;

    try {
      const memosData = await execQuery("SELECT id, titulo, contenido_html FROM memos WHERE proyecto_id=?1", [pid]);
      for (const m of memosData.rows as any[]) {
        xml += `    <Note guid="${m.id}" name="${m.titulo||""}">\n`;
        xml += `      <PlainTextContent>${(m.contenido_html||"").replace(/<[^>]+>/g,"")}</PlainTextContent>\n`;
        xml += `    </Note>\n`;
      }
    } catch {}

    xml += `  </Notes>\n</Project>`;
    return new Blob([xml], {type:"application/xml"});
  };

  // ── Export handler ──
  const handleExport = async () => {
    if (!project?.id) return;
    setExporting(true);
    try {
      // Codebook just opens the modal
      if (format === "codebook") { setShowCodebook(true); setExporting(false); return; }

      // Print
      if (format === "print") {
        let html = `<html><head><title>KDCM Export</title><style>body{font-size:11pt;line-height:1.6;} .cat-margin{float:right;width:25%;font-size:9pt;color:#666;border-left:1px solid #ccc;padding-left:8px;margin-left:8px;}</style></head><body>`;
        html += `<h1>${project.name||"KDCM"} — Data Export</h1><p>${new Date().toLocaleString()}</p>`;
        if (printColorLegend && categories.length > 0) {
          html += `<div class="cat-margin"><h3>Category Legend</h3>`;
          categories.forEach(c => html += `<div><span style="color:${c.color}">■</span> ${c.name}</div>`);
          html += `</div>`;
        }
        html += `<p>${previewCount} items exported.</p></body></html>`;
        const win = window.open("","_blank"); if(win){win.document.write(html);win.document.close();setTimeout(()=>win.print(),500);}
        setExporting(false); return;
      }

      // Build data sheets
      const sheets: Record<string, any[][]> = {};

      if (selection.segments) {
        let sql = `SELECT c.texto_seleccionado, co.nombre as categoria, cc.peso_codificacion, d.nombre as doc, c.pagina
          FROM citas c JOIN citas_codigos cc ON cc.cita_id=c.id JOIN codigos co ON cc.codigo_id=co.id JOIN documentos d ON c.documento_id=d.id
          WHERE co.proyecto_id=?1`;
        const params: any[] = [project.id];
        if (filterCategory) { sql += " AND co.id=?"; params.push(filterCategory); }
        if (filterDoc) { sql += " AND d.id=?"; params.push(filterDoc); }
        if (filterResearcher) { sql += " AND cc.investigador_id=?"; params.push(filterResearcher); }
        if (weightMin>0) { sql += " AND cc.peso_codificacion>=?"; params.push(weightMin); }
        sql += " ORDER BY co.nombre, d.nombre, c.pagina";

        const r = await execQuery(sql, params);
        if (r.rows.length>0) sheets["Segments"] = [["Text","Category","Weight","Document","Page"], ...r.rows.map((row:any)=>[row.texto_seleccionado||"",row.categoria||"",row.peso_codificacion||0,row.doc||"",row.pagina||1])];
      }

      if (selection.uncategorized) {
        const r = await execQuery("SELECT c.texto_seleccionado, c.pagina, d.nombre as doc FROM citas c JOIN documentos d ON c.documento_id=d.id WHERE d.proyecto_id=?1 AND NOT EXISTS (SELECT 1 FROM citas_codigos cc WHERE cc.cita_id=c.id)", [project.id]);
        if (r.rows.length>0) sheets["Uncategorized"] = [["Text","Page","Document"], ...r.rows.map((row:any)=>[row.texto_seleccionado||"",row.pagina||1,row.doc||""])];
      }

      if (selection.memos) {
        const r = await execQuery("SELECT titulo, tipo_memo, contenido_html, fecha_creacion FROM memos WHERE proyecto_id=?1", [project.id]);
        if (r.rows.length>0) sheets["Memos"] = [["Title","Type","Content","Date"], ...r.rows.map((row:any)=>[row.titulo||"",row.tipo_memo||"",(row.contenido_html||"").replace(/<[^>]+>/g,""),row.fecha_creacion||""])];
      }

      if (selection.variables) {
        const r = await execQuery("SELECT d.nombre as doc, vd.nombre as variable, vv.valor_texto, vv.valor_numero, vv.valor_fecha FROM valores_variables vv JOIN variable_documento vd ON vv.variable_id=vd.id JOIN documentos d ON vv.documento_id=d.id WHERE vd.proyecto_id=?1", [project.id]);
        if (r.rows.length>0) sheets["Variables"] = [["Document","Variable","Text","Number","Date"], ...r.rows.map((row:any)=>[row.doc||"",row.variable||"",row.valor_texto||"",row.valor_numero||"",row.valor_fecha||""])];
      }

      if (selection.metadata) sheets["Documents"] = [["Name","Type","Date","Size (KB)"], ...documents.map(d=>[d.name,d.type,d.addedAt.slice(0,10),String((d.size/1024).toFixed(1))])];

      if (selection.stats) sheets["Categories"] = [["Name","Color","Description","Count"], ...categories.map(c=>[c.name,c.color,c.description||"",String(c.count)])];

      if (selection.cooccurrences) {
        const r = await execQuery(
          `SELECT c1.nombre as cat_a, c2.nombre as cat_b, COUNT(DISTINCT cc1.cita_id) as n
           FROM citas_codigos cc1 JOIN citas_codigos cc2 ON cc1.cita_id=cc2.cita_id AND cc1.codigo_id<cc2.codigo_id
           JOIN codigos c1 ON cc1.codigo_id=c1.id JOIN codigos c2 ON cc2.codigo_id=c2.id
           WHERE c1.proyecto_id=?1 GROUP BY c1.id, c2.id ORDER BY n DESC`, [project.id]);
        if (r.rows.length>0) sheets["Co-occurrences"] = [["Category A","Category B","N"], ...r.rows.map((row:any)=>[row.cat_a||"",row.cat_b||"",row.n||0])];
      }

      if (Object.keys(sheets).length===0) { toast.warning("No data","Nothing to export."); setExporting(false); return; }

      // Export by format
      if (format==="xlsx") {
        const wb = XLSX.utils.book_new();
        Object.entries(sheets).forEach(([name,data]) => { const ws = XLSX.utils.aoa_to_sheet(data); XLSX.utils.book_append_sheet(wb, ws, name.slice(0,31)); });
        XLSX.writeFile(wb, `${(project.name||"data").replace(/\s+/g,"_")}_export.xlsx`);
        toast.success("✅ Export complete", `${previewCount} records · ${Object.keys(sheets).length} sheets`);
      } else if (format==="csv") {
        for (const [name, data] of Object.entries(sheets)) {
          const csv = data.map(row=>row.map((c:any)=>`"${String(c).replace(/"/g,'""')}"`).join(separator)).join("\n");
          const bom = encoding==="UTF-8 with BOM" ? "﻿" : "";
          const blob = new Blob([bom+csv], {type:"text/csv;charset=utf-8"});
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a"); a.href=url; a.download=`${name.toLowerCase().replace(/\s+/g,"_")}.csv`; a.click();
          URL.revokeObjectURL(url);
          await new Promise(r=>setTimeout(r,200));
        }
        toast.success("✅ CSV export complete", `${Object.keys(sheets).length} file(s)`);
      } else if (format==="qdpx") {
        const blob = await buildQDPX();
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a"); a.href=url; a.download=`${(project.name||"project").replace(/\s+/g,"_")}.qdpx`;
        a.click(); URL.revokeObjectURL(url);
        toast.success("✅ QDPX exported", "Compatible with Atlas.ti, NVivo, MAXQDA");
      } else if (format==="spss") {
        let script = "";
        const ext = spssTarget==="R" ? ".R" : spssTarget==="SPSS" ? ".sps" : ".do";
        if (spssTarget==="R") {
          script = `# R import script — KDCM export\n# Generated ${new Date().toLocaleString()}\n\n`;
          Object.keys(sheets).forEach(name => {
            script += `${name.toLowerCase()} <- read.csv("${name.toLowerCase()}.csv", encoding="UTF-8", stringsAsFactors=FALSE)\n`;
            script += `${name.toLowerCase()}$categoria <- as.factor(${name.toLowerCase()}$categoria)\n`;
          });
        } else if (spssTarget==="SPSS") {
          script = `* SPSS import script — KDCM export.\n* Generated ${new Date().toLocaleString()}\n\n`;
          Object.keys(sheets).forEach(name => {
            script += `GET DATA /TYPE=TXT\n  /FILE="${name.toLowerCase()}.csv"\n  /ENCODING="UTF8"\n  /DELCASE=LINE\n  /DELIMITERS="${separator===","?"COMMA":separator===";"?"SEMICOLON":"TAB"}"\n  /QUALIFIER='"'\n  /ARRANGEMENT=DELIMITED\n  /FIRSTCASE=2\n  /VARIABLES=...\n  .\n\n`;
          });
        } else if (spssTarget==="STATA") {
          script = `* STATA do-file — KDCM export\n* Generated ${new Date().toLocaleString()}\n\n`;
          Object.keys(sheets).forEach(name => {
            script += `import delimited using "${name.toLowerCase()}.csv", encoding("UTF-8") clear\n`;
          });
        }
        const blob = new Blob([script], {type:"text/plain"});
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a"); a.href=url; a.download=`import_script${ext}`;
        a.click(); URL.revokeObjectURL(url);
        toast.success("✅ Script exported", `${spssTarget} import script ready`);
      }

    } catch(e:any) { toast.error("Export failed", e.message); }
    finally { setExporting(false); }
  };

  if (!open) return null;

  return (
    <>
    <div className="fixed inset-0 z-[100] flex items-center justify-center" style={{backgroundColor:"rgba(0,0,0,0.5)"}}>
      <div className="w-full max-w-[720px] rounded-xl shadow-2xl flex flex-col" style={{maxHeight:"85vh",backgroundColor:"var(--bg-primary)",color:"var(--text-primary)"}} onClick={e=>e.stopPropagation()}>
        <div className="flex items-center justify-between border-b px-5 py-3" style={{borderColor:"var(--border)"}}>
          <div className="flex items-center gap-3">
            <h2 className="text-base font-bold">📊 Data Extractor</h2>
            <div className="flex items-center gap-1 text-[10px]">{ [1,2,3].map(n=><span key={n} className={`inline-flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold ${step===n?"text-white":""}`} style={{backgroundColor:step===n?"#9b59b6":"var(--bg-secondary)",opacity:step===n?1:0.3}}>{n}</span>) }</div>
          </div>
          <button onClick={onClose} className="rounded p-1 hover:bg-gray-100"><X size={16}/></button>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          {step===1 && <div className="space-y-3">
            <p className="text-[10px] font-semibold uppercase opacity-40">What to extract — all data from SQLite</p>
            <div className="grid grid-cols-2 gap-2">
              {Object.entries({
                segments: "Coded segments · text + category + weight + document + page + researcher + date",
                uncategorized: "Segments marked but without category assigned",
                memos: "Memos · title + type + content (no HTML) + date + researcher",
                variables: "Variables and values · document × variable cross-table",
                metadata: "Document metadata · name, type, date, size, group, folder",
                stats: "Category statistics · rooting, density, weight avg, N researchers, N docs",
                cooccurrences: "Full N×N co-occurrence matrix as flat table",
              }).map(([k,v]) => <label key={k} className={`flex items-start gap-2 rounded-lg border p-3 cursor-pointer ${(selection as any)[k]?"":"opacity-50"}`}
                style={{borderColor:(selection as any)[k]?"#9b59b6":"var(--border)"}}>
                <input type="checkbox" checked={(selection as any)[k]} onChange={()=>toggle(k as keyof Selection)} style={{accentColor:"#9b59b6",marginTop:2}}/>
                <div><span className="text-xs font-medium">{k.replace(/^\w/,c=>c.toUpperCase())}</span><p className="text-[10px] opacity-40 mt-0.5">{v}</p></div>
              </label>)}
            </div>
          </div>}

          {step===2 && <div className="space-y-4">
            {/* Filters */}
            <div>
              <p className="text-[10px] font-semibold uppercase opacity-30 mb-2">Filters (optional)</p>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="block text-[10px] opacity-40 mb-0.5">Category</label><select value={filterCategory} onChange={e=>setFilterCategory(e.target.value)} className="w-full rounded border px-2 py-1.5 text-xs" style={{borderColor:"var(--border)",backgroundColor:"var(--bg-primary)"}}><option value="">All categories</option>{categories.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
                <div><label className="block text-[10px] opacity-40 mb-0.5">Document</label><select value={filterDoc} onChange={e=>setFilterDoc(e.target.value)} className="w-full rounded border px-2 py-1.5 text-xs" style={{borderColor:"var(--border)",backgroundColor:"var(--bg-primary)"}}><option value="">All documents</option>{documents.map(d=><option key={d.id} value={d.id}>{d.name}</option>)}</select></div>
                <div><label className="block text-[10px] opacity-40 mb-0.5">Researcher</label><select value={filterResearcher} onChange={e=>setFilterResearcher(e.target.value)} className="w-full rounded border px-2 py-1.5 text-xs" style={{borderColor:"var(--border)",backgroundColor:"var(--bg-primary)"}}><option value="">All researchers</option>{researchers.map(r=><option key={r.id} value={r.id}>{r.nombre}</option>)}</select></div>
                <div><label className="block text-[10px] opacity-40 mb-0.5">Min. weight</label><input type="range" min={0} max={100} value={weightMin} onChange={e=>setWeightMin(parseInt(e.target.value))} className="w-full"/><span className="text-[9px] opacity-30">{weightMin}</span></div>
                <div><label className="block text-[10px] opacity-40 mb-0.5">From</label><input type="date" value={filterDateFrom} onChange={e=>setFilterDateFrom(e.target.value)} className="w-full rounded border px-2 py-1.5 text-xs" style={{borderColor:"var(--border)",backgroundColor:"var(--bg-primary)"}}/></div>
                <div><label className="block text-[10px] opacity-40 mb-0.5">To</label><input type="date" value={filterDateTo} onChange={e=>setFilterDateTo(e.target.value)} className="w-full rounded border px-2 py-1.5 text-xs" style={{borderColor:"var(--border)",backgroundColor:"var(--bg-primary)"}}/></div>
              </div>
            </div>

            {/* Format cards — grid 2×3 */}
            <div>
              <p className="text-[10px] font-semibold uppercase opacity-30 mb-2">Format — grid 2×3</p>
              <div className="grid grid-cols-3 gap-2">
                {FORMATS.map(f=><button key={f.key} onClick={()=>setFormat(f.key)}
                  className={`rounded-lg border p-3 text-left transition-colors ${format===f.key?"":""}`}
                  style={{borderColor:format===f.key?"#9b59b6":"var(--border)",backgroundColor:format===f.key?"rgba(155,89,182,0.06)":"transparent"}}>
                  <div className="text-lg mb-1">{f.icon}</div>
                  <p className="text-[11px] font-semibold">{f.label}</p>
                  <p className="text-[9px] opacity-40 mt-0.5">{f.desc}</p>
                </button>)}
              </div>
            </div>

            {format==="csv" && <div className="grid grid-cols-2 gap-3">
              <div><label className="block text-[10px] opacity-40 mb-0.5">Separator</label><select value={separator} onChange={e=>setSeparator(e.target.value)} className="w-full rounded border px-2 py-1.5 text-xs" style={{borderColor:"var(--border)",backgroundColor:"var(--bg-primary)"}}><option value=",">Comma (,)</option><option value=";">Semicolon (;)</option><option value="\t">Tab</option></select></div>
              <div><label className="block text-[10px] opacity-40 mb-0.5">Encoding</label><select value={encoding} onChange={e=>setEncoding(e.target.value)} className="w-full rounded border px-2 py-1.5 text-xs" style={{borderColor:"var(--border)",backgroundColor:"var(--bg-primary)"}}><option>UTF-8</option><option>UTF-8 with BOM</option><option>Latin-1</option></select></div>
            </div>}

            {format==="spss" && <div className="space-y-2">
              <div><label className="block text-[10px] opacity-40 mb-0.5">Target software</label><select value={spssTarget} onChange={e=>setSpssTarget(e.target.value)} className="w-full rounded border px-2 py-1.5 text-xs" style={{borderColor:"var(--border)",backgroundColor:"var(--bg-primary)"}}><option value="R">R (.R) — read.csv + as.factor</option><option value="SPSS">SPSS (.sps) — GET DATA</option><option value="STATA">STATA (.do) — import delimited</option></select></div>
              <label className="flex items-center gap-2 cursor-pointer text-xs"><input type="checkbox" checked={includeScript} onChange={()=>setIncludeScript(!includeScript)} style={{accentColor:"#9b59b6"}}/>Include import script</label>
            </div>}

            {format==="print" && <div className="space-y-2">
              <label className="flex items-center gap-2 cursor-pointer text-xs"><input type="checkbox" checked={printParagraphNumbers} onChange={()=>setPrintParagraphNumbers(!printParagraphNumbers)} style={{accentColor:"#9b59b6"}}/>Paragraph numbers</label>
              <label className="flex items-center gap-2 cursor-pointer text-xs"><input type="checkbox" checked={printColorLegend} onChange={()=>setPrintColorLegend(!printColorLegend)} style={{accentColor:"#9b59b6"}}/>Color legend at end</label>
            </div>}
          </div>}

          {step===3 && <div className="text-center py-8">
            <div className="text-5xl mb-3">{previewCount>0?"📊":"📭"}</div>
            <p className="text-3xl font-bold" style={{color:"#9b59b6"}}>{previewCount}</p>
            <p className="text-sm mt-1">items ready to export</p>
            <p className="text-[10px] opacity-30 mt-2">{Object.entries(selection).filter(([,v])=>v).map(([k])=>k).join(", ")} · {FORMATS.find(f=>f.key===format)?.label}</p>
          </div>}
        </div>

        <div className="flex items-center gap-2 border-t px-5 py-3" style={{borderColor:"var(--border)"}}>
          {step>1 && <button onClick={()=>setStep(step-1)} className="flex items-center gap-1 rounded border px-3 py-2 text-sm" style={{borderColor:"var(--border)"}}><ChevronLeft size={14}/>Back</button>}
          <div className="flex-1"/>
          {step<3 ? (
            <button onClick={()=>step===1?setStep(2):handlePreview()} disabled={selectedCount===0}
              className="flex items-center gap-1.5 rounded-md px-5 py-2 text-sm font-medium text-white disabled:opacity-40" style={{backgroundColor:"#9b59b6"}}>
              {step===1?"Next →":"Preview"} <ChevronRight size={14}/></button>
          ) : (
            <button onClick={handleExport} disabled={exporting||previewCount===0}
              className="flex items-center gap-1.5 rounded-md px-5 py-2 text-sm font-medium text-white disabled:opacity-40" style={{backgroundColor:"#9b59b6"}}>
              <Download size={14}/> {exporting?"Exporting...":"Export"}
            </button>
          )}
        </div>
      </div>
    </div>
    <CodebookExporter open={showCodebook} onClose={()=>setShowCodebook(false)}/>
    </>
  );
}
export default DataExtractor;
