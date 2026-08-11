import { marked } from "marked";

marked.setOptions({ gfm: true, breaks: false });

/**
 * Render markdown to HTML and wrap each sentence in a
 * `<span data-sent="idx">` marker so the reader can highlight them.
 * Also returns the plain-text sentence array for TTS.
 */
export function renderMarkdownWithSentences(md: string): {
  html: string;
  sentences: string[];
} {
  const raw = marked.parse(md || "", { async: false }) as string;
  const container = document.createElement("div");
  container.innerHTML = raw;

  const sentences: string[] = [];
  const splitRe = /(?<=[.!?।])\s+(?=\S)/;

  const walk = (node: Node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent || "";
      if (!text.trim()) return;
      const parts = text.split(splitRe);
      if (parts.length === 1 && parts[0] === text) {
        const idx = sentences.length;
        sentences.push(text.trim());
        const span = document.createElement("span");
        span.setAttribute("data-sent", String(idx));
        span.textContent = text;
        node.parentNode?.replaceChild(span, node);
        return;
      }
      const frag = document.createDocumentFragment();
      parts.forEach((part, i) => {
        if (!part.trim()) {
          frag.appendChild(document.createTextNode(part));
          return;
        }
        const idx = sentences.length;
        sentences.push(part.trim());
        const span = document.createElement("span");
        span.setAttribute("data-sent", String(idx));
        span.textContent = part;
        frag.appendChild(span);
        if (i < parts.length - 1) frag.appendChild(document.createTextNode(" "));
      });
      node.parentNode?.replaceChild(frag, node);
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      const tag = (node as HTMLElement).tagName;
      if (tag === "CODE" || tag === "PRE") return;
      Array.from(node.childNodes).forEach(walk);
    }
  };
  Array.from(container.childNodes).forEach(walk);
  return { html: container.innerHTML, sentences };
}

/** Plain markdown → HTML for exports (no sentence spans). */
export function renderMarkdownHtml(md: string): string {
  return marked.parse(md || "", { async: false }) as string;
}
