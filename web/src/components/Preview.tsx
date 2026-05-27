import { useRef, useCallback, useMemo, forwardRef, useImperativeHandle } from "react";
import { parseMarkdown } from "../lib/markdown";

interface PreviewProps {
  markdown: string;
  onScroll?: (scrollFraction: number) => void;
  onClickLine?: (lineNumber: number) => void;
}

export interface PreviewHandle {
  scrollToFraction: (fraction: number) => void;
}

const Preview = forwardRef<PreviewHandle, PreviewProps>(function Preview(
  { markdown, onScroll, onClickLine },
  ref,
) {
  const containerRef = useRef<HTMLDivElement>(null);

  useImperativeHandle(ref, () => ({
    scrollToFraction: (fraction: number) => {
      const el = containerRef.current;
      if (el) {
        const maxScroll = el.scrollHeight - el.clientHeight;
        el.scrollTop = fraction * maxScroll;
      }
    },
  }));

  const html = useMemo(() => parseMarkdown(markdown), [markdown]);

  const handleScroll = useCallback(() => {
    const el = containerRef.current;
    if (el && onScroll) {
      const maxScroll = el.scrollHeight - el.clientHeight;
      const fraction = maxScroll > 0 ? el.scrollTop / maxScroll : 0;
      onScroll(fraction);
    }
  }, [onScroll]);

  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      if (!onClickLine) return;
      // Find the closest element with data-source-line to estimate line position
      const target = e.target as HTMLElement;
      const sourceEl = target.closest("[data-source-line]");
      if (!sourceEl || !containerRef.current) return;

      // Estimate which line this corresponds to based on position ratio
      const allSourceEls = containerRef.current.querySelectorAll("[data-source-line]");
      const totalElements = allSourceEls.length;
      if (totalElements === 0) return;

      let elIndex = 0;
      allSourceEls.forEach((el, idx) => {
        if (el === sourceEl) elIndex = idx;
      });

      const lineCount = markdown.split("\n").length;
      const estimatedLine = Math.round((elIndex / totalElements) * lineCount);
      onClickLine(estimatedLine);
    },
    [onClickLine, markdown],
  );

  return (
    <div
      ref={containerRef}
      className="markdown-preview h-full overflow-y-auto p-6"
      onScroll={handleScroll}
      onClick={handleClick}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
});

export default Preview;
