import { useState, useEffect } from "react";
import { X, Download, BookOpen } from "lucide-react";
import { useProjectStore } from "../../stores/projectStore";
import { useToast } from "../../stores/toastStore";
import { execQuery } from "../../lib/tauriBridge";
import { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, HeadingLevel, WidthType } from "docx";
import * as XLSX from "xlsx";

interface Props { open: boolean; onClose: () => void; }

interface CodebookCategory {
  id: string; nombre: string; descripcion: string; color_hex: string;
  regla_codificacion: string | null; cita_ejemplo: string | null;
  codigo_padre_id: string | null; nivel: number; ruta: string;
  enr: number; densidad: number; peso_prom: number;
  fecha_creacion?: string; investigador_nombre?: string;
}

export function CodebookExporter({ open, onClose }: Props) {
  const project = useProjectStore((s) => s.project);
  const { toast } = useToast();
  const [structure, setStructure] = useState<"hierarchical"|"flat">("hierarchical");
  const [format, setFormat] = useState<"docx"|"xlsx"|"pdf">("docx");
  const [categories, setCategories] = useState<CodebookCategory[]>([]);
  const [loading, setLoading] = useState(false);
  const [introText, setIntroText] = useState("This codebook documents the category system used in this qualitative research project. Each category includes its definition, coding rule, and illustrative examples from the data.");
  const [options, setOptions] = useState({
    cover: true, intro: true, tree: true, definitions: true,
    rules: true, example: true, rooting: true, density: true,
    researcher: false, date: false, weight: false,
  });

  useEffect(() => {
    if (open && project?.id) loadCategories();
  }, [open, project?.id]);

  const loadCategories = async () => {
    if (!project?.id) return;
    setLoading(true);
    try {
      const result = await execQuery(
        `WITH RECURSIVE hier AS (
          SELECT id, nombre, COALESCE(descripcion,'') as descripcion, color_hex,
                 COALESCE(regla_codificacion,'') as regla_codificacion,
                 COALESCE(cita_ejemplo,'') as cita_ejemplo, codigo_padre_id,
                 fecha_creacion,
                 0 AS nivel, nombre AS ruta
          FROM codigos WHERE codigo_padre_id IS NULL AND proyecto_id=?1
          UNION ALL
          SELECT c.id, c.nombre, COALESCE(c.descripcion,''), c.color_hex,
                 COALESCE(c.regla_codificacion,''), COALESCE(c.cita_ejemplo,''),
                 c.codigo_padre_id, c.fecha_creacion,
                 h.nivel+1, h.ruta||' > '||c.nombre
          FROM codigos c JOIN hier h ON c.codigo_padre_id=h.id
        )
        SELECT h.*, COUNT(DISTINCT cc.cita_id) as enr,
               COUNT(DISTINCT rc.id) as densidad,
               COALESCE(AVG(cc.peso_codificacion),0) as peso_prom
        FROM hier h
        LEFT JOIN citas_codigos cc ON cc.codigo_id=h.id
        LEFT JOIN relaciones_codigos rc ON rc.codigo_origen_id=h.id
        GROUP BY h.id ORDER BY h.ruta`,
        [project.id]
      );
      const cats = result.rows as unknown as CodebookCategory[];

      // Load example citations for each category
      for (const c of cats) {
        try {
          const ex = await execQuery(
            "SELECT texto_seleccionado, pagina, d.nombre as doc FROM citas c2 JOIN citas_codigos cc ON cc.cita_id=c2.id JOIN documentos d ON c2.documento_id=d.id WHERE cc.codigo_id=?1 LIMIT 1",
            [c.id]
          );
          if (ex.rows.length>0) {
            const row: any = ex.rows[0];
            c.cita_ejemplo = `"${(row.texto_seleccionado||"").slice(0,200)}" (${row.doc||"?"}, p.${row.pagina||"?"})`;
          }
        } catch {}
      }

      setCategories(cats);
    } catch { setCategories([]); }
    finally { setLoading(false); }
  };

  const toggleOpt = (k: string) => setOptions(prev => ({...prev, [k]: !(prev as any)[k]}));

  const exportDocx = async () => {
    const children: any[] = [];

    if (options.cover) {
      children.push(
        new Paragraph({ spacing:{before:1200}, children:[new TextRun({text:`Codebook: ${project?.name||""}`,bold:true,size:48})], alignment: undefined }),
        new Paragraph({ children:[new TextRun({text:"Category System Documentation",size:28,italics:true})] }),
        new Paragraph({ children:[new TextRun({text:new Date().toLocaleDateString(),size:22})] }),
      );
    }

    if (options.intro) {
      children.push(
        new Paragraph({ children:[new TextRun({text:"Methodological Introduction",bold:true,size:32})], heading: HeadingLevel.HEADING_1 }),
        new Paragraph({ children:[new TextRun({text:introText,size:22})] }),
      );
    }

    if (options.tree) {
      children.push(new Paragraph({ children:[new TextRun({text:"Category Hierarchy",bold:true,size:32})], heading: HeadingLevel.HEADING_1 }));
    }

    for (const c of categories) {
      const level = structure==="hierarchical" ? c.nivel : 0;
      const heading = level===0 ? HeadingLevel.HEADING_2 : HeadingLevel.HEADING_3;

      // Category name as heading with color
      children.push(new Paragraph({
        children:[new TextRun({text:"■ ",color:c.color_hex.replace("#",""),size:24-level*2}), new TextRun({text:c.nombre,bold:true,size:24-level*2})],
        heading,
      }));

      // Properties table per category
      const tableRows: TableRow[] = [];

      if (options.definitions && c.descripcion) {
        tableRows.push(new TableRow({ children: [
          new TableCell({ children:[new Paragraph({children:[new TextRun({text:"Definition",bold:true,size:18})]})], width:{size:25,type:WidthType.PERCENTAGE} }),
          new TableCell({ children:[new Paragraph({children:[new TextRun({text:c.descripcion,size:18})]})], width:{size:75,type:WidthType.PERCENTAGE} }),
        ]}));
      }

      if (options.rules && c.regla_codificacion) {
        tableRows.push(new TableRow({ children: [
          new TableCell({ children:[new Paragraph({children:[new TextRun({text:"Coding Rule",bold:true,size:18})]})], width:{size:25,type:WidthType.PERCENTAGE} }),
          new TableCell({ children:[new Paragraph({children:[new TextRun({text:c.regla_codificacion,size:18})]})], width:{size:75,type:WidthType.PERCENTAGE} }),
        ]}));
      }

      if (options.rooting || options.density || options.weight) {
        const metrics: string[] = [];
        if (options.rooting) metrics.push(`Rooting: ${c.enr} segments`);
        if (options.density) metrics.push(`Density: ${c.densidad} relations`);
        if (options.weight) metrics.push(`Avg. weight: ${c.peso_prom.toFixed(1)}`);
        if (options.researcher && c.investigador_nombre) metrics.push(`Created by: ${c.investigador_nombre}`);
        if (options.date && c.fecha_creacion) metrics.push(`Created: ${c.fecha_creacion}`);

        if (metrics.length>0) {
          tableRows.push(new TableRow({ children: [
            new TableCell({ children:[new Paragraph({children:[new TextRun({text:"Metrics",bold:true,size:18})]})], width:{size:25,type:WidthType.PERCENTAGE} }),
            new TableCell({ children:[new Paragraph({children:[new TextRun({text:metrics.join(" · "),size:18})]})], width:{size:75,type:WidthType.PERCENTAGE} }),
          ]}));
        }
      }

      if (options.example && c.cita_ejemplo) {
        tableRows.push(new TableRow({ children: [
          new TableCell({ children:[new Paragraph({children:[new TextRun({text:"Example",bold:true,size:18})]})], width:{size:25,type:WidthType.PERCENTAGE} }),
          new TableCell({ children:[new Paragraph({children:[new TextRun({text:c.cita_ejemplo,size:18,italics:true})]})], width:{size:75,type:WidthType.PERCENTAGE} }),
        ]}));
      }

      if (tableRows.length>0) {
        children.push(new Table({ rows: tableRows, width:{size:100,type:WidthType.PERCENTAGE} }));
      }
    }

    if (children.length===0) children.push(new Paragraph({ children:[new TextRun({text:"No categories defined. Create categories in the Documents tab first.",italics:true})] }));

    const doc = new Document({ sections:[{ children }] });
    const blob = await Packer.toBlob(doc);
    const url = URL.createObjectURL(blob); const a = document.createElement("a");
    a.href=url; a.download=`${(project?.name||"codebook").replace(/\s+/g,"_")}_codebook.docx`; a.click();
    URL.revokeObjectURL(url);
    toast.success("✅ Codebook exported", `${categories.length} categories · ${(blob.size/1024).toFixed(1)} KB`);
  };

  const exportXlsx = () => {
    const ws = XLSX.utils.json_to_sheet(categories.map(c => ({
      Folder: c.ruta.split(" > ").slice(0,-1).join(" > ") || "Root",
      "Parent category": c.codigo_padre_id||"",
      Name: c.nombre,
      Definition: c.descripcion,
      Rule: c.regla_codificacion||"",
      "Example citation": c.cita_ejemplo||"",
      Rooting: c.enr,
      Density: c.densidad,
      "Avg. weight": c.peso_prom.toFixed(1),
      "Color hex": c.color_hex,
      "Created": c.fecha_creacion||"",
      Researcher: c.investigador_nombre||"",
    })));
    const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, "Codebook");
    XLSX.writeFile(wb, `${(project?.name||"codebook").replace(/\s+/g,"_")}_codebook.xlsx`);
    toast.success("✅ Codebook exported", `${categories.length} categories to Excel`);
  };

  const exportPdf = () => {
    let html = `<html><head><style>body{font-family:Georgia;font-size:11pt;line-height:1.8;max-width:800px;margin:0 auto;padding:20px;}
      h1{font-size:24pt;border-bottom:2px solid #9b59b6;padding-bottom:8px;}
      h2{font-size:16pt;margin-top:24px;}
      table{width:100%;border-collapse:collapse;margin:8px 0 16px;}
      td{padding:6px 10px;border:1px solid #ddd;vertical-align:top;font-size:10pt;}
      td:first-child{font-weight:bold;width:25%;background:#f7f7f7;}
      @media print{@page{size:A4;margin:20mm;}}</style></head><body>`;
    html += `<h1>Codebook: ${project?.name||""}</h1>`;
    if (options.intro) html += `<p style="color:#666;">${introText}</p>`;

    for (const c of categories) {
      html += `<h2 style="color:${c.color_hex}">■ ${c.nombre}</h2>`;
      html += `<table>`;
      if (options.definitions && c.descripcion) html += `<tr><td>Definition</td><td>${c.descripcion}</td></tr>`;
      if (options.rules && c.regla_codificacion) html += `<tr><td>Coding Rule</td><td>${c.regla_codificacion}</td></tr>`;
      if (options.rooting) html += `<tr><td>Rooting</td><td>${c.enr} segments</td></tr>`;
      if (options.density) html += `<tr><td>Density</td><td>${c.densidad} relations</td></tr>`;
      if (options.weight) html += `<tr><td>Avg. Weight</td><td>${c.peso_prom.toFixed(1)}</td></tr>`;
      if (options.example && c.cita_ejemplo) html += `<tr><td>Example</td><td style="font-style:italic;">${c.cita_ejemplo}</td></tr>`;
      if (options.researcher && c.investigador_nombre) html += `<tr><td>Researcher</td><td>${c.investigador_nombre}</td></tr>`;
      if (options.date && c.fecha_creacion) html += `<tr><td>Created</td><td>${c.fecha_creacion}</td></tr>`;
      html += `</table>`;
    }
    html += `</body></html>`;

    const win = window.open("","_blank","width=900,height=700");
    if(win){win.document.write(html);win.document.close();setTimeout(()=>win.print(),500);}
  };

  const handleExport = () => { if(format==="docx") exportDocx(); else if(format==="xlsx") exportXlsx(); else exportPdf(); };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center" style={{backgroundColor:"rgba(0,0,0,0.5)"}}>
      <div className="w-full max-w-[560px] rounded-xl shadow-2xl flex flex-col" style={{maxHeight:"85vh",backgroundColor:"var(--bg-primary)",color:"var(--text-primary)"}} onClick={e=>e.stopPropagation()}>
        <div className="flex items-center justify-between border-b px-5 py-3" style={{borderColor:"var(--border)"}}>
          <div className="flex items-center gap-2"><BookOpen size={18} style={{color:"#9b59b6"}}/><h2 className="text-base font-bold">📚 Codebook Export</h2></div>
          <button onClick={onClose} className="rounded p-1 hover:bg-gray-100"><X size={16}/></button>
        </div>

        <div className="p-5 space-y-4 overflow-y-auto flex-1">
          {/* Content checkboxes */}
          <div>
            <p className="text-[10px] font-semibold uppercase opacity-40 mb-2">Content Sections</p>
            <div className="grid grid-cols-2 gap-1.5">
              {Object.entries(options).map(([k,v])=><label key={k} className="flex items-center gap-2 text-xs cursor-pointer"><input type="checkbox" checked={v} onChange={()=>toggleOpt(k)} style={{accentColor:"#9b59b6"}}/>{k.replace(/([A-Z])/g," $1").replace(/^./,s=>s.toUpperCase())}</label>)}
            </div>
          </div>

          {/* Intro textarea */}
          <div>
            <p className="text-[10px] font-semibold uppercase opacity-40 mb-1">Methodological Introduction (editable)</p>
            <textarea value={introText} onChange={e=>setIntroText(e.target.value)} rows={3}
              className="w-full rounded border px-3 py-2 text-xs resize-none" style={{borderColor:"var(--border)",backgroundColor:"var(--bg-primary)"}}/>
          </div>

          {/* Structure */}
          <div>
            <p className="text-[10px] font-semibold uppercase opacity-40 mb-2">Structure</p>
            <div className="flex gap-2">{["hierarchical","flat"].map(s=><button key={s} onClick={()=>setStructure(s as any)} className={`rounded px-4 py-1.5 text-xs ${structure===s?"text-white":""}`} style={{backgroundColor:structure===s?"#9b59b6":"var(--bg-secondary)"}}>{s==="hierarchical"?"Hierarchical (indented)":"Flat (alphabetical)"}</button>)}</div>
          </div>

          {/* Format */}
          <div>
            <p className="text-[10px] font-semibold uppercase opacity-40 mb-2">Export Format</p>
            <div className="flex gap-2">{["docx","xlsx","pdf"].map(f=><button key={f} onClick={()=>setFormat(f as any)} className={`rounded px-4 py-1.5 text-xs ${format===f?"text-white":""}`} style={{backgroundColor:format===f?"#9b59b6":"var(--bg-secondary)"}}>{f==="docx"?"Word (.docx)":f==="xlsx"?"Excel (.xlsx)":"PDF"}</button>)}</div>
          </div>

          <div className="text-xs">
            {loading ? <span className="opacity-40">Loading from database...</span> :
              <span className="opacity-40">{categories.length} categories loaded · {categories.reduce((s,c)=>s+c.enr,0)} total segments rooted</span>}
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 border-t px-5 py-3" style={{borderColor:"var(--border)"}}>
          <button onClick={onClose} className="rounded border px-4 py-2 text-xs" style={{borderColor:"var(--border)"}}>Cancel</button>
          <button onClick={handleExport} disabled={loading}
            className="inline-flex items-center gap-2 rounded-md px-5 py-2 text-sm font-medium text-white disabled:opacity-40" style={{backgroundColor:"#9b59b6"}}>
            <Download size={14}/> Export Codebook
          </button>
        </div>
      </div>
    </div>
  );
}
export default CodebookExporter;
