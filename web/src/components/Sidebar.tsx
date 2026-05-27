import { useState, useRef, useEffect } from "react";
import type { Document } from "../lib/types";

interface SidebarProps {
  documents: Document[];
  activeId: string;
  onSelect: (id: string) => void;
  onNew: () => void;
  onRename: (id: string, title: string) => void;
  onDelete: (id: string) => void;
}

export default function Sidebar({
  documents,
  activeId,
  onSelect,
  onNew,
  onRename,
  onDelete,
}: SidebarProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editingId && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editingId]);

  function startRename(doc: Document) {
    setEditingId(doc.id);
    setEditValue(doc.title);
  }

  function commitRename() {
    if (editingId && editValue.trim()) {
      onRename(editingId, editValue.trim());
    }
    setEditingId(null);
  }

  function formatDate(timestamp: number): string {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    if (diffDays === 0) return "Today";
    if (diffDays === 1) return "Yesterday";
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  }

  const sorted = [...documents].sort((a, b) => b.updatedAt - a.updatedAt);

  return (
    <div
      className="h-full flex flex-col overflow-hidden"
      style={{ background: "var(--panel)", borderRight: "1px solid var(--line)" }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-3 py-3 border-b flex-shrink-0"
        style={{ borderColor: "var(--line)" }}
      >
        <span className="font-semibold text-sm" style={{ color: "var(--ink)" }}>
          Documents
        </span>
        <button
          className="toolbar-btn"
          title="New document"
          onClick={onNew}
          style={{ fontSize: 18 }}
        >
          +
        </button>
      </div>

      {/* Document list */}
      <div className="flex-1 overflow-y-auto p-2">
        {sorted.map((doc) => (
          <div
            key={doc.id}
            className="doc-item mb-1"
            data-active={doc.id === activeId}
            onClick={() => {
              if (editingId !== doc.id) onSelect(doc.id);
            }}
            onDoubleClick={() => startRename(doc)}
          >
            <div className="flex-1 min-w-0">
              {editingId === doc.id ? (
                <input
                  ref={inputRef}
                  className="w-full px-1 py-0 text-sm border rounded"
                  style={{
                    background: "var(--paper)",
                    borderColor: "var(--accent)",
                    color: "var(--ink)",
                    outline: "none",
                  }}
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  onBlur={commitRename}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") commitRename();
                    if (e.key === "Escape") setEditingId(null);
                  }}
                />
              ) : (
                <>
                  <div className="text-sm font-medium truncate">{doc.title}</div>
                  <div
                    className="doc-item-date text-xs truncate"
                    style={{ color: doc.id === activeId ? undefined : "var(--muted)" }}
                  >
                    {formatDate(doc.updatedAt)}
                  </div>
                </>
              )}
            </div>
            {documents.length > 1 && editingId !== doc.id && (
              <button
                className="toolbar-btn flex-shrink-0 opacity-0 group-hover:opacity-100"
                style={{
                  width: 24,
                  height: 24,
                  fontSize: 12,
                  opacity: doc.id === activeId ? 0.7 : 0,
                }}
                title="Delete document"
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(doc.id);
                }}
                onMouseOver={(e) => {
                  (e.currentTarget as HTMLElement).style.opacity = "1";
                }}
                onMouseOut={(e) => {
                  (e.currentTarget as HTMLElement).style.opacity =
                    doc.id === activeId ? "0.7" : "0";
                }}
              >
                ×
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
