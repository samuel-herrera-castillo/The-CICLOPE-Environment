import { useState, useEffect } from "react";
import { X, Download, ChevronLeft, FileText, Loader2, Save, ExternalLink } from "lucide-react";
import { useProjectStore } from "../../stores/projectStore";
import { useToast } from "../../stores/toastStore";
import { getDistribution, getCooccurrences, execQuery, getNetworks, saveMemo } from "../../lib/tauriBridge";
import { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, HeadingLevel, AlignmentType, WidthType } from "docx";

interface Props { open: boolean; onClose: () => void; }
interface ContentOption {
  key: string; label: string; checked: boolean;
  subOptions?: { key: string; label: string; checked: boolean }[];
}

export function ReportGenerator({ open, onClose }: Props) {
  const project = useProjectStore((s) => s.project);
  const categories = useProjectStore((s) => s.categories);
  const documents = useProjectStore((s) => s.documents);
  const memos = useProjectStore((s) => s.memos);
  const { toast } = useToast();
  const [step, setStep] = useState(1);
  const [generating, setGenerating] = useState(false);
  const [progress, setProgress] = useState("");
  const [previewHtml, setPreviewHtml] = useState("");
  const [downloadUrl, setDownloadUrl] = useState("");
  const [downloadName, setDownloadName] = useState("");

  // Paso 1 — all content options per spec
  const [contentOptions, setContentOptions] = useState<ContentOption[]>([
    { key: "portada", label: "Cover page", checked: true },
    { key: "toc", label: "Automatic table of contents", checked: true },
    { key: "documents", label: "Document list", checked: false, subOptions: [
      { key: "doc_name", label: "Name", checked: true }, { key: "doc_type", label: "Type", checked: true },
      { key: "doc_date", label: "Import date", checked: true }, { key: "doc_size", label: "Size", checked: false },
    ]},
    { key: "categories", label: "Category system", checked: true, subOptions: [
      { key: "cat_tree", label: "Hierarchical tree", checked: true }, { key: "cat_defs", label: "Definitions", checked: true },
      { key: "cat_rules", label: "Coding rules", checked: true }, { key: "cat_rooting", label: "Rooting (N segments)", checked: true },
      { key: "cat_density", label: "Density", checked: false }, { key: "cat_example", label: "Example citation", checked: false },
    ]},
    { key: "segments", label: "Segments by category", checked: false, subOptions: [
      { key: "seg_full", label: "Full text", checked: true }, { key: "seg_ref", label: "Reference only (doc, page)", checked: false },
      { key: "seg_weight", label: "Coding weight", checked: true }, { key: "seg_comment", label: "Segment comment", checked: false },
    ]},
    { key: "memos", label: "Memos", checked: false, subOptions: [
      { key: "memo_theory", label: "Theoretical", checked: true }, { key: "memo_method", label: "Methodological", checked: true },
      { key: "memo_analytic", label: "Analytical", checked: true }, { key: "memo_all", label: "All types", checked: false },
    ]},
    { key: "distribution", label: "Distribution table", checked: false },
    { key: "cooccurrences", label: "Co-occurrences (NxN table)", checked: false },
    { key: "concordance", label: "Inter-researcher agreement", checked: false },
    { key: "summaries", label: "Thematic summaries", checked: false },
    { key: "networks", label: "Network & visualization images", checked: false },
    { key: "journal", label: "Research journal", checked: false },
    { key: "audit", label: "Change audit trail", checked: false },
  ]);

  // Paso 2 — format state
  const [pageSize, setPageSize] = useState<"A4"|"Letter">("A4");
  const [font, setFont] = useState("Calibri");
  const [fontSize, setFontSize] = useState("11pt");
  const [lineSpacing, setLineSpacing] = useState("1.5");
  const [lineNumbers, setLineNumbers] = useState(false);
  const [paraMarks, setParaMarks] = useState(false);
  const [header, setHeader] = useState(project?.name || "");
  const [footer, setFooter] = useState(`KDCM · ${new Date().toLocaleDateString()}`);
  const [watermark, setWatermark] = useState("");
  const [filterCategories, setFilterCategories] = useState<string[]>([]);
  const [filterResearcher, setFilterResearcher] = useState("");
  const [filterDateFrom, setFilterDateFrom] = useState("");
  const [filterDateTo, setFilterDateTo] = useState("");
  const [researchers, setResearchers] = useState<{id:string;nombre:string}[]>([]);

  const toggleOption = (key: string) => setContentOptions(prev => prev.map(o => o.key===key ? {...o, checked:!o.checked} : o));
  const toggleSub = (pk: string, sk: string) => setContentOptions(prev => prev.map(o => {
    if (o.key===pk && o.subOptions) return {...o, subOptions: o.subOptions.map(s => s.key===sk ? {...s,checked:!s.checked} : s)};
    return o;
  }));

  // Load researchers on open
  useEffect(() => {
    if (open && project?.id) {
      execQuery("SELECT id, nombre FROM investigadores WHERE activo=1 ORDER BY nombre", [])
        .then(r => setResearchers(r.rows as any[])).catch(()=>{});
    }
  }, [open, project?.id]);

  useEffect(() => { if (open && step===3 && project?.id) generatePreview(); }, [open, step, contentOptions]);

  const generatePreview = async () => {
    const pid = project?.id; if (!pid) return;
    const parts: string[] = [`<div style="font-family:${font};font-size:${fontSize};line-height:${lineSpacing};max-width:800px;margin:0 auto;">`];
    if (watermark) parts.push(`<div style="position:fixed;top:50%;left:50%;transform:translate(-50%,-50%) rotate(-45deg);font-size:72px;color:rgba(0,0,0,0.06);pointer-events:none;z-index:0;white-space:nowrap;">${watermark}</div>`);

    if (contentOptions.find(o=>o.key==="portada")?.checked) {
      parts.push(`<div style="text-align:center;padding-top:80px;"><h1>${project?.name||"Report"}</h1><p style="font-size:14pt;">${project?.researcherName||""}</p><p style="color:#666;">${new Date().toLocaleDateString()}</p></div><hr/>`);
    }
    if (contentOptions.find(o=>o.key==="categories")?.checked) {
      parts.push(`<h2>1. Category System</h2>`);
      if (categories.length===0) parts.push(`<p><em>No categories defined yet. Create categories in the Documents tab.</em></p>`);
      else { parts.push(`<ul>`); categories.forEach(c => parts.push(`<li><span style="color:${c.color}">■</span> <b>${c.name}</b>: ${c.description||"No definition"}</li>`)); parts.push(`</ul>`); }
    }
    if (contentOptions.find(o=>o.key==="documents")?.checked) {
      parts.push(`<h2>2. Documents</h2>`);
      if (documents.length===0) parts.push(`<p><em>No documents imported yet.</em></p>`);
      else { parts.push(`<table border=1 cellpadding=4 style="border-collapse:collapse;width:100%;"><tr><th>Name</th><th>Type</th><th>Date</th></tr>`); documents.forEach(d => parts.push(`<tr><td>${d.name}</td><td>${d.type}</td><td>${d.addedAt.slice(0,10)}</td></tr>`)); parts.push(`</table>`); }
    }
    if (contentOptions.find(o=>o.key==="memos")?.checked) {
      parts.push(`<h2>3. Memos</h2>`);
      const memoOpt = contentOptions.find(o=>o.key==="memos");
      const filterTypes: string[] = [];
      if (memoOpt?.subOptions?.find(s=>s.key==="memo_theory")?.checked) filterTypes.push("theoretical");
      if (memoOpt?.subOptions?.find(s=>s.key==="memo_method")?.checked) filterTypes.push("methodological");
      if (memoOpt?.subOptions?.find(s=>s.key==="memo_analytic")?.checked) filterTypes.push("analytical");
      const filtered = memoOpt?.subOptions?.find(s=>s.key==="memo_all")?.checked ? memos : memos.filter(m => filterTypes.includes(m.content));
      if (filtered.length===0) parts.push(`<p><em>No memos match the selected types.</em></p>`);
      else filtered.forEach(m => parts.push(`<h3>${m.title}</h3><div>${m.content.replace(/<[^>]+>/g,"").slice(0,500)}</div>`));
    }
    if (contentOptions.find(o=>o.key==="distribution")?.checked && project?.id) {
      try {
        const dist = await getDistribution(project.id);
        parts.push(`<h2>Distribution Table</h2><p>${dist.count} code-document pairs across ${new Set(dist.rows.map((r:any)=>r.categoria)).size} categories and ${new Set(dist.rows.map((r:any)=>r.documento)).size} documents.</p>`);
      } catch { parts.push(`<p><em>No distribution data.</em></p>`); }
    }
    parts.push(`</div>`); setPreviewHtml(parts.join("\n"));
  };

  // ── Word generation with real SQLite ──
  const generateWord = async () => {
    if (!project?.id) return;
    setGenerating(true);
    try {
      const children: any[] = [];
      let secNum = 0;
      const heading = (title: string) => { secNum++; return new Paragraph({ children:[new TextRun({text:`${secNum}. ${title}`,bold:true,size:32})], heading:HeadingLevel.HEADING_1 }); };

      // Cover
      if (contentOptions.find(o=>o.key==="portada")?.checked) {
        children.push(new Paragraph({ spacing:{before:1200}, children:[new TextRun({text:project.name||"KDCM Report",bold:true,size:52})], alignment:AlignmentType.CENTER }));
        children.push(new Paragraph({ children:[new TextRun({text:project.researcherName||"",size:28})], alignment:AlignmentType.CENTER }));
        children.push(new Paragraph({ children:[new TextRun({text:new Date().toLocaleDateString(),size:24})], alignment:AlignmentType.CENTER }));
      }

      if (contentOptions.find(o=>o.key==="toc")?.checked) {
        children.push(new Paragraph({ children:[new TextRun({text:"Table of Contents",bold:true,size:32})], heading:HeadingLevel.HEADING_1 }));
        const tocItems: string[] = [];
        if (contentOptions.find(o=>o.key==="categories")?.checked) tocItems.push("Category System");
        if (contentOptions.find(o=>o.key==="documents")?.checked) tocItems.push("Document List");
        if (contentOptions.find(o=>o.key==="segments")?.checked) tocItems.push("Coded Segments by Category");
        if (contentOptions.find(o=>o.key==="memos")?.checked) tocItems.push("Memos");
        if (contentOptions.find(o=>o.key==="distribution")?.checked) tocItems.push("Distribution Table");
        if (contentOptions.find(o=>o.key==="cooccurrences")?.checked) tocItems.push("Co-occurrences");
        if (contentOptions.find(o=>o.key==="concordance")?.checked) tocItems.push("Inter-researcher Agreement");
        tocItems.forEach((item, i) => children.push(new Paragraph({ children:[new TextRun({text:`${i+1}. ${item}`,size:22})] })));
      }

      // Categories — with recursive tree
      if (contentOptions.find(o=>o.key==="categories")?.checked) {
        setProgress("Loading categories from database...");
        children.push(heading("Category System"));
        const catOpt = contentOptions.find(o=>o.key==="categories");
        try {
          const result = await execQuery(
            `WITH RECURSIVE hier AS (
              SELECT id, nombre, COALESCE(descripcion,'') as desc, color_hex, COALESCE(regla_codificacion,'') as regla, codigo_padre_id, 0 as nivel, nombre as ruta
              FROM codigos WHERE codigo_padre_id IS NULL AND proyecto_id=?1
              UNION ALL
              SELECT c.id, c.nombre, COALESCE(c.descripcion,''), c.color_hex, COALESCE(c.regla_codificacion,''), c.codigo_padre_id, h.nivel+1, h.ruta||' > '||c.nombre
              FROM codigos c JOIN hier h ON c.codigo_padre_id=h.id
            )
            SELECT h.*, COUNT(DISTINCT cc.cita_id) as enr, COUNT(DISTINCT rc.id) as densidad FROM hier h
            LEFT JOIN citas_codigos cc ON cc.codigo_id=h.id
            LEFT JOIN relaciones_codigos rc ON rc.codigo_origen_id=h.id
            GROUP BY h.id ORDER BY h.ruta`,
            [project.id]
          );
          if (result.rows.length===0) {
            children.push(new Paragraph({ children:[new TextRun({text:"No categories defined.",italics:true})] }));
          } else {
            for (const c of result.rows as any[]) {
              const indent = "  ".repeat(c.nivel||0);
              children.push(new Paragraph({ children:[new TextRun({text:`${indent}${c.nombre}`,bold:true,size:24-(c.nivel||0)*2,color:(c.color_hex||"#000").replace("#","")})] }));
              if (catOpt?.subOptions?.find(s=>s.key==="cat_defs")?.checked && c.desc) children.push(new Paragraph({ children:[new TextRun({text:`${indent}Definition: ${c.desc}`,size:20})] }));
              if (catOpt?.subOptions?.find(s=>s.key==="cat_rules")?.checked && c.regla) children.push(new Paragraph({ children:[new TextRun({text:`${indent}Rule: ${c.regla}`,size:20})] }));
              if (catOpt?.subOptions?.find(s=>s.key==="cat_rooting")?.checked) children.push(new Paragraph({ children:[new TextRun({text:`${indent}Rooting: ${c.enr} segments`,size:20})] }));
              if (catOpt?.subOptions?.find(s=>s.key==="cat_density")?.checked) children.push(new Paragraph({ children:[new TextRun({text:`${indent}Density: ${c.densidad} relations`,size:20})] }));
              if (catOpt?.subOptions?.find(s=>s.key==="cat_example")?.checked) {
                const ex = await execQuery("SELECT texto_seleccionado FROM citas c JOIN citas_codigos cc ON cc.cita_id=c.id WHERE cc.codigo_id=?1 LIMIT 1", [c.id]);
                if (ex.rows.length>0) children.push(new Paragraph({ children:[new TextRun({text:`${indent}Example: "${(ex.rows[0] as any).texto_seleccionado?.slice(0,150)||""}"`,size:20,italics:true})] }));
              }
            }
          }
        } catch { children.push(new Paragraph({ children:[new TextRun({text:"Could not load categories.",italics:true})] })); }
      }

      // Documents
      if (contentOptions.find(o=>o.key==="documents")?.checked) {
        setProgress("Loading documents...");
        children.push(heading("Document List"));
        const docOpt = contentOptions.find(o=>o.key==="documents");
        if (documents.length===0) {
          children.push(new Paragraph({ children:[new TextRun({text:"No documents imported.",italics:true})] }));
        } else {
          const headers: string[] = [];
          if (docOpt?.subOptions?.find(s=>s.key==="doc_name")?.checked) headers.push("Name");
          if (docOpt?.subOptions?.find(s=>s.key==="doc_type")?.checked) headers.push("Type");
          if (docOpt?.subOptions?.find(s=>s.key==="doc_date")?.checked) headers.push("Import Date");
          if (docOpt?.subOptions?.find(s=>s.key==="doc_size")?.checked) headers.push("Size");

          if (headers.length>0) {
            const rows = [
              new TableRow({ children: headers.map(h=>new TableCell({children:[new Paragraph({children:[new TextRun({text:h,bold:true})]})]})) }),
              ...documents.map(d => {
                const vals: string[] = [];
                if (docOpt?.subOptions?.find(s=>s.key==="doc_name")?.checked) vals.push(d.name);
                if (docOpt?.subOptions?.find(s=>s.key==="doc_type")?.checked) vals.push(d.type);
                if (docOpt?.subOptions?.find(s=>s.key==="doc_date")?.checked) vals.push(d.addedAt.slice(0,10));
                if (docOpt?.subOptions?.find(s=>s.key==="doc_size")?.checked) vals.push(`${(d.size/1024).toFixed(1)} KB`);
                return new TableRow({ children: vals.map(v=>new TableCell({children:[new Paragraph({children:[new TextRun({text:v})]})]})) });
              }),
            ];
            children.push(new Table({ rows, width:{size:100,type:WidthType.PERCENTAGE} }));
          }
        }
      }

      // Segments
      if (contentOptions.find(o=>o.key==="segments")?.checked) {
        setProgress("Loading coded segments...");
        children.push(heading("Coded Segments by Category"));
        const segOpt = contentOptions.find(o=>o.key==="segments");
        try {
          let sql = `SELECT c.texto_seleccionado, c.pagina, c.comentario, d.nombre as doc, co.nombre as categoria, cc.peso_codificacion
             FROM citas c JOIN citas_codigos cc ON cc.cita_id=c.id
             JOIN codigos co ON cc.codigo_id=co.id JOIN documentos d ON c.documento_id=d.id
             WHERE co.proyecto_id=?1`;
          const params: any[] = [project.id];

          if (filterCategories.length>0) { sql += ` AND co.id IN (${filterCategories.map(()=>'?').join(',')})`; params.push(...filterCategories); }
          if (filterResearcher) { sql += ` AND cc.investigador_id=?${params.length+1}`; params.push(filterResearcher); }
          if (filterDateFrom) { sql += ` AND c.fecha_creacion>=?${params.length+1}`; params.push(filterDateFrom); }
          if (filterDateTo) { sql += ` AND c.fecha_creacion<=?${params.length+1}`; params.push(filterDateTo); }

          sql += " ORDER BY co.nombre, d.nombre, c.pagina LIMIT 500";
          const segResult = await execQuery(sql, params);

          if (segResult.rows.length===0) {
            children.push(new Paragraph({ children:[new TextRun({text:"No coded segments found.",italics:true})] }));
          } else {
            const byCat = new Map<string,any[]>();
            segResult.rows.forEach((r:any) => { const k=r.categoria; if(!byCat.has(k)) byCat.set(k,[]); byCat.get(k)!.push(r); });
            for (const [cat, segs] of byCat) {
              children.push(new Paragraph({ children:[new TextRun({text:cat,bold:true,size:24})] }));
              for (const seg of segs.slice(0,15)) {
                const fullText = segOpt?.subOptions?.find(s=>s.key==="seg_full")?.checked;
                if (fullText) children.push(new Paragraph({ children:[new TextRun({text:`"${(seg.texto_seleccionado||"").slice(0,300)}"`,size:20,italics:true})] }));
                const refOnly = segOpt?.subOptions?.find(s=>s.key==="seg_ref")?.checked;
                const line = [];
                if (refOnly || !fullText) line.push(`${seg.doc}, Page ${seg.pagina}`);
                if (segOpt?.subOptions?.find(s=>s.key==="seg_weight")?.checked) line.push(`Weight: ${seg.peso_codificacion}`);
                if (segOpt?.subOptions?.find(s=>s.key==="seg_comment")?.checked && seg.comentario) line.push(`Comment: ${seg.comentario}`);
                if (line.length>0) children.push(new Paragraph({ children:[new TextRun({text:`— ${line.join(" · ")}`,size:18})] }));
              }
            }
          }
        } catch { children.push(new Paragraph({ children:[new TextRun({text:"Could not load segments.",italics:true})] })); }
      }

      // Memos
      if (contentOptions.find(o=>o.key==="memos")?.checked) {
        setProgress("Loading memos...");
        children.push(heading("Memos"));
        const memoOpt = contentOptions.find(o=>o.key==="memos");
        try {
          const memoTypes: string[] = [];
          if (memoOpt?.subOptions?.find(s=>s.key==="memo_theory")?.checked) memoTypes.push("theoretical");
          if (memoOpt?.subOptions?.find(s=>s.key==="memo_method")?.checked) memoTypes.push("methodological");
          if (memoOpt?.subOptions?.find(s=>s.key==="memo_analytic")?.checked) memoTypes.push("analytical");
          const allChecked = memoOpt?.subOptions?.find(s=>s.key==="memo_all")?.checked;

          let memosFromDB: any[] = [];
          if (allChecked || memoTypes.length===0) {
            const r = await execQuery("SELECT titulo, contenido_html, tipo_memo, fecha_creacion FROM memos WHERE proyecto_id=?1 ORDER BY fecha_modificacion DESC", [project.id]);
            memosFromDB = r.rows;
          } else {
            const placeholders = memoTypes.map(()=>'?').join(',');
            const r = await execQuery(`SELECT titulo, contenido_html, tipo_memo, fecha_creacion FROM memos WHERE proyecto_id=?1 AND tipo_memo IN (${placeholders}) ORDER BY fecha_modificacion DESC`, [project.id, ...memoTypes]);
            memosFromDB = r.rows;
          }

          if (memosFromDB.length===0) {
            children.push(new Paragraph({ children:[new TextRun({text:"No memos found.",italics:true})] }));
          } else {
            for (const m of memosFromDB) {
              children.push(new Paragraph({ children:[new TextRun({text:`${m.titulo||"Untitled"} [${m.tipo_memo||"general"}]`,bold:true,size:24})] }));
              children.push(new Paragraph({ children:[new TextRun({text:(m.contenido_html||"").replace(/<[^>]+>/g,"").slice(0,500),size:22})] }));
            }
          }
        } catch { children.push(new Paragraph({ children:[new TextRun({text:"Could not load memos.",italics:true})] })); }
      }

      // Distribution table
      if (contentOptions.find(o=>o.key==="distribution")?.checked) {
        setProgress("Loading distribution data...");
        children.push(heading("Distribution Table"));
        try {
          const dist = await getDistribution(project.id);
          if (dist.rows.length===0) {
            children.push(new Paragraph({ children:[new TextRun({text:"No distribution data yet. Import documents and create categories first.",italics:true})] }));
          } else {
            const cats = [...new Set(dist.rows.map((r:any)=>r.categoria))];
            const docs = [...new Set(dist.rows.map((r:any)=>r.documento))];
            const matrix = new Map<string, number>();
            dist.rows.forEach((r:any) => matrix.set(`${r.categoria}|||${r.documento}`, r.n));

            const headerRow = new TableRow({ children: [new TableCell({children:[new Paragraph({children:[new TextRun({text:"Category",bold:true,size:16})]})]}), ...docs.map(d=>new TableCell({children:[new Paragraph({children:[new TextRun({text:String(d),bold:true,size:16})]})]}))] });
            const dataRows = cats.map(cat => new TableRow({ children: [
              new TableCell({children:[new Paragraph({children:[new TextRun({text:String(cat),bold:true})]})]}),
              ...docs.map(doc => new TableCell({children:[new Paragraph({children:[new TextRun({text:String(matrix.get(`${cat}|||${doc}`)||0)})]})]}))
            ]}));
            children.push(new Table({ rows:[headerRow, ...dataRows], width:{size:100,type:WidthType.PERCENTAGE} }));
          }
        } catch { children.push(new Paragraph({ children:[new TextRun({text:"Could not load distribution.",italics:true})] })); }
      }

      // Co-occurrences
      if (contentOptions.find(o=>o.key==="cooccurrences")?.checked) {
        setProgress("Loading co-occurrences...");
        children.push(heading("Co-occurrences Matrix"));
        try {
          const cooc = await getCooccurrences(project.id);
          if (cooc.rows.length===0) {
            children.push(new Paragraph({ children:[new TextRun({text:"No co-occurrences found.",italics:true})] }));
          } else {
            const rows = [new TableRow({ children:["Category A","Category B","N"].map(h=>new TableCell({children:[new Paragraph({children:[new TextRun({text:h,bold:true})]})]})) })];
            cooc.rows.forEach((r:any) => rows.push(new TableRow({ children:[r.cat_a||"",r.cat_b||"",String(r.n||0)].map(v=>new TableCell({children:[new Paragraph({children:[new TextRun({text:v})]})]})) })));
            children.push(new Table({ rows, width:{size:100,type:WidthType.PERCENTAGE} }));
          }
        } catch { children.push(new Paragraph({ children:[new TextRun({text:"Could not load co-occurrences.",italics:true})] })); }
      }

      // Concordance
      if (contentOptions.find(o=>o.key==="concordance")?.checked) {
        setProgress("Loading inter-researcher agreement...");
        children.push(heading("Inter-researcher Agreement"));
        try {
          const invs = await execQuery("SELECT DISTINCT i.id, i.nombre FROM investigadores i JOIN citas_codigos cc ON cc.investigador_id=i.id", []);
          if ((invs.rows?.length||0) < 2) {
            children.push(new Paragraph({ children:[new TextRun({text:"Requires 2+ researchers with coded segments.",italics:true})] }));
          } else {
            children.push(new Paragraph({ children:[new TextRun({text:`${invs.rows.length} researchers have coded segments in this project.`,size:22})] }));
            for (const inv of invs.rows as any[]) {
              const cnt = await execQuery("SELECT COUNT(*) as c FROM citas_codigos WHERE investigador_id=?1", [inv.id]);
              children.push(new Paragraph({ children:[new TextRun({text:`${inv.nombre}: ${cnt.rows[0]?.c||0} coded segments`,size:20})] }));
            }
          }
        } catch { children.push(new Paragraph({ children:[new TextRun({text:"Could not load agreement data.",italics:true})] })); }
      }

      // Summaries
      if (contentOptions.find(o=>o.key==="summaries")?.checked) {
        children.push(heading("Thematic Summaries"));
        try {
          const r = await execQuery("SELECT * FROM resumenes_tematicos WHERE proyecto_id=?1", [project.id]);
          if (r.rows.length===0) children.push(new Paragraph({ children:[new TextRun({text:"No thematic summaries created.",italics:true})] }));
          else r.rows.forEach((s:any) => children.push(new Paragraph({ children:[new TextRun({text:s.titulo||s.resumen||"Summary",size:22})] })));
        } catch { children.push(new Paragraph({ children:[new TextRun({text:"No summaries available.",italics:true})] })); }
      }

      // Networks
      if (contentOptions.find(o=>o.key==="networks")?.checked) {
        children.push(heading("Networks & Visualizations"));
        try {
          const nets = await getNetworks(project.id);
          if (nets.length===0) children.push(new Paragraph({ children:[new TextRun({text:"No saved networks.",italics:true})] }));
          else for (const n of nets as any[]) children.push(new Paragraph({ children:[new TextRun({text:`Network: ${n.nombre} (saved ${n.fecha})`,size:22})] }));
        } catch { children.push(new Paragraph({ children:[new TextRun({text:"No networks.",italics:true})] })); }
      }

      // Journal
      if (contentOptions.find(o=>o.key==="journal")?.checked) {
        children.push(heading("Research Journal"));
        try {
          const r = await execQuery("SELECT contenido_html, fecha_entrada FROM diario_investigacion WHERE proyecto_id=?1 ORDER BY fecha_entrada", [project.id]);
          if (r.rows.length===0) children.push(new Paragraph({ children:[new TextRun({text:"No journal entries.",italics:true})] }));
          else r.rows.forEach((e:any) => children.push(new Paragraph({ children:[new TextRun({text:`${e.fecha_entrada}: ${(e.contenido_html||"").replace(/<[^>]+>/g,"").slice(0,300)}`,size:22})] })));
        } catch { children.push(new Paragraph({ children:[new TextRun({text:"No journal.",italics:true})] })); }
      }

      // Audit
      if (contentOptions.find(o=>o.key==="audit")?.checked) {
        children.push(heading("Change Audit Trail"));
        try {
          const r = await execQuery("SELECT tipo_accion, entidad_tipo, investigador_id, fecha FROM historial_cambios WHERE proyecto_id=?1 ORDER BY fecha DESC LIMIT 100", [project.id]);
          if (r.rows.length===0) children.push(new Paragraph({ children:[new TextRun({text:"No audit records.",italics:true})] }));
          else {
            const rows = [new TableRow({ children:["Action","Entity","Researcher","Date"].map(h=>new TableCell({children:[new Paragraph({children:[new TextRun({text:h,bold:true})]})]})) })];
            r.rows.forEach((a:any) => rows.push(new TableRow({ children:[a.tipo_accion||"",a.entidad_tipo||"",a.investigador_id||"",a.fecha||""].map(v=>new TableCell({children:[new Paragraph({children:[new TextRun({text:v})]})]})) })));
            children.push(new Table({ rows, width:{size:100,type:WidthType.PERCENTAGE} }));
          }
        } catch { children.push(new Paragraph({ children:[new TextRun({text:"No audit data.",italics:true})] })); }
      }

      if (children.length===0) children.push(new Paragraph({ children:[new TextRun({text:"No sections selected or no data available.",italics:true,size:24})] }));

      // Build doc
      setProgress("Generating Word file...");
      const doc = new Document({ sections:[{ properties:{page:{size:{width:pageSize==="A4"?11906:12240,height:pageSize==="A4"?16838:15840}}}, children }] });
      const blob = await Packer.toBlob(doc);
      const url = URL.createObjectURL(blob);
      const name = `${(project.name||"report").replace(/\s+/g,"_")}_report.docx`;
      setDownloadUrl(url); setDownloadName(name);

      const a = document.createElement("a"); a.href=url; a.download=name; a.click();
      const pages = Math.ceil(children.length / 8);
      toast.success("✅ Report generated", `${name} · ~${pages} pages · ${(blob.size/1024).toFixed(1)} KB`);

      // Save to project
      if (project.id) {
        saveMemo(`memo-report-${Date.now()}`, project.id, `Report: ${name}`, `Generated report with ${children.length} sections on ${new Date().toLocaleString()}`, "general").catch(()=>{});
      }
    } catch(e:any) { toast.error("Error", e.message||"Could not generate report"); }
    finally { setGenerating(false); setProgress(""); }
  };

  const generatePDF = () => {
    const win = window.open("","_blank","width=900,height=700");
    if(win){
      win.document.write(`<!DOCTYPE html><html><head><title>${project?.name||"Report"}</title><style>@media print{body{margin:20mm}@page{size:${pageSize}}}</style></head><body>${previewHtml}</body></html>`);
      win.document.close();
      setTimeout(()=>win.print(),500);
    }
  };

  const handleSaveToProject = () => {
    if (!project?.id) return;
    const id = `memo-report-${Date.now()}`;
    saveMemo(id, project.id, `Report: ${downloadName}`, previewHtml, "general").then(() => {
      toast.success("💾 Saved to project", "Report linked as document");
    }).catch(() => toast.warning("Saved locally"));
  };

  const handleOpenFile = () => {
    if (downloadUrl) window.open(downloadUrl, "_blank");
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center" style={{backgroundColor:"rgba(0,0,0,0.5)"}}>
      <div className="flex flex-col rounded-xl shadow-2xl" style={{width:"95vw",height:"95vh",backgroundColor:"var(--bg-primary)",color:"var(--text-primary)"}}>
        {/* Header */}
        <div className="flex items-center justify-between border-b px-5 py-3" style={{borderColor:"var(--border)"}}>
          <div className="flex items-center gap-3">
            <FileText size={20} style={{color:"#9b59b6"}}/><h2 className="text-lg font-bold">Generate Report</h2>
            <div className="flex items-center gap-1.5 ml-4 text-[10px]">
              {[1,2,3].map((n) => <div key={n} className="flex items-center gap-1">
                <span className={`inline-flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold ${step===n?"text-white":step>n?"bg-green-100 text-green-700":""}`}
                  style={{backgroundColor:step===n?"#9b59b6":step>n?"#E8F5E9":"var(--bg-secondary)",opacity:step>=n?1:0.3}}>{step>n?"✓":n}</span>
                <span className="capitalize" style={{color:step===n?"#9b59b6":"var(--text-secondary)"}}>{n===1?"Content":n===2?"Format":"Preview & Export"}</span>
                {n<3 && <span className="opacity-20">→</span>}
              </div>)}
            </div>
          </div>
          <button onClick={onClose} className="rounded p-1 hover:bg-gray-100"><X size={18}/></button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-auto p-5">
          {step===1 && <div className="space-y-2">
            <p className="text-xs opacity-40 mb-3">Select sections for your academic report. Each section fetches real data from the project database.</p>
            <div className="grid grid-cols-2 gap-3">
              {contentOptions.map(opt=><div key={opt.key} className="rounded-lg border p-3" style={{borderColor:opt.checked?"#9b59b6":"var(--border)",backgroundColor:opt.checked?"rgba(155,89,182,0.03)":"transparent"}}>
                <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={opt.checked} onChange={()=>toggleOption(opt.key)} className="h-4 w-4 rounded" style={{accentColor:"#9b59b6"}}/><span className="text-sm font-medium">{opt.label}</span></label>
                {opt.checked && opt.subOptions && <div className="mt-2 ml-6 space-y-1 border-l-2 pl-3" style={{borderColor:"rgba(155,89,182,0.3)"}}>{opt.subOptions.map(sub=><label key={sub.key} className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={sub.checked} onChange={()=>toggleSub(opt.key,sub.key)} className="h-3.5 w-3.5 rounded" style={{accentColor:"#9b59b6"}}/><span className="text-xs opacity-60">{sub.label}</span></label>)}</div>}
              </div>)}
            </div>
          </div>}

          {step===2 && <div className="max-w-2xl mx-auto space-y-5">
            <div className="grid grid-cols-2 gap-4">
              <div><label className="block text-xs font-semibold mb-1 opacity-60">Page size</label><div className="flex gap-2">{ ["A4","Letter"].map(s=><button key={s} onClick={()=>setPageSize(s as any)} className={`rounded px-4 py-1.5 text-sm ${pageSize===s?"text-white":""}`} style={{backgroundColor:pageSize===s?"#9b59b6":"var(--bg-secondary)"}}>{s}</button>) }</div></div>
              <div><label className="block text-xs font-semibold mb-1 opacity-60">Font</label><select value={font} onChange={e=>setFont(e.target.value)} className="w-full rounded border px-2 py-1.5 text-sm" style={{borderColor:"var(--border)",backgroundColor:"var(--bg-primary)"}}>{ ["Calibri","Arial","Times New Roman","Garamond"].map(f=><option key={f}>{f}</option>) }</select></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div><label className="block text-xs font-semibold mb-1 opacity-60">Font size</label><select value={fontSize} onChange={e=>setFontSize(e.target.value)} className="w-full rounded border px-2 py-1.5 text-sm" style={{borderColor:"var(--border)",backgroundColor:"var(--bg-primary)"}}>{ ["10pt","11pt","12pt"].map(s=><option key={s}>{s}</option>) }</select></div>
              <div><label className="block text-xs font-semibold mb-1 opacity-60">Line spacing</label><select value={lineSpacing} onChange={e=>setLineSpacing(e.target.value)} className="w-full rounded border px-2 py-1.5 text-sm" style={{borderColor:"var(--border)",backgroundColor:"var(--bg-primary)"}}>{ ["1.0","1.5","2.0"].map(s=><option key={s}>{s}</option>) }</select></div>
            </div>
            <div className="space-y-2">
              <label className="flex items-center gap-2 cursor-pointer text-sm"><input type="checkbox" checked={lineNumbers} onChange={()=>setLineNumbers(!lineNumbers)} style={{accentColor:"#9b59b6"}}/>Line numbers (every 5 lines)</label>
              <label className="flex items-center gap-2 cursor-pointer text-sm"><input type="checkbox" checked={paraMarks} onChange={()=>setParaMarks(!paraMarks)} style={{accentColor:"#9b59b6"}}/>Visible paragraph marks in citations (¶)</label>
            </div>
            <div><label className="block text-xs font-semibold mb-1 opacity-60">Header</label><input value={header} onChange={e=>setHeader(e.target.value)} className="w-full rounded border px-3 py-2 text-sm" style={{borderColor:"var(--border)",backgroundColor:"var(--bg-primary)"}}/></div>
            <div><label className="block text-xs font-semibold mb-1 opacity-60">Footer</label><input value={footer} onChange={e=>setFooter(e.target.value)} className="w-full rounded border px-3 py-2 text-sm" style={{borderColor:"var(--border)",backgroundColor:"var(--bg-primary)"}}/></div>
            <div><label className="block text-xs font-semibold mb-1 opacity-60">Watermark (diagonal 45° gray)</label><input value={watermark} onChange={e=>setWatermark(e.target.value)} placeholder="e.g. CONFIDENTIAL or DRAFT" className="w-full rounded border px-3 py-2 text-sm" style={{borderColor:"var(--border)",backgroundColor:"var(--bg-primary)"}}/></div>

            {/* Content filters */}
            <div className="border-t pt-4" style={{borderColor:"var(--border)"}}>
              <p className="text-xs font-semibold opacity-40 mb-2">CONTENT FILTERS</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] opacity-40 mb-1">Only these categories</label>
                  <select multiple value={filterCategories} onChange={e=>setFilterCategories(Array.from(e.target.selectedOptions, o=>o.value))}
                    className="w-full rounded border px-2 py-1.5 text-xs" style={{borderColor:"var(--border)",backgroundColor:"var(--bg-primary)",minHeight:80}}
                    title="Hold Ctrl/Cmd to select multiple">
                    <option value="">— All categories —</option>
                    {categories.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] opacity-40 mb-1">Only this researcher</label>
                  <select value={filterResearcher} onChange={e=>setFilterResearcher(e.target.value)}
                    className="w-full rounded border px-2 py-1.5 text-xs" style={{borderColor:"var(--border)",backgroundColor:"var(--bg-primary)"}}>
                    <option value="">— All researchers —</option>
                    {researchers.map(r=><option key={r.id} value={r.id}>{r.nombre}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 mt-3">
                <div><label className="block text-[10px] opacity-40 mb-1">From date</label><input type="date" value={filterDateFrom} onChange={e=>setFilterDateFrom(e.target.value)} className="w-full rounded border px-2 py-1.5 text-xs" style={{borderColor:"var(--border)",backgroundColor:"var(--bg-primary)"}}/></div>
                <div><label className="block text-[10px] opacity-40 mb-1">To date</label><input type="date" value={filterDateTo} onChange={e=>setFilterDateTo(e.target.value)} className="w-full rounded border px-2 py-1.5 text-xs" style={{borderColor:"var(--border)",backgroundColor:"var(--bg-primary)"}}/></div>
              </div>
            </div>
          </div>}

          {step===3 && <div className="flex flex-col h-full">
            <div className="flex-1 overflow-auto border rounded-lg p-6 bg-white text-black" style={{borderColor:"var(--border)",minHeight:400}}>
              {previewHtml ? <div dangerouslySetInnerHTML={{__html:previewHtml}}/> : <div className="flex items-center justify-center h-full opacity-30">Generating preview from live data...</div>}
            </div>
          </div>}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t px-5 py-3" style={{borderColor:"var(--border)"}}>
          <div>
            {step>1 && <button onClick={()=>setStep(step-1)} disabled={generating} className="inline-flex items-center gap-1 rounded px-3 py-1.5 text-sm opacity-50 hover:opacity-80"><ChevronLeft size={14}/>Back to edit</button>}
          </div>
          <div className="flex items-center gap-3">
            {progress && <div className="flex items-center gap-2 text-xs opacity-60"><Loader2 size={14} className="animate-spin"/>{progress}</div>}
            {step<3 ? (
              <button onClick={()=>setStep(step+1)} disabled={!contentOptions.some(o=>o.checked)} className="rounded-md px-5 py-2 text-sm font-medium text-white disabled:opacity-40" style={{backgroundColor:"#9b59b6"}}>Next →</button>
            ) : (
              <div className="flex items-center gap-2 flex-wrap">
                {downloadUrl && <>
                  <button onClick={handleSaveToProject} className="inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium" style={{borderColor:"#9b59b6",color:"#9b59b6"}}><Save size={12}/>Save to project</button>
                  <button onClick={handleOpenFile} className="inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium" style={{borderColor:"var(--border)"}}><ExternalLink size={12}/>Open file</button>
                </>}
                <button onClick={generateWord} disabled={generating} className="inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium text-white disabled:opacity-40" style={{backgroundColor:"#9b59b6"}}><Download size={14}/>Generate Word (.docx)</button>
                <button onClick={generatePDF} disabled={generating} className="inline-flex items-center gap-2 rounded-md border px-4 py-2 text-sm font-medium" style={{borderColor:"#9b59b6",color:"#9b59b6"}}><Download size={14}/>Generate PDF</button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
export default ReportGenerator;
