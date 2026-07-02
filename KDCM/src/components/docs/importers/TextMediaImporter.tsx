import { useState, useCallback } from "react";
import { Upload, X } from "lucide-react";
import { useProjectStore, type ProjectDocument } from "../../../stores/projectStore";
import { useToast } from "../../../stores/toastStore";

interface Props { open: boolean; onClose: () => void; }

const TYPE_MAP: Record<string, ProjectDocument["type"]> = {
  pdf: "pdf", docx: "docx", doc: "docx", txt: "txt", rtf: "rtf", md: "txt",
  mp3: "audio", wav: "audio", ogg: "audio", m4a: "audio",
  png: "image", jpg: "image", jpeg: "image", gif: "image", webp: "image",
  mp4: "video", webm: "video", mov: "video",
};

export function TextMediaImporter({ open, onClose }: Props) {
  const [dragOver, setDragOver] = useState(false);
  const addDocument = useProjectStore((s) => s.addDocument);
  const { toast } = useToast();

  const processFiles = useCallback((files: FileList) => {
    let count = 0;
    Array.from(files).forEach((file) => {
      const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
      const type = TYPE_MAP[ext] ?? "txt";
      addDocument({
        id: `doc-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        name: file.name, type, path: URL.createObjectURL(file),
        size: file.size, addedAt: new Date().toISOString(),
      });
      count++;
    });
    toast.success(`${count} imported`, `✅ ${count} document${count > 1 ? "s" : ""} imported successfully`);
    onClose();
  }, [addDocument, toast, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="w-full max-w-md rounded-xl p-6 shadow-xl" style={{ backgroundColor: "var(--bg-panel)", color: "var(--text-primary)" }}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-base font-semibold"><Upload size={18} style={{ color: "#000" }} />Import document</h2>
          <button onClick={onClose} className="rounded p-1 hover:bg-gray-100"><X size={16} /></button>
        </div>
        <div
          className={`flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-10 text-center transition-colors ${dragOver ? "border-peach-500 bg-peach-50" : ""}`}
          style={{ borderColor: dragOver ? "var(--peach)" : "var(--border)" }}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => { e.preventDefault(); setDragOver(false); if (e.dataTransfer.files.length) processFiles(e.dataTransfer.files); }}
        >
          <Upload size={36} opacity={0.3} />
          <p className="mt-2 text-sm" style={{ color: "var(--text-secondary)" }}>Drop files here</p>
          <p className="mt-1 text-[10px] opacity-40">.txt .pdf .docx .rtf .mp3 .wav .mp4 .mov .jpg .png .webp</p>
          <label className="mt-3 cursor-pointer rounded-md px-4 py-2 text-xs font-medium text-white hover:opacity-80 min-touch" style={{ backgroundColor: "var(--peach)" }}>
            Browse files
            <input type="file" multiple accept=".pdf,.docx,.doc,.txt,.rtf,.md,.mp3,.wav,.ogg,.m4a,.png,.jpg,.jpeg,.gif,.webp,.mp4,.webm,.mov" className="hidden" onChange={(e) => { if (e.target.files) processFiles(e.target.files); }} />
          </label>
        </div>
      </div>
    </div>
  );
}

export default TextMediaImporter;
