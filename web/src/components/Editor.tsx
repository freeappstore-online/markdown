import { useRef, useCallback, useEffect, useMemo, forwardRef, useImperativeHandle } from "react";

interface EditorProps {
  value: string;
  onChange: (value: string) => void;
  onScroll?: (scrollFraction: number) => void;
}

export interface EditorHandle {
  getTextarea: () => HTMLTextAreaElement | null;
  scrollToFraction: (fraction: number) => void;
}

const Editor = forwardRef<EditorHandle, EditorProps>(function Editor(
  { value, onChange, onScroll },
  ref,
) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const lineNumbersRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useImperativeHandle(ref, () => ({
    getTextarea: () => textareaRef.current,
    scrollToFraction: (fraction: number) => {
      const ta = textareaRef.current;
      if (ta) {
        const maxScroll = ta.scrollHeight - ta.clientHeight;
        ta.scrollTop = fraction * maxScroll;
      }
    },
  }));

  const lineCount = useMemo(() => {
    return value.split("\n").length;
  }, [value]);

  const handleScroll = useCallback(() => {
    const ta = textareaRef.current;
    const ln = lineNumbersRef.current;
    if (ta && ln) {
      ln.scrollTop = ta.scrollTop;
      if (onScroll) {
        const maxScroll = ta.scrollHeight - ta.clientHeight;
        const fraction = maxScroll > 0 ? ta.scrollTop / maxScroll : 0;
        onScroll(fraction);
      }
    }
  }, [onScroll]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Tab") {
        e.preventDefault();
        const ta = e.currentTarget;
        const start = ta.selectionStart;
        const end = ta.selectionEnd;
        const newValue = value.substring(0, start) + "  " + value.substring(end);
        onChange(newValue);
        // Set cursor position after React re-renders
        requestAnimationFrame(() => {
          ta.selectionStart = ta.selectionEnd = start + 2;
        });
      }
    },
    [value, onChange],
  );

  // Keep line numbers synced
  useEffect(() => {
    const ta = textareaRef.current;
    const ln = lineNumbersRef.current;
    if (ta && ln) {
      ln.scrollTop = ta.scrollTop;
    }
  });

  return (
    <div ref={containerRef} className="flex h-full relative overflow-hidden">
      {/* Line numbers */}
      <div
        ref={lineNumbersRef}
        className="line-numbers flex-shrink-0 py-3 px-2 text-right overflow-hidden select-none"
        style={{
          width: "3.5em",
          background: "var(--panel)",
          borderRight: "1px solid var(--line)",
        }}
        aria-hidden="true"
      >
        {Array.from({ length: lineCount }, (_, i) => (
          <div key={i} style={{ height: "1.6em" }}>
            {i + 1}
          </div>
        ))}
      </div>

      {/* Textarea */}
      <textarea
        ref={textareaRef}
        className="editor-textarea flex-1 w-full h-full p-3 border-0"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onScroll={handleScroll}
        onKeyDown={handleKeyDown}
        placeholder="Start writing markdown..."
        spellCheck={false}
        autoCapitalize="off"
        autoComplete="off"
      />
    </div>
  );
});

export default Editor;
