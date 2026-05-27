import { useState, useRef, useEffect } from "react";
import { parseMarkdown, generateHtmlExport } from "../lib/markdown";

interface ExportMenuProps {
  title: string;
  markdown: string;
}

export default function ExportMenu({ title, markdown }: ExportMenuProps) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener("mousedown", handleClick);
      return () => document.removeEventListener("mousedown", handleClick);
    }
  }, [open]);

  function copyToClipboard(text: string) {
    navigator.clipboard.writeText(text).catch(() => {
      // Fallback
      const ta = document.createElement("textarea");
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
    });
    setOpen(false);
  }

  function downloadFile(filename: string, content: string, mime: string) {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
    setOpen(false);
  }

  const safeFilename = title.replace(/[^a-zA-Z0-9-_ ]/g, "").replace(/\s+/g, "-").toLowerCase() || "document";

  return (
    <div ref={menuRef} className="relative">
      <button
        className="toolbar-btn"
        title="Export"
        onClick={() => setOpen(!open)}
        style={{ fontFamily: "system-ui", fontSize: 16 }}
      >
        {"↓"}
      </button>

      {open && (
        <div
          className="absolute right-0 top-full mt-1 py-1 rounded-lg shadow-lg border z-50 min-w-48"
          style={{
            background: "var(--dock)",
            borderColor: "var(--line)",
          }}
        >
          <button
            className="w-full text-left px-3 py-2 text-sm hover:bg-[var(--panel)] transition-colors"
            style={{ color: "var(--ink)" }}
            onClick={() => copyToClipboard(parseMarkdown(markdown))}
          >
            Copy rendered HTML
          </button>
          <button
            className="w-full text-left px-3 py-2 text-sm hover:bg-[var(--panel)] transition-colors"
            style={{ color: "var(--ink)" }}
            onClick={() => copyToClipboard(markdown)}
          >
            Copy raw markdown
          </button>
          <div className="border-t my-1" style={{ borderColor: "var(--line)" }} />
          <button
            className="w-full text-left px-3 py-2 text-sm hover:bg-[var(--panel)] transition-colors"
            style={{ color: "var(--ink)" }}
            onClick={() =>
              downloadFile(`${safeFilename}.md`, markdown, "text/markdown")
            }
          >
            Download as .md
          </button>
          <button
            className="w-full text-left px-3 py-2 text-sm hover:bg-[var(--panel)] transition-colors"
            style={{ color: "var(--ink)" }}
            onClick={() =>
              downloadFile(
                `${safeFilename}.html`,
                generateHtmlExport(title, parseMarkdown(markdown)),
                "text/html",
              )
            }
          >
            Download as .html
          </button>
        </div>
      )}
    </div>
  );
}
