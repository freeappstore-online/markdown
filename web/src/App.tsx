import { useState, useCallback, useRef, useEffect } from "react";
import type { Document, ViewMode } from "./lib/types";
import {
  loadDocuments,
  saveDocuments,
  getActiveDocId,
  setActiveDocId,
  createDocument,
  createDefaultDocument,
} from "./lib/storage";
import Toolbar from "./components/Toolbar";
import Editor, { type EditorHandle } from "./components/Editor";
import Preview, { type PreviewHandle } from "./components/Preview";
import Sidebar from "./components/Sidebar";
import StatusBar from "./components/StatusBar";
import ExportMenu from "./components/ExportMenu";

function initDocuments(): { docs: Document[]; activeId: string } {
  let docs = loadDocuments();
  let activeId = getActiveDocId();

  if (docs.length === 0) {
    const defaultDoc = createDefaultDocument();
    docs = [defaultDoc];
    activeId = defaultDoc.id;
    saveDocuments(docs);
    setActiveDocId(activeId);
  }

  if (!activeId || !docs.find((d) => d.id === activeId)) {
    activeId = docs[0]!.id;
    setActiveDocId(activeId);
  }

  return { docs, activeId };
}

export default function App() {
  const [documents, setDocuments] = useState<Document[]>(
    () => initDocuments().docs,
  );
  const [activeDocId, setActiveDocIdState] = useState<string>(
    () => initDocuments().activeId,
  );
  const [viewMode, setViewMode] = useState<ViewMode>("split");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [splitRatio, setSplitRatio] = useState(0.5);
  const [isMobile, setIsMobile] = useState(false);

  const editorRef = useRef<EditorHandle>(null);
  const previewRef = useRef<PreviewHandle>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout>>(null);
  const scrollSourceRef = useRef<"editor" | "preview" | null>(null);
  const resizingRef = useRef(false);

  const activeDoc = documents.find((d) => d.id === activeDocId);

  // Responsive: detect mobile
  useEffect(() => {
    function checkMobile() {
      setIsMobile(window.innerWidth < 768);
    }
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  // On mobile, default to editor-only view
  useEffect(() => {
    if (isMobile && viewMode === "split") {
      setViewMode("editor");
    }
  }, [isMobile, viewMode]);

  // Debounced save to localStorage
  const saveToStorage = useCallback(
    (docs: Document[]) => {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
      }
      saveTimerRef.current = setTimeout(() => {
        saveDocuments(docs);
      }, 500);
    },
    [],
  );

  const handleContentChange = useCallback(
    (content: string) => {
      setDocuments((prev) => {
        const next = prev.map((d) =>
          d.id === activeDocId
            ? { ...d, content, updatedAt: Date.now() }
            : d,
        );
        saveToStorage(next);
        return next;
      });
    },
    [activeDocId, saveToStorage],
  );

  const handleSelectDoc = useCallback((id: string) => {
    setActiveDocIdState(id);
    setActiveDocId(id);
  }, []);

  const handleNewDoc = useCallback(() => {
    const doc = createDocument();
    setDocuments((prev) => {
      const next = [...prev, doc];
      saveDocuments(next);
      return next;
    });
    setActiveDocIdState(doc.id);
    setActiveDocId(doc.id);
  }, []);

  const handleRenameDoc = useCallback((id: string, title: string) => {
    setDocuments((prev) => {
      const next = prev.map((d) =>
        d.id === id ? { ...d, title, updatedAt: Date.now() } : d,
      );
      saveDocuments(next);
      return next;
    });
  }, []);

  const handleDeleteDoc = useCallback(
    (id: string) => {
      setDocuments((prev) => {
        const next = prev.filter((d) => d.id !== id);
        if (next.length === 0) {
          const doc = createDocument("Untitled");
          next.push(doc);
        }
        saveDocuments(next);

        if (activeDocId === id) {
          const newActive = next[0]!.id;
          setActiveDocIdState(newActive);
          setActiveDocId(newActive);
        }

        return next;
      });
    },
    [activeDocId],
  );

  // Insert markdown syntax at cursor
  const handleInsert = useCallback(
    (before: string, after: string, placeholder: string) => {
      const ta = editorRef.current?.getTextarea();
      if (!ta || !activeDoc) return;

      const start = ta.selectionStart;
      const end = ta.selectionEnd;
      const selected = ta.value.substring(start, end);
      const text = selected || placeholder;
      const newValue =
        ta.value.substring(0, start) + before + text + after + ta.value.substring(end);

      handleContentChange(newValue);

      // Restore selection
      requestAnimationFrame(() => {
        const cursorStart = start + before.length;
        const cursorEnd = cursorStart + text.length;
        ta.focus();
        ta.setSelectionRange(cursorStart, cursorEnd);
      });
    },
    [activeDoc, handleContentChange],
  );

  // Scroll sync
  const handleEditorScroll = useCallback(
    (fraction: number) => {
      if (scrollSourceRef.current === "preview") return;
      scrollSourceRef.current = "editor";
      previewRef.current?.scrollToFraction(fraction);
      requestAnimationFrame(() => {
        scrollSourceRef.current = null;
      });
    },
    [],
  );

  const handlePreviewScroll = useCallback(
    (fraction: number) => {
      if (scrollSourceRef.current === "editor") return;
      scrollSourceRef.current = "preview";
      editorRef.current?.scrollToFraction(fraction);
      requestAnimationFrame(() => {
        scrollSourceRef.current = null;
      });
    },
    [],
  );

  // Click in preview to jump to approximate line in editor
  const handleClickLine = useCallback(
    (lineNumber: number) => {
      const ta = editorRef.current?.getTextarea();
      if (!ta || !activeDoc) return;
      const lines = activeDoc.content.split("\n");
      let charPos = 0;
      for (let i = 0; i < Math.min(lineNumber, lines.length); i++) {
        charPos += (lines[i]?.length ?? 0) + 1;
      }
      ta.focus();
      ta.setSelectionRange(charPos, charPos);
      // Scroll to that position
      const lineHeight = 22.4; // 14px * 1.6 line-height
      ta.scrollTop = lineNumber * lineHeight - ta.clientHeight / 2;
    },
    [activeDoc],
  );

  // Resize handle
  const handleResizeStart = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      resizingRef.current = true;

      const startX = e.clientX;
      const startRatio = splitRatio;
      const container = (e.target as HTMLElement).parentElement;
      if (!container) return;
      const containerWidth = container.offsetWidth;

      function onMove(ev: MouseEvent) {
        if (!resizingRef.current) return;
        const dx = ev.clientX - startX;
        const newRatio = Math.max(0.2, Math.min(0.8, startRatio + dx / containerWidth));
        setSplitRatio(newRatio);
      }

      function onUp() {
        resizingRef.current = false;
        document.removeEventListener("mousemove", onMove);
        document.removeEventListener("mouseup", onUp);
      }

      document.addEventListener("mousemove", onMove);
      document.addEventListener("mouseup", onUp);
    },
    [splitRatio],
  );

  const showEditor = viewMode === "editor" || viewMode === "split";
  const showPreview = viewMode === "preview" || viewMode === "split";
  const isSplit = viewMode === "split" && !isMobile;

  return (
    <div className="h-screen flex flex-col" style={{ background: "var(--paper)" }}>
      {/* Toolbar */}
      <div className="flex items-center border-b" style={{ background: "var(--dock)", borderColor: "var(--line)" }}>
        <div className="flex-1 min-w-0">
          <Toolbar
            viewMode={isMobile && viewMode === "split" ? "editor" : viewMode}
            onViewModeChange={setViewMode}
            onInsert={handleInsert}
            onSidebarToggle={() => setSidebarOpen((p) => !p)}
            sidebarOpen={sidebarOpen}
          />
        </div>
        <div className="pr-2 flex-shrink-0">
          <ExportMenu
            title={activeDoc?.title ?? "document"}
            markdown={activeDoc?.content ?? ""}
          />
        </div>
      </div>

      {/* Main area */}
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        {sidebarOpen && !isMobile && (
          <div className="sidebar-open flex-shrink-0">
            <Sidebar
              documents={documents}
              activeId={activeDocId}
              onSelect={handleSelectDoc}
              onNew={handleNewDoc}
              onRename={handleRenameDoc}
              onDelete={handleDeleteDoc}
            />
          </div>
        )}

        {/* Editor + Preview area */}
        <div className="flex flex-1 overflow-hidden relative">
          {showEditor && (
            <div
              className="h-full overflow-hidden"
              style={{
                width: isSplit ? `${splitRatio * 100}%` : "100%",
                flexShrink: 0,
              }}
            >
              <Editor
                ref={editorRef}
                value={activeDoc?.content ?? ""}
                onChange={handleContentChange}
                onScroll={isSplit ? handleEditorScroll : undefined}
              />
            </div>
          )}

          {isSplit && (
            <div
              className="resize-handle"
              onMouseDown={handleResizeStart}
            />
          )}

          {showPreview && (
            <div
              className="h-full overflow-hidden"
              style={{
                width: isSplit ? `${(1 - splitRatio) * 100}%` : "100%",
                flexShrink: 0,
              }}
            >
              <Preview
                ref={previewRef}
                markdown={activeDoc?.content ?? ""}
                onScroll={isSplit ? handlePreviewScroll : undefined}
                onClickLine={handleClickLine}
              />
            </div>
          )}
        </div>

      </div>

      {/* Status bar */}
      <StatusBar content={activeDoc?.content ?? ""} />

      {/* Mobile sidebar overlay */}
      {sidebarOpen && isMobile && (
        <>
          <div
            className="fixed inset-0 z-40"
            style={{ background: "rgba(0,0,0,0.4)" }}
            onClick={() => setSidebarOpen(false)}
          />
          <div
            className="fixed left-0 top-0 bottom-0 z-50 w-72"
            style={{ background: "var(--panel)" }}
          >
            <Sidebar
              documents={documents}
              activeId={activeDocId}
              onSelect={(id) => {
                handleSelectDoc(id);
                setSidebarOpen(false);
              }}
              onNew={() => {
                handleNewDoc();
                setSidebarOpen(false);
              }}
              onRename={handleRenameDoc}
              onDelete={handleDeleteDoc}
            />
          </div>
        </>
      )}
    </div>
  );
}
