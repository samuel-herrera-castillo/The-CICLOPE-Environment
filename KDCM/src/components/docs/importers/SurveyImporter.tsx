import { useState } from "react";
import { Upload, ArrowRight, ArrowLeft, Download, AlertTriangle, FileSpreadsheet, X } from "lucide-react";
import { useProjectStore } from "../../../stores/projectStore";
import { useToast } from "../../../stores/toastStore";
import * as XLSX from "xlsx";

type SurveyType = "—" | "id" | "text" | "numeric" | "categorical" | "date";
type MissingValue = "null" | "empty" | "na";
interface Props { open: boolean; onClose: () => void; }

function detectType(values: any[]): SurveyType {
  const sample = values.filter((v) => v !== null && v !== undefined && v !== "").slice(0, 20);
  if (sample.length === 0) return "—";
  const allNums = sample.every((v) => !isNaN(Number(v)));
  const allDates = sample.every((v) => !isNaN(Date.parse(String(v))) && /[\d]{4}-[\d]{2}/.test(String(v)));
  if (allNums && sample.length >= 3) {
    const nums = sample.map(Number);
    const unique = new Set(nums);
    if (unique.size <= Math.min(10, sample.length / 2)) return "categorical";
    return "numeric";
  }
  if (allDates) return "date";
  const avgLen = sample.reduce((s, v) => s + String(v).length, 0) / sample.length;
  if (avgLen > 30) return "text";
  if (new Set(sample).size <= 5) return "categorical";
  return "text";
}

export function SurveyImporter({ open, onClose }: Props) {
  const [step, setStep] = useState(1);
  const [file, setFile] = useState<File | null>(null);
  const [columns, setColumns] = useState<{ name: string; preview: string; type: SurveyType }[]>([]);
  const [hasId, setHasId] = useState(false);
  const [useCodeDict, setUseCodeDict] = useState(false);
  const [missingAs, setMissingAs] = useState<MissingValue>("null");
  const [groupName, setGroupName] = useState("");
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [importing, setImporting] = useState(false);
  const addDocument = useProjectStore((s) => s.addDocument);
  const { toast } = useToast();

  if (!open) return null;

  const handleFile = async (f: File) => {
    if (!/\.(xlsx|csv|sav)$/i.test(f.name)) return;
    setFile(f);
    try {
      const data = await f.arrayBuffer();
      const workbook = XLSX.read(data, { type: "array" });
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
      const json = XLSX.utils.sheet_to_json<any[]>(sheet, { header: 1, defval: "" });
      if (json.length < 2) { toast.info("Empty file", "The file contains no data rows"); return; }
      const headerRow = json[0] as string[];
      const rows = json.slice(1, 20);
      const cols = headerRow.map((h, i) => {
        const values = rows.map((r) => r[i]);
        const preview = values.filter((v) => v !== "" && v !== null && v !== undefined).slice(0, 3).join(", ") || "...";
        const type = detectType(values);
        return { name: String(h || `Column_${i + 1}`), preview: preview.slice(0, 40), type };
      });
      setColumns(cols);
      setHasId(cols.some((c) => c.type === "id"));
      if (!cols.some((c) => c.type === "id")) {
        // Auto-assign first column as ID if it looks like one
        const firstCol = cols[0];
        if (firstCol && new Set(rows.map((r) => r[0])).size >= rows.length * 0.8) {
          setColumns((prev) => [{ ...prev[0], type: "id" }, ...prev.slice(1)]);
          setHasId(true);
        }
      }
    } catch (e) {
      toast.error("Parse error", "Could not read the file. Check the format.");
    }
  };

  const updateColType = (idx: number, type: SurveyType) => {
    setColumns((prev) => {
      const next = prev.map((c, i) => (i === idx ? { ...c, type } : c));
      setHasId(next.some((c) => c.type === "id"));
      return next;
    });
  };

  const handleImport = async () => {
    if (!file) return;
    setImporting(true);
    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data, { type: "array" });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const json = XLSX.utils.sheet_to_json<any[]>(sheet, { header: 1, defval: "" });
      const allRows = json.slice(1);
      const total = allRows.length;
      const idColIdx = columns.findIndex((c) => c.type === "id");
      const textCols = columns.map((c, i) => ({ ...c, idx: i })).filter((c) => c.type === "text");

      // Create a document for the survey
      const surveyDocId = `survey-${Date.now()}`;
      addDocument({
        id: surveyDocId, name: groupName || `Survey ${new Date().toLocaleDateString()}`,
        type: "txt", path: file.name, size: file.size, addedAt: new Date().toISOString(),
        metadata_json: JSON.stringify({ tipo: "survey", columns: columns.map((c) => ({ name: c.name, type: c.type })), totalRows: total }),
      });

      // Create individual documents for text responses
      for (let i = 0; i < total; i++) {
        setProgress({ current: i + 1, total });
        const row = allRows[i];
        const respondentId = idColIdx >= 0 ? String(row[idColIdx] || `R${i + 1}`) : `R${i + 1}`;
        textCols.forEach((col) => {
          const textValue = String(row[col.idx] || "").trim();
          if (textValue) {
            addDocument({
              id: `survey-resp-${Date.now()}-${i}-${col.idx}`,
              name: `${respondentId} — ${col.name}`,
              type: "txt", path: file.name, size: textValue.length,
              addedAt: new Date().toISOString(),
              metadata_json: JSON.stringify({ tipo: "survey_response", surveyId: surveyDocId, respondentId, column: col.name }),
            });
          }
        });
        if (i % 5 === 0) await new Promise((r) => setTimeout(r, 0)); // Yield to UI
      }
      setImporting(false);
      toast.success("Survey imported", `${textCols.length} text columns · ${total} respondents processed`);
      onClose();
    } catch { toast.error("Error", "Could not import survey data"); setImporting(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="w-full max-w-lg rounded-xl p-6 shadow-xl" style={{ backgroundColor: "var(--bg-panel)", color: "var(--text-primary)" }}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-base font-semibold"><FileSpreadsheet size={18} style={{ color: "#000" }} />Survey importer</h2>
          <button onClick={onClose} className="rounded p-1 hover:bg-gray-100"><X size={16} /></button>
        </div>
        <div className="mb-4 flex items-center justify-center gap-2">
          {[1, 2, 3].map((s) => (
            <div key={s} className={`h-2 w-2 rounded-full transition-all ${s <= step ? "" : "opacity-30"}`}
              style={{ backgroundColor: s <= step ? "var(--peach)" : "#BDBDBD", transform: s === step ? "scale(1.5)" : "scale(1)" }} />
          ))}
          <span className="ml-2 text-[10px] opacity-40">Step {step}/3</span>
        </div>

        {step === 1 && (
          <div>
            <div className="mb-4 flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-8 text-center transition-colors"
              style={{ borderColor: file ? "var(--peach)" : "var(--border)" }}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }}>
              <Upload size={32} opacity={0.3} />
              <p className="mt-2 text-sm" style={{ color: "var(--text-secondary)" }}>Drop .xlsx, .csv, or .sav file</p>
              <label className="mt-2 cursor-pointer text-xs font-medium underline" style={{ color: "#000" }}>
                or browse
                <input type="file" accept=".xlsx,.csv,.sav" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
              </label>
            </div>
            {file && <p className="text-xs text-center mb-2" style={{ color: "#000" }}>✓ {file.name}</p>}
          </div>
        )}

        {step === 2 && (
          <div>
            {!hasId && (
              <div className="mb-3 flex items-center gap-2 rounded-md border border-red-300 bg-red-50 p-2 text-xs font-medium" style={{ color: "#C62828" }}>
                <AlertTriangle size={14} /> No identifier column selected
              </div>
            )}
            <div className="mb-3 max-h-[240px] overflow-y-auto rounded-md border" style={{ borderColor: "var(--border)" }}>
              <table className="w-full text-xs">
                <thead><tr className="border-b text-left opacity-50" style={{ borderColor: "var(--border)" }}>
                  <th className="px-2 py-1.5 font-medium">Column</th><th className="px-2 py-1.5 font-medium">Preview</th><th className="px-2 py-1.5 font-medium">KDCM type</th>
                </tr></thead>
                <tbody>
                  {columns.map((col, i) => (
                    <tr key={i} className="border-b" style={{ borderColor: "var(--border)" }}>
                      <td className="px-2 py-1.5 font-medium">{col.name}</td>
                      <td className="px-2 py-1.5 opacity-50">{col.preview}</td>
                      <td className="px-2 py-1.5">
                        <select value={col.type} onChange={(e) => updateColType(i, e.target.value as SurveyType)}
                          className="rounded border bg-transparent px-1.5 py-0.5 text-[11px]"
                          style={{ borderColor: "var(--border)", color: "var(--text-primary)" }}>
                          {(["—","id","text","numeric","categorical","date"] as SurveyType[]).map((t) => (
                            <option key={t} value={t}>{t === "—" ? "Ignore" : t === "id" ? "🆔 ID" : t === "text" ? "📝 Text" : t === "numeric" ? "📊 Numeric" : t === "categorical" ? "🏷 Categorical" : "📅 Date"}</option>
                          ))}
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="space-y-1.5 text-xs">
              <label className="flex items-center gap-2 cursor-pointer" style={{ color: "var(--text-secondary)" }}>
                <input type="checkbox" checked={useCodeDict} onChange={(e) => setUseCodeDict(e.target.checked)} style={{ accentColor: "var(--peach)" }} />
                Code dictionary (decode numeric values)
              </label>
              <div className="flex items-center gap-2">
                <span style={{ color: "var(--text-secondary)" }}>Missing values:</span>
                <select value={missingAs} onChange={(e) => setMissingAs(e.target.value as MissingValue)}
                  className="rounded border bg-transparent px-1.5 py-0.5 text-[11px]"
                  style={{ borderColor: "var(--border)", color: "var(--text-primary)" }}>
                  <option value="null">null</option><option value="empty">empty string</option><option value="na">N/A</option>
                </select>
              </div>
            </div>
          </div>
        )}

        {step === 3 && (
          <div>
            <div className="mb-4 rounded-md p-3" style={{ backgroundColor: "var(--bg-secondary)" }}>
              <p className="text-sm font-semibold">Import summary</p>
              <div className="mt-2 space-y-1 text-xs opacity-60">
                <p>File: {file?.name}</p>
                <p>Columns: {columns.length} ({columns.filter((c) => c.type !== "—").length} imported)</p>
              </div>
            </div>
            <label className="mb-4 block text-xs" style={{ color: "var(--text-secondary)" }}>
              Group name
              <input value={groupName} onChange={(e) => setGroupName(e.target.value)} placeholder={`Survey ${new Date().toLocaleDateString()}`}
                className="mt-1 w-full rounded-md border px-3 py-2 text-sm outline-none"
                style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-primary)", color: "var(--text-primary)" }} />
            </label>
            {importing && (
              <div className="mb-4">
                <div className="h-1.5 w-full rounded-full" style={{ backgroundColor: "var(--border)" }}>
                  <div className="h-full rounded-full transition-all" style={{ width: `${progress.total > 0 ? (progress.current / progress.total) * 100 : 0}%`, backgroundColor: "var(--peach)" }} />
                </div>
                <p className="mt-1 text-center text-[10px] opacity-40">Processing row {progress.current} of {progress.total}...</p>
              </div>
            )}
          </div>
        )}

        <div className="mt-6 flex items-center justify-between">
          {step > 1 ? (
            <button onClick={() => setStep((s) => s - 1)} className="flex items-center gap-1 rounded-md border px-3 py-1.5 text-xs min-touch"
              style={{ borderColor: "var(--border)", color: "var(--text-primary)" }}><ArrowLeft size={12} /> Back</button>
          ) : <div />}
          {step < 3 ? (
            <button onClick={() => setStep((s) => s + 1)} disabled={!file}
              className="flex items-center gap-1 rounded-md px-4 py-2 text-xs font-medium text-white hover:opacity-80 disabled:opacity-40 min-touch"
              style={{ backgroundColor: "var(--peach)" }}>Next <ArrowRight size={12} /></button>
          ) : (
            <button onClick={handleImport} disabled={importing}
              className="flex items-center gap-1 rounded-md px-4 py-2 text-xs font-medium text-white hover:opacity-80 min-touch"
              style={{ backgroundColor: "var(--peach)" }}><Download size={12} /> Import</button>
          )}
        </div>
      </div>
    </div>
  );
}

export default SurveyImporter;
