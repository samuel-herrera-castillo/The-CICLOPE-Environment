import { useCallback, useRef, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { FileText, Code, StickyNote, Hash, X, Trash2, Plus } from "lucide-react";
import { useLayoutStore, type PestañaIzq } from "../stores/layoutStore";
import { useProjectStore, type ProjectDocument } from "../stores/projectStore";
import { useToast } from "../stores/toastStore";
import { EmptyState } from "../components/ui/EmptyState";
import { CodeTreePanel } from "../components/codes/CodeTreePanel";
import { Inspector } from "../components/codes/Inspector";
import { DocumentTree } from "../components/docs/DocumentTree";
import { DocumentViewer } from "../components/docs/DocumentViewer";
import { AudioPlayer } from "../components/docs/AudioPlayer";
import { ImageViewer } from "../components/docs/ImageViewer";
import { VideoPlayer } from "../components/docs/VideoPlayer";
import { SegmentInspector } from "../components/codes/SegmentInspector";
import { useUIStore } from "../stores/uiStore";
import { ImportHub } from "../components/docs/importers/ImportHub";

const SUB_TABS: { id: PestañaIzq; label: string; icon: React.ComponentType<{ size?: number }> }[] = [
  { id: "docs",      label: "docs_tab",      icon: FileText },
  { id: "codigos",   label: "codes_tab",     icon: Code },
  { id: "memos",     label: "memos_tab",     icon: StickyNote },
  { id: "variables", label: "variables_tab",  icon: Hash },
];

export function DocumentsTabLeft() {
  const { t } = useTranslation(["docs", "nav"]);
  const active = useLayoutStore((s) => s.pestañaActivaIzq);
  const setActive = useLayoutStore((s) => s.setPestañaActivaIzq);
  const setSelectedDocId = useLayoutStore((s) => s.setSelectedDocId);
  const setHighlightTarget = useLayoutStore((s) => s.setHighlightTarget);
  const memos = useProjectStore((s) => s.memos);
  const removeMemo = useProjectStore((s) => s.removeMemo);
  const addDocument = useProjectStore((s) => s.addDocument);
  const [importHubOpen, setImportHubOpen] = useState(false);
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImportFiles = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const typeMap: Record<string, ProjectDocument["type"]> = {
      pdf: "pdf", docx: "docx", doc: "docx", txt: "txt", rtf: "rtf", md: "txt",
      mp3: "audio", wav: "audio", ogg: "audio", m4a: "audio",
      png: "image", jpg: "image", jpeg: "image", gif: "image", webp: "image",
      mp4: "video", webm: "video", mov: "video",
    };
    Array.from(files).forEach((file) => {
      const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
      addDocument({
        id: `doc-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        name: file.name, type: typeMap[ext] ?? "txt",
        path: URL.createObjectURL(file), size: file.size,
        addedAt: new Date().toISOString(),
      });
    });
    toast.success(t("common:success"), `${files.length} ${t("common:import").toLowerCase()}`);
    e.target.value = "";
  }, [addDocument, toast]);

  return (
    <div className="flex h-full flex-col" style={{ backgroundColor: "var(--bg-panel)" }}>
      {/* Hidden file input shared across sub-tabs */}
      <input ref={fileInputRef} type="file" multiple
        accept=".pdf,.docx,.doc,.txt,.rtf,.md,.mp3,.wav,.ogg,.m4a,.png,.jpg,.jpeg,.gif,.webp,.mp4,.webm,.mov"
        onChange={handleImportFiles} className="hidden" />

      {/* Tabs + Import button */}
      <div className="grid grid-cols-[1fr_auto_1fr] items-center border-b px-1 py-0.5" style={{ borderColor: "var(--border)" }}>
        <div />
        <div className="flex items-center" role="tablist">
          {SUB_TABS.map((st, i) => {
            const isActive = active === st.id;
            const Icon = st.icon;
            return (
              <div key={st.id} className="flex items-center">
                {i > 0 && <div className="mx-0.5 h-3 w-px" style={{ backgroundColor: "var(--border)" }} />}
                <button role="tab" aria-selected={isActive} onClick={() => setActive(st.id)}
                  className={`flex items-center gap-1 px-2 py-1.5 text-[11px] font-medium transition-all ${isActive ? "" : "opacity-50 hover:opacity-80"}`}
                  style={{ color: "#000", borderBottom: isActive ? "2px solid var(--peach)" : "2px solid transparent" }}>
                  <Icon size={12} /> {t(st.label)}
                </button>
              </div>
            );
          })}
        </div>
        <div className="flex justify-end">
          <button onClick={() => setImportHubOpen(true)}
            className="flex items-center gap-1 rounded-md px-2 py-1 text-[10px] font-medium text-white hover:opacity-80"
            style={{ backgroundColor: "var(--peach)" }}>
            <Plus size={12} /> {t("import_btn")}
          </button>
        </div>
      </div>

      {/* Import hub modal */}
      <ImportHub open={importHubOpen} onClose={() => setImportHubOpen(false)} />
      <div className="flex-1 overflow-hidden">
        {active === "docs" && <DocumentTree />}
        {active === "codigos" && <CodeTreePanel />}
        {active === "memos" && (
          memos.length === 0 ? (
            <div className="flex h-full items-center justify-center"><EmptyState variant="no-selection" title={t("docs:memos_tab")} subtitle={t("empty:no_memos.subtitle")} /></div>
          ) : (
            <div className="flex-1 overflow-y-auto py-1">
              {memos.map((memo) => (
                <div key={memo.id}
                  onClick={() => {
                    const linkedDocId = memo.linkedDocIds[0];
                    if (linkedDocId) {
                      setSelectedDocId(linkedDocId);
                      setActive("docs");
                      const highlightData = memo.linkedCodeIds[0];
                      if (highlightData) setHighlightTarget(highlightData);
                      else setHighlightTarget(null);
                      toast.info(`"${memo.title}"`, t("docs:search_docs"));
                    }
                  }}
                  className="group border-b px-3 py-2 text-xs cursor-pointer hover:bg-peach-50 transition-colors" style={{ borderColor: "var(--border)" }}>
                  <div className="flex items-center justify-between">
                    <p className="font-medium truncate flex-1" style={{ color: "var(--text-primary)" }}>{memo.title}</p>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        removeMemo(memo.id);
                        toast.success("Memo", `"${memo.title}" ${t("common:remove").toLowerCase()}`);
                      }}
                      className="flex-shrink-0 rounded p-0.5 opacity-0 group-hover:opacity-60 hover:opacity-100 hover:bg-red-50 text-red-500 transition-all"
                      aria-label="Delete memo"
                      title="Delete memo"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                  <p className="mt-0.5 truncate opacity-50">{memo.content}</p>
                  <div className="mt-1 flex items-center gap-2 text-[10px] opacity-30">
                    <span>{new Date(memo.createdAt).toLocaleString()}</span>
                    {memo.linkedDocIds.length > 0 && (
                      <span className="rounded-full bg-peach-100 px-1.5 py-0 text-peach-700">↗ {t("links_tab")}</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )
        )}
        {active === "variables" && <div className="flex h-full items-center justify-center"><EmptyState variant="no-selection" title={t("variables.title")} subtitle={t("variables.no_variables")} /></div>}
      </div>
    </div>
  );
}

export function DocumentsTabCenter() {
  const { t } = useTranslation(["docs", "common"]);
  const documents = useProjectStore((s) => s.documents);
  const addDocument = useProjectStore((s) => s.addDocument);
  const selectedDocId = useLayoutStore((s) => s.selectedDocId);
  const setSelectedDocId = useLayoutStore((s) => s.setSelectedDocId);
  const openDocIds = useLayoutStore((s) => s.openDocIds);
  const openDoc = useLayoutStore((s) => s.openDoc);
  const closeDoc = useLayoutStore((s) => s.closeDoc);
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Auto-open any selected doc as a tab ──
  useEffect(() => {
    if (selectedDocId && !openDocIds.includes(selectedDocId)) {
      openDoc(selectedDocId);
    }
  }, [selectedDocId, openDocIds, openDoc]);

  const handleCloseDoc = useCallback((docId: string) => {
    // Remove from open tabs — do NOT delete the document
    closeDoc(docId);
    if (selectedDocId === docId) {
      const remaining = openDocIds.filter((id) => id !== docId);
      const idx = openDocIds.indexOf(docId);
      const next = remaining[Math.min(idx, remaining.length - 1)] ?? null;
      setSelectedDocId(next);
    }
  }, [openDocIds, selectedDocId, closeDoc, setSelectedDocId]);

  // Auto-select first doc when docs are imported
  useEffect(() => {
    if (documents.length > 0 && !selectedDocId) {
      setSelectedDocId(documents[0].id);
    }
  }, [documents, selectedDocId, setSelectedDocId]);

  const activeDoc = documents.find((d) => d.id === selectedDocId) ?? null;

  const handleImportClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleFilesSelected = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const typeMap: Record<string, ProjectDocument["type"]> = {
      pdf: "pdf", docx: "docx", doc: "docx", txt: "txt", rtf: "rtf", md: "txt",
      mp3: "audio", wav: "audio", ogg: "audio", m4a: "audio",
      png: "image", jpg: "image", jpeg: "image", gif: "image", webp: "image",
      mp4: "video", webm: "video", mov: "video",
    };
    let firstId: string | null = null;
    Array.from(files).forEach((file) => {
      const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
      const id = `doc-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      if (!firstId) firstId = id;
      else void Date.now(); // ensure unique IDs
      addDocument({
        id, name: file.name, type: typeMap[ext] ?? "txt",
        path: URL.createObjectURL(file), size: file.size,
        addedAt: new Date().toISOString(),
      });
    });
    if (firstId) setSelectedDocId(firstId);
    toast.success(t("common:success"), `${files.length} ${t("common:import").toLowerCase()}`);
    e.target.value = "";
  }, [addDocument, toast, setSelectedDocId]);

  // Only show tabs for documents that have been opened
  const docTabs = documents.filter((d) => openDocIds.includes(d.id));

  if (documents.length === 0) {
    return (
      <>
        <input ref={fileInputRef} type="file" multiple
          accept=".pdf,.docx,.doc,.txt,.rtf,.md,.mp3,.wav,.ogg,.m4a,.png,.jpg,.jpeg,.gif,.webp,.mp4,.webm,.mov"
          onChange={handleFilesSelected} className="hidden" />
        <EmptyState variant="no-documents"
          action={<button onClick={handleImportClick} className="rounded-md bg-peach-500 px-4 py-2 text-sm font-medium text-white hover:bg-peach-700 min-touch">{t("import_document")}</button>} />
      </>
    );
  }

  if (!activeDoc) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-sm opacity-20">{t("empty:no_selection.title")}</p>
      </div>
    );
  }

  // Document tabs bar
  const DocTabs = docTabs.length > 0 ? (
    <div className="flex items-center border-b gap-0.5 px-2 py-1 overflow-x-auto" style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-panel)" }}>
      {docTabs.map((doc) => {
        const isActive = doc.id === selectedDocId;
        const typeIcons: Record<string, string> = { pdf: "📕", docx: "📝", txt: "📄", audio: "🎙", image: "📷", video: "🎬" };
        return (
          <div key={doc.id}
            onClick={() => setSelectedDocId(doc.id)}
            className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[11px] font-medium whitespace-nowrap transition-colors cursor-pointer min-touch ${isActive ? "bg-peach-100" : "hover:bg-gray-100"}`}
            style={{ color: "#000" }}
            role="tab"
            aria-selected={isActive}
          >
            <span>{typeIcons[doc.type] ?? "📄"}</span>
            <span className="max-w-[140px] truncate">{doc.name}</span>
            <button onClick={(e) => {
              e.stopPropagation();
              handleCloseDoc(doc.id);
            }} className="ml-1 rounded p-0.5 hover:bg-gray-200 opacity-30 hover:opacity-100" aria-label="Close document">
              <X size={11} />
            </button>
          </div>
        );
      })}
    </div>
  ) : null;

  // Render viewer based on document type
  return (
    <div className="flex h-full flex-col">
      {DocTabs}
      <div className="flex-1 overflow-hidden">
        {activeDoc.type === "audio" && <AudioPlayer document={activeDoc} playlist={documents.filter((d) => d.type === "audio")} onSelectTrack={(doc) => setSelectedDocId(doc.id)} />}
        {activeDoc.type === "image" && <ImageViewer src={activeDoc.path} alt={activeDoc.name} documentId={activeDoc.id} />}
        {activeDoc.type === "video" && <VideoPlayer src={activeDoc.path} title={activeDoc.name} documentId={activeDoc.id} />}
        {(activeDoc.type === "txt" || activeDoc.type === "rtf" || activeDoc.type === "pdf" || activeDoc.type === "docx") && (
          <DocumentViewer document={activeDoc} onClose={() => setSelectedDocId(null)} />
        )}
      </div>
    </div>
  );
}

export function DocumentsTabRight() {
  const categories = useProjectStore((s) => s.categories);
  const inspectedSegment = useUIStore((s) => s.inspectedSegment);
  const clearInspected = useUIStore((s) => s.setInspectedSegment);

  // Show SegmentInspector when a coded segment is clicked in the margin
  if (inspectedSegment) {
    return (
      <SegmentInspector
        open={true}
        segment={{
          id: inspectedSegment.id,
          text: inspectedSegment.text,
          docName: inspectedSegment.docName,
          page: 1,
          paragraph: 1,
          authorName: inspectedSegment.authorName,
          authorColor: inspectedSegment.authorColor,
          date: new Date().toISOString(),
          startPos: 0,
          endPos: inspectedSegment.text.length,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }}
        onClose={() => clearInspected(null)}
        onGoToDoc={() => {}}
      />
    );
  }

  const selectedCategory = categories[0] ?? null;
  if (!selectedCategory) return <EmptyState variant="no-selection" />;
  return <Inspector category={selectedCategory} onUpdate={() => {}} onDelete={() => {}} />;
}
