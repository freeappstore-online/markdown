/**
 * Markdown-to-HTML parser built from scratch.
 * Supports block-level and inline-level parsing with XSS prevention.
 */

// ── Helpers ──────────────────────────────────────────────────────────

/** Escape HTML entities to prevent XSS */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// ── Syntax Highlighting ─────────────────────────────────────────────

const SYNTAX_RULES: Record<string, Array<{ pattern: RegExp; cls: string }>> = {
  javascript: [
    { pattern: /\b(const|let|var|function|return|if|else|for|while|do|switch|case|break|continue|new|this|class|extends|import|export|from|default|async|await|try|catch|finally|throw|typeof|instanceof|in|of|yield|void|delete|super|static|get|set)\b/g, cls: "syntax-keyword" },
    { pattern: /("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|`(?:[^`\\]|\\.)*`)/g, cls: "syntax-string" },
    { pattern: /(\/\/[^\n]*)/g, cls: "syntax-comment" },
    { pattern: /(\/\*[\s\S]*?\*\/)/g, cls: "syntax-comment" },
    { pattern: /\b(\d+\.?\d*)\b/g, cls: "syntax-number" },
  ],
  typescript: [
    { pattern: /\b(const|let|var|function|return|if|else|for|while|do|switch|case|break|continue|new|this|class|extends|import|export|from|default|async|await|try|catch|finally|throw|typeof|instanceof|in|of|yield|void|delete|super|static|get|set|type|interface|enum|namespace|declare|as|is|keyof|readonly|implements|abstract|override)\b/g, cls: "syntax-keyword" },
    { pattern: /("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|`(?:[^`\\]|\\.)*`)/g, cls: "syntax-string" },
    { pattern: /(\/\/[^\n]*)/g, cls: "syntax-comment" },
    { pattern: /(\/\*[\s\S]*?\*\/)/g, cls: "syntax-comment" },
    { pattern: /\b(\d+\.?\d*)\b/g, cls: "syntax-number" },
  ],
  python: [
    { pattern: /\b(def|class|return|if|elif|else|for|while|break|continue|import|from|as|try|except|finally|raise|with|yield|lambda|pass|del|global|nonlocal|assert|and|or|not|is|in|True|False|None|async|await|print|self)\b/g, cls: "syntax-keyword" },
    { pattern: /("""[\s\S]*?"""|'''[\s\S]*?'''|"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')/g, cls: "syntax-string" },
    { pattern: /(#[^\n]*)/g, cls: "syntax-comment" },
    { pattern: /\b(\d+\.?\d*)\b/g, cls: "syntax-number" },
  ],
  html: [
    { pattern: /(&lt;\/?[a-zA-Z][a-zA-Z0-9]*)/g, cls: "syntax-tag" },
    { pattern: /(&gt;)/g, cls: "syntax-tag" },
    { pattern: /\b([a-zA-Z-]+)=/g, cls: "syntax-attr" },
    { pattern: /("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')/g, cls: "syntax-string" },
    { pattern: /(&lt;!--[\s\S]*?--&gt;)/g, cls: "syntax-comment" },
  ],
  css: [
    { pattern: /([.#]?[a-zA-Z_][\w-]*)\s*\{/g, cls: "syntax-selector" },
    { pattern: /\b([a-zA-Z-]+)\s*:/g, cls: "syntax-property" },
    { pattern: /("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')/g, cls: "syntax-string" },
    { pattern: /(\/\*[\s\S]*?\*\/)/g, cls: "syntax-comment" },
    { pattern: /\b(\d+\.?\d*(px|em|rem|%|vh|vw|s|ms)?)\b/g, cls: "syntax-number" },
  ],
};

// Aliases
SYNTAX_RULES["js"] = SYNTAX_RULES["javascript"]!;
SYNTAX_RULES["ts"] = SYNTAX_RULES["typescript"]!;
SYNTAX_RULES["py"] = SYNTAX_RULES["python"]!;

function highlightCode(code: string, lang: string): string {
  const escaped = escapeHtml(code);
  const rules = SYNTAX_RULES[lang.toLowerCase()];
  if (!rules) return escaped;

  // Mark regions to avoid double-highlighting. We apply rules in order
  // and replace matches with placeholders, then restore them at the end.
  interface Span { start: number; end: number; html: string }
  const spans: Span[] = [];

  for (const rule of rules) {
    const regex = new RegExp(rule.pattern.source, rule.pattern.flags);
    let m: RegExpExecArray | null;
    while ((m = regex.exec(escaped)) !== null) {
      const matchText = m[1] ?? m[0];
      if (!matchText) continue;
      const start = m.index + (m[0].indexOf(matchText));
      const end = start + matchText.length;
      // Skip if overlapping an existing span
      const overlaps = spans.some(s => start < s.end && end > s.start);
      if (!overlaps) {
        spans.push({
          start,
          end,
          html: `<span class="${rule.cls}">${matchText}</span>`,
        });
      }
    }
  }

  // Sort spans by position descending so we can replace from back to front
  spans.sort((a, b) => b.start - a.start);

  let result = escaped;
  for (const span of spans) {
    result = result.slice(0, span.start) + span.html + result.slice(span.end);
  }

  return result;
}

// ── Inline Parsing ──────────────────────────────────────────────────

function parseInline(text: string): string {
  let result = escapeHtml(text);

  // Extract inline code spans first to protect their contents from other transforms.
  // Replace them with placeholders, then restore after all other transforms.
  const codeSpans: string[] = [];
  result = result.replace(/`([^`]+)`/g, (_match, code: string) => {
    const idx = codeSpans.length;
    codeSpans.push(`<code>${code}</code>`);
    return `\x00CODE${idx}\x00`;
  });

  // Images: ![alt](url)
  result = result.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1" />');

  // Links: [text](url)
  result = result.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');

  // Bold+Italic: ***text*** or ___text___
  result = result.replace(/\*\*\*(.+?)\*\*\*/g, "<strong><em>$1</em></strong>");
  result = result.replace(/___(.+?)___/g, "<strong><em>$1</em></strong>");

  // Bold: **text** or __text__
  result = result.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  result = result.replace(/__(.+?)__/g, "<strong>$1</strong>");

  // Italic: *text* or _text_
  result = result.replace(/\*(.+?)\*/g, "<em>$1</em>");
  result = result.replace(/(?<!\w)_(.+?)_(?!\w)/g, "<em>$1</em>");

  // Strikethrough: ~~text~~
  result = result.replace(/~~(.+?)~~/g, "<del>$1</del>");

  // Auto-link bare URLs
  result = result.replace(
    /(?<!\w|"|=)(https?:\/\/[^\s<]+)/g,
    '<a href="$1" target="_blank" rel="noopener noreferrer">$1</a>',
  );

  // Line break: trailing double space or backslash before newline
  // (within a paragraph this has already been joined; handle explicit \)
  result = result.replace(/\\\n/g, "<br />");
  result = result.replace(/ {2,}\n/g, "<br />");

  // Restore code spans
  result = result.replace(/\x00CODE(\d+)\x00/g, (_match, idx: string) => {
    return codeSpans[Number(idx)] ?? "";
  });

  return result;
}

// ── Block-Level Parsing ─────────────────────────────────────────────

interface BlockToken {
  type: string;
  raw: string;
  html?: string;
}

interface HeadingToken extends BlockToken { type: "heading"; level: number; text: string }
interface ParagraphToken extends BlockToken { type: "paragraph"; text: string }
interface CodeBlockToken extends BlockToken { type: "code"; lang: string; code: string }
interface BlockquoteToken extends BlockToken { type: "blockquote"; content: string }
interface HrToken extends BlockToken { type: "hr" }
interface TableToken extends BlockToken {
  type: "table";
  headers: string[];
  alignments: ("left" | "center" | "right" | null)[];
  rows: string[][];
}
interface ListToken extends BlockToken {
  type: "list";
  ordered: boolean;
  items: ListItem[];
}
interface ListItem {
  content: string;
  checked: boolean | null; // null = not a task, true/false = task
  children: ListToken | null;
}
interface BlankToken extends BlockToken { type: "blank" }

type Token = HeadingToken | ParagraphToken | CodeBlockToken | BlockquoteToken | HrToken | TableToken | ListToken | BlankToken;

function tokenize(source: string): Token[] {
  const lines = source.split("\n");
  const tokens: Token[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i]!;

    // Blank line
    if (line.trim() === "") {
      tokens.push({ type: "blank", raw: line });
      i++;
      continue;
    }

    // Fenced code block: ```lang
    const codeMatch = /^(`{3,})(\w*)/.exec(line);
    if (codeMatch) {
      const fence = codeMatch[1]!;
      const lang = codeMatch[2] ?? "";
      const codeLines: string[] = [];
      i++;
      while (i < lines.length) {
        const cl = lines[i]!;
        if (cl.trimEnd() === fence || cl.trimEnd().startsWith(fence)) {
          i++;
          break;
        }
        codeLines.push(cl);
        i++;
      }
      tokens.push({
        type: "code",
        raw: "",
        lang,
        code: codeLines.join("\n"),
      });
      continue;
    }

    // Heading: # through ######
    const headingMatch = /^(#{1,6})\s+(.+)$/.exec(line);
    if (headingMatch) {
      tokens.push({
        type: "heading",
        raw: line,
        level: headingMatch[1]!.length,
        text: headingMatch[2]!,
      });
      i++;
      continue;
    }

    // Horizontal rule: --- or *** or ___ (3+ chars, possibly spaced)
    if (/^(\s*[-*_]\s*){3,}$/.test(line)) {
      tokens.push({ type: "hr", raw: line });
      i++;
      continue;
    }

    // Table: starts with | ... | and next line is separator
    if (/^\|(.+)\|$/.test(line.trim()) && i + 1 < lines.length) {
      const nextLine = lines[i + 1]!;
      if (/^\|[\s:|-]+\|$/.test(nextLine.trim())) {
        // Parse table
        const headerCells = line.trim().slice(1, -1).split("|").map(c => c.trim());
        const sepCells = nextLine.trim().slice(1, -1).split("|").map(c => c.trim());
        const alignments: ("left" | "center" | "right" | null)[] = sepCells.map(cell => {
          const left = cell.startsWith(":");
          const right = cell.endsWith(":");
          if (left && right) return "center";
          if (right) return "right";
          if (left) return "left";
          return null;
        });

        const rows: string[][] = [];
        let j = i + 2;
        while (j < lines.length && /^\|(.+)\|$/.test(lines[j]!.trim())) {
          const rowCells = lines[j]!.trim().slice(1, -1).split("|").map(c => c.trim());
          rows.push(rowCells);
          j++;
        }

        tokens.push({
          type: "table",
          raw: "",
          headers: headerCells,
          alignments,
          rows,
        });
        i = j;
        continue;
      }
    }

    // Blockquote: > text
    if (/^>\s?/.test(line)) {
      const bqLines: string[] = [];
      while (i < lines.length && /^>\s?/.test(lines[i]!)) {
        bqLines.push(lines[i]!.replace(/^>\s?/, ""));
        i++;
      }
      tokens.push({
        type: "blockquote",
        raw: "",
        content: bqLines.join("\n"),
      });
      continue;
    }

    // Unordered list: - item or * item
    if (/^(\s*)([-*])\s+/.test(line)) {
      const listResult = parseList(lines, i, false);
      tokens.push(listResult.token);
      i = listResult.nextIndex;
      continue;
    }

    // Ordered list: 1. item
    if (/^(\s*)\d+\.\s+/.test(line)) {
      const listResult = parseList(lines, i, true);
      tokens.push(listResult.token);
      i = listResult.nextIndex;
      continue;
    }

    // Paragraph: collect lines until blank line or block-level element
    const paraLines: string[] = [line];
    i++;
    while (i < lines.length) {
      const nextL = lines[i]!;
      if (
        nextL.trim() === "" ||
        /^#{1,6}\s/.test(nextL) ||
        /^(`{3,})/.test(nextL) ||
        /^>\s?/.test(nextL) ||
        /^(\s*[-*])\s+/.test(nextL) ||
        /^\s*\d+\.\s+/.test(nextL) ||
        /^(\s*[-*_]\s*){3,}$/.test(nextL) ||
        /^\|(.+)\|$/.test(nextL.trim())
      ) {
        break;
      }
      paraLines.push(nextL);
      i++;
    }
    tokens.push({
      type: "paragraph",
      raw: "",
      text: paraLines.join("\n"),
    });
  }

  return tokens;
}

function parseList(
  lines: string[],
  startIndex: number,
  ordered: boolean,
): { token: ListToken; nextIndex: number } {
  const items: ListItem[] = [];
  let i = startIndex;

  // Determine the indent level of this list
  const firstLine = lines[i]!;
  const baseIndent = firstLine.search(/\S/);
  const listPattern = ordered ? /^(\s*)\d+\.\s+(.*)$/ : /^(\s*)([-*])\s+(.*)$/;

  while (i < lines.length) {
    const line = lines[i]!;
    if (line.trim() === "") {
      // Blank line might end the list or be between items
      // Check if next non-blank line continues the list
      let j = i + 1;
      while (j < lines.length && lines[j]!.trim() === "") j++;
      if (j < lines.length) {
        const nextNonBlank = lines[j]!;
        const nextIndent = nextNonBlank.search(/\S/);
        if (nextIndent >= baseIndent && listPattern.test(nextNonBlank)) {
          i = j;
          continue;
        }
      }
      break;
    }

    const currentIndent = line.search(/\S/);
    if (currentIndent < baseIndent) break;

    if (currentIndent > baseIndent + 1) {
      // This is a continuation or nested list under the last item
      if (items.length > 0) {
        const lastItem = items[items.length - 1]!;
        // Collect all deeper lines
        const nestedLines: string[] = [];
        while (i < lines.length) {
          const nl = lines[i]!;
          if (nl.trim() === "") {
            nestedLines.push(nl);
            i++;
            continue;
          }
          const nlIndent = nl.search(/\S/);
          if (nlIndent <= baseIndent) break;
          nestedLines.push(nl);
          i++;
        }
        // Recursively parse nested list
        const dedented = nestedLines.map(l => {
          if (l.trim() === "") return "";
          const minIndent = baseIndent + 2;
          return l.length > minIndent ? l.slice(minIndent) : l.trimStart();
        });
        const isNestedOrdered = /^\d+\.\s+/.test(dedented.find(l => l.trim() !== "") ?? "");
        const nested = parseList(dedented, 0, isNestedOrdered);
        lastItem.children = nested.token;
      }
      continue;
    }

    // Match list item at base indent
    let match: RegExpExecArray | null;
    if (ordered) {
      match = /^(\s*)\d+\.\s+(.*)$/.exec(line);
    } else {
      const ulMatch = /^(\s*)[-*]\s+(.*)$/.exec(line);
      match = ulMatch;
    }

    if (match) {
      const content = match[2] ?? "";
      // Check for task list
      let checked: boolean | null = null;
      let itemContent = content;
      const taskMatch = /^\[([ xX])\]\s*(.*)$/.exec(content);
      if (taskMatch) {
        checked = taskMatch[1] !== " ";
        itemContent = taskMatch[2] ?? "";
      }
      items.push({ content: itemContent, checked, children: null });
      i++;
    } else {
      break;
    }
  }

  return {
    token: { type: "list", raw: "", ordered, items },
    nextIndex: i,
  };
}

// ── Render Tokens to HTML ───────────────────────────────────────────

function renderTokens(tokens: Token[]): string {
  const parts: string[] = [];

  for (const token of tokens) {
    switch (token.type) {
      case "heading":
        parts.push(
          `<h${token.level} data-source-line>${parseInline(token.text)}</h${token.level}>`,
        );
        break;

      case "paragraph":
        parts.push(`<p data-source-line>${parseInline(token.text)}</p>`);
        break;

      case "code": {
        const highlighted = highlightCode(token.code, token.lang);
        const langAttr = token.lang ? ` data-lang="${escapeHtml(token.lang)}"` : "";
        parts.push(
          `<pre${langAttr} data-source-line><code>${highlighted}</code></pre>`,
        );
        break;
      }

      case "blockquote": {
        // Recursively parse blockquote content
        const innerTokens = tokenize(token.content);
        const innerHtml = renderTokens(innerTokens);
        parts.push(`<blockquote data-source-line>${innerHtml}</blockquote>`);
        break;
      }

      case "hr":
        parts.push("<hr />");
        break;

      case "table": {
        let html = "<table><thead><tr>";
        token.headers.forEach((h, idx) => {
          const align = token.alignments[idx];
          const style = align ? ` style="text-align:${align}"` : "";
          html += `<th${style}>${parseInline(h)}</th>`;
        });
        html += "</tr></thead><tbody>";
        for (const row of token.rows) {
          html += "<tr>";
          row.forEach((cell, idx) => {
            const align = token.alignments[idx];
            const style = align ? ` style="text-align:${align}"` : "";
            html += `<td${style}>${parseInline(cell)}</td>`;
          });
          html += "</tr>";
        }
        html += "</tbody></table>";
        parts.push(html);
        break;
      }

      case "list": {
        parts.push(renderList(token));
        break;
      }

      case "blank":
        // Skip blank tokens
        break;
    }
  }

  return parts.join("\n");
}

function renderList(token: ListToken): string {
  const tag = token.ordered ? "ol" : "ul";
  let html = `<${tag}>`;

  for (const item of token.items) {
    if (item.checked !== null) {
      const checkedAttr = item.checked ? " checked disabled" : " disabled";
      html += `<li class="task-list-item"><input type="checkbox"${checkedAttr} />${parseInline(item.content)}`;
    } else {
      html += `<li>${parseInline(item.content)}`;
    }
    if (item.children) {
      html += renderList(item.children);
    }
    html += "</li>";
  }

  html += `</${tag}>`;
  return html;
}

// ── Public API ──────────────────────────────────────────────────────

export function parseMarkdown(source: string): string {
  const tokens = tokenize(source);
  return renderTokens(tokens);
}

/** Count words in a string */
export function countWords(text: string): number {
  const trimmed = text.trim();
  if (trimmed === "") return 0;
  return trimmed.split(/\s+/).length;
}

/** Count characters (excluding whitespace) */
export function countChars(text: string): number {
  return text.replace(/\s/g, "").length;
}

/** Estimate reading time in minutes */
export function readingTime(text: string): number {
  const words = countWords(text);
  return Math.max(1, Math.ceil(words / 200));
}

/** Generate a standalone HTML file with inline styles */
export function generateHtmlExport(title: string, markdownHtml: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>${escapeHtml(title)}</title>
<style>
  body {
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    line-height: 1.7;
    max-width: 800px;
    margin: 0 auto;
    padding: 2em;
    color: #1a1a1a;
    background: #fff;
  }
  h1, h2, h3, h4, h5, h6 { margin: 0.8em 0 0.4em; }
  h1 { font-size: 2em; border-bottom: 1px solid #e5e7eb; padding-bottom: 0.2em; }
  h2 { font-size: 1.5em; border-bottom: 1px solid #e5e7eb; padding-bottom: 0.15em; }
  h3 { font-size: 1.25em; }
  a { color: #2563eb; }
  code {
    font-family: "SF Mono", "Fira Code", monospace;
    font-size: 0.875em;
    background: #f3f4f6;
    border: 1px solid #e5e7eb;
    border-radius: 4px;
    padding: 0.15em 0.35em;
  }
  pre {
    background: #f3f4f6;
    border: 1px solid #e5e7eb;
    border-radius: 8px;
    padding: 1em;
    overflow-x: auto;
  }
  pre code { background: transparent; border: none; padding: 0; }
  blockquote {
    border-left: 4px solid #2563eb;
    margin: 0 0 1em;
    padding: 0.5em 1em;
    background: #f9fafb;
  }
  table { border-collapse: collapse; width: 100%; margin: 0 0 1em; }
  th, td { border: 1px solid #e5e7eb; padding: 0.5em 0.75em; text-align: left; }
  th { background: #f9fafb; font-weight: 600; }
  hr { border: none; border-top: 2px solid #e5e7eb; margin: 1.5em 0; }
  img { max-width: 100%; }
  .task-list-item { list-style: none; }
  .task-list-item input { margin-right: 0.5em; }
  del { color: #6b7280; }
</style>
</head>
<body>
${markdownHtml}
</body>
</html>`;
}
