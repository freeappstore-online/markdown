import { countWords, countChars, readingTime } from "../lib/markdown";

interface StatusBarProps {
  content: string;
}

export default function StatusBar({ content }: StatusBarProps) {
  const words = countWords(content);
  const chars = countChars(content);
  const minutes = readingTime(content);
  const lines = content.split("\n").length;

  return (
    <div
      className="flex items-center gap-4 px-3 py-1 text-xs border-t flex-shrink-0"
      style={{
        borderColor: "var(--line)",
        background: "var(--dock)",
        color: "var(--muted)",
      }}
    >
      <span>{words} words</span>
      <span>{chars} chars</span>
      <span>{lines} lines</span>
      <span>{minutes} min read</span>
    </div>
  );
}
