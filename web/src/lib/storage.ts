import type { Document } from "./types";

const DOCS_KEY = "markdown-editor-docs";
const ACTIVE_KEY = "markdown-editor-active";

function generateId(): string {
  return crypto.randomUUID();
}

export function loadDocuments(): Document[] {
  try {
    const raw = localStorage.getItem(DOCS_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed as Document[];
  } catch {
    return [];
  }
}

export function saveDocuments(docs: Document[]): void {
  localStorage.setItem(DOCS_KEY, JSON.stringify(docs));
}

export function getActiveDocId(): string | null {
  return localStorage.getItem(ACTIVE_KEY);
}

export function setActiveDocId(id: string): void {
  localStorage.setItem(ACTIVE_KEY, id);
}

export function createDocument(title?: string): Document {
  const now = Date.now();
  return {
    id: generateId(),
    title: title ?? "Untitled",
    content: "",
    createdAt: now,
    updatedAt: now,
  };
}

const DEFAULT_CONTENT = `# Welcome to Markdown Editor

Start writing markdown here. The preview will update in real-time.

## Features

- **Bold**, *italic*, and ~~strikethrough~~ text
- [Links](https://freeappstore.online) and ![images](https://via.placeholder.com/150)
- Code: \`inline\` and fenced blocks
- Lists, blockquotes, tables, and more

### Code Example

\`\`\`javascript
function greet(name) {
  return \`Hello, \${name}!\`;
}

console.log(greet("World"));
\`\`\`

### Table Example

| Feature | Status |
|---------|--------|
| Headings | Done |
| Bold/Italic | Done |
| Links | Done |
| Code blocks | Done |
| Tables | Done |

### Task List

- [x] Build markdown parser
- [x] Add live preview
- [ ] Conquer the world

> "The best way to predict the future is to create it." -- Peter Drucker

---

Happy writing!
`;

export function createDefaultDocument(): Document {
  const doc = createDocument("Welcome");
  doc.content = DEFAULT_CONTENT;
  return doc;
}
