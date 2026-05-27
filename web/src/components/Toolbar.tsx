import type { ViewMode } from "../lib/types";

interface ToolbarProps {
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
  onInsert: (before: string, after: string, placeholder: string) => void;
  onSidebarToggle: () => void;
  sidebarOpen: boolean;
}

interface ToolbarAction {
  label: string;
  title: string;
  before: string;
  after: string;
  placeholder: string;
}

const actions: ToolbarAction[] = [
  { label: "B", title: "Bold", before: "**", after: "**", placeholder: "bold text" },
  { label: "I", title: "Italic", before: "*", after: "*", placeholder: "italic text" },
  { label: "H1", title: "Heading 1", before: "# ", after: "", placeholder: "Heading" },
  { label: "H2", title: "Heading 2", before: "## ", after: "", placeholder: "Heading" },
  { label: "H3", title: "Heading 3", before: "### ", after: "", placeholder: "Heading" },
  { label: "\u{1f517}", title: "Link", before: "[", after: "](url)", placeholder: "link text" },
  { label: "\u{1f5bc}", title: "Image", before: "![", after: "](url)", placeholder: "alt text" },
  { label: "<>", title: "Inline code", before: "`", after: "`", placeholder: "code" },
  { label: "```", title: "Code block", before: "```\n", after: "\n```", placeholder: "code here" },
  { label: "•", title: "Bullet list", before: "- ", after: "", placeholder: "list item" },
  { label: "1.", title: "Numbered list", before: "1. ", after: "", placeholder: "list item" },
  { label: ">", title: "Quote", before: "> ", after: "", placeholder: "quote" },
  { label: "—", title: "Horizontal rule", before: "\n---\n", after: "", placeholder: "" },
  { label: "☷", title: "Table", before: "| Header | Header |\n|--------|--------|\n| ", after: " | Cell |", placeholder: "Cell" },
];

export default function Toolbar({
  viewMode,
  onViewModeChange,
  onInsert,
  onSidebarToggle,
  sidebarOpen,
}: ToolbarProps) {
  return (
    <div
      className="flex items-center gap-1 px-3 py-1.5 overflow-x-auto"
      style={{ background: "var(--dock)" }}
    >
      {/* Sidebar toggle */}
      <button
        className="toolbar-btn mr-1"
        title={sidebarOpen ? "Hide documents" : "Show documents"}
        onClick={onSidebarToggle}
        style={{ fontFamily: "system-ui" }}
      >
        {sidebarOpen ? "«" : "☰"}
      </button>

      <div
        className="w-px h-5 mx-1 flex-shrink-0"
        style={{ background: "var(--line)" }}
      />

      {/* Formatting actions */}
      {actions.map((action) => (
        <button
          key={action.title}
          className="toolbar-btn"
          title={action.title}
          onClick={() => onInsert(action.before, action.after, action.placeholder)}
          style={
            action.label === "B"
              ? { fontWeight: 700 }
              : action.label === "I"
                ? { fontStyle: "italic" }
                : undefined
          }
        >
          {action.label}
        </button>
      ))}

      <div className="flex-1" />

      {/* View mode toggles */}
      <div className="flex gap-1 flex-shrink-0">
        <button
          className="view-toggle-btn"
          data-active={viewMode === "editor"}
          onClick={() => onViewModeChange("editor")}
        >
          Edit
        </button>
        <button
          className="view-toggle-btn"
          data-active={viewMode === "split"}
          onClick={() => onViewModeChange("split")}
        >
          Split
        </button>
        <button
          className="view-toggle-btn"
          data-active={viewMode === "preview"}
          onClick={() => onViewModeChange("preview")}
        >
          Preview
        </button>
      </div>
    </div>
  );
}
