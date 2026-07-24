import type { GeneratedNotes, NoteUnit, NoteTopic } from "@/types/notes";
import { renderMarkdownHtml } from "@/lib/markdown";

const sanitize = (s: string) =>
  (s || "notes").replace(/[^\w\s-]/g, "").trim().replace(/\s+/g, "-").toLowerCase().slice(0, 60) || "notes";

const filename = (notes: GeneratedNotes, ext: string) => `${sanitize(notes.subject)}-notes.${ext}`;

const download = (blob: Blob, name: string) => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};

/* -------------------- HTML builders -------------------- */
const EXPORT_CSS = `
  body { font-family: 'Georgia', 'DM Sans', serif; color: #1a1a1a; line-height: 1.6; padding: 24px; }
  h1 { font-family: 'Instrument Serif', 'Georgia', serif; font-size: 32px; margin: 0 0 8px; color: #5b3a1f; }
  h2 { font-family: 'Instrument Serif', 'Georgia', serif; font-size: 24px; margin: 28px 0 10px; color: #7a4a1c; border-bottom: 1px solid #d9c8a8; padding-bottom: 6px; }
  h3 { font-family: 'Instrument Serif', 'Georgia', serif; font-size: 18px; margin: 20px 0 8px; color: #333; }
  h4, h5, h6 { font-family: 'Georgia', serif; margin: 14px 0 6px; }
  p { margin: 8px 0; }
  ul, ol { margin: 8px 0 8px 24px; }
  li { margin: 4px 0; }
  strong { font-weight: 700; color: #222; }
  em { font-style: italic; }
  code { background: #f4ecd8; padding: 2px 5px; border-radius: 3px; font-family: 'Courier New', monospace; font-size: 90%; }
  pre { background: #f4ecd8; padding: 10px; border-radius: 4px; overflow-x: auto; font-family: 'Courier New', monospace; font-size: 90%; }
  pre code { background: transparent; padding: 0; }
  blockquote { border-left: 3px solid #b98a3a; margin: 10px 0; padding: 4px 12px; color: #555; font-style: italic; }
  table { border-collapse: collapse; margin: 10px 0; width: 100%; }
  th, td { border: 1px solid #cbb98a; padding: 6px 10px; text-align: left; }
  th { background: #f4ecd8; }
  .meta { color: #666; font-size: 13px; margin-bottom: 20px; }
  .topic { margin-bottom: 18px; }
  hr { border: 0; border-top: 1px solid #d9c8a8; margin: 18px 0; }
`;

const buildFullHtml = (notes: GeneratedNotes): string => {
  const parts: string[] = [];
  parts.push(`<h1>${escapeHtml(notes.subject || "Study Notes")}</h1>`);
  if (notes.course) parts.push(`<p class="meta"><em>${escapeHtml(notes.course)}</em></p>`);
  parts.push(
    `<p class="meta">Language: ${escapeHtml(notes.language)} &nbsp;•&nbsp; Detail Level: ${escapeHtml(notes.detailLevel)}</p>`
  );
  parts.push("<hr />");
  for (const u of notes.units) {
    parts.push(`<h2>Unit ${escapeHtml(u.unitNumber)} — ${escapeHtml(u.unitName)}</h2>`);
    for (const t of u.topics) {
      parts.push(`<div class="topic"><h3>${escapeHtml(t.topicName)}</h3>`);
      parts.push(renderMarkdownHtml(t.content || ""));
      parts.push(`</div>`);
    }
  }
  return wrapDocument(notes.subject || "Study Notes", parts.join("\n"));
};

const buildTopicHtml = (subject: string, unit: NoteUnit, topic: NoteTopic): string => {
  const body =
    `<h1>${escapeHtml(topic.topicName)}</h1>` +
    `<p class="meta">${escapeHtml(subject)} &nbsp;•&nbsp; Unit ${escapeHtml(unit.unitNumber)}: ${escapeHtml(unit.unitName)}</p>` +
    `<hr />` +
    renderMarkdownHtml(topic.content || "");
  return wrapDocument(topic.topicName, body);
};

const wrapDocument = (title: string, body: string): string => `
<!doctype html>
<html><head><meta charset="utf-8"><title>${escapeHtml(title)}</title>
<style>${EXPORT_CSS}</style></head>
<body>${body}</body></html>`;

const escapeHtml = (s: string) =>
  (s || "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));

/* -------------------- JSON -------------------- */
export function exportJSON(notes: GeneratedNotes) {
  const blob = new Blob([JSON.stringify(notes, null, 2)], { type: "application/json" });
  download(blob, filename(notes, "json"));
}

/* -------------------- Markdown -------------------- */
export function exportMarkdown(notes: GeneratedNotes) {
  const lines: string[] = [];
  lines.push(`# ${notes.subject || "Study Notes"}`);
  if (notes.course) lines.push(`\n**Course:** ${notes.course}`);
  lines.push(`**Language:** ${notes.language}  \n**Detail Level:** ${notes.detailLevel}`);
  lines.push("\n---\n");
  for (const u of notes.units) {
    lines.push(`\n## Unit ${u.unitNumber} — ${u.unitName}\n`);
    for (const t of u.topics) {
      lines.push(`\n### ${t.topicName}\n`);
      lines.push((t.content || "").trim());
      lines.push("");
    }
  }
  const blob = new Blob([lines.join("\n")], { type: "text/markdown;charset=utf-8" });
  download(blob, filename(notes, "md"));
}

/* -------------------- PDF (formatted from HTML via jsPDF.html) -------------------- */
async function htmlToPdf(html: string, name: string) {
  const { jsPDF } = await import("jspdf");
  // Parse full doc → extract <body> so jsPDF renders only the body content.
  const doc = new DOMParser().parseFromString(html, "text/html");
  const bodyHtml = doc.body.innerHTML;
  const styleTag = doc.querySelector("style")?.innerHTML || "";

  const container = document.createElement("div");
  container.style.position = "fixed";
  container.style.left = "-10000px";
  container.style.top = "0";
  container.style.width = "780px";
  container.style.background = "#ffffff";
  container.innerHTML = `<style>${styleTag}</style><div class="pdf-root">${bodyHtml}</div>`;
  document.body.appendChild(container);

  try {
    const pdf = new jsPDF({ unit: "pt", format: "a4", orientation: "portrait" });
    const pageWidth = pdf.internal.pageSize.getWidth();
    const margin = 36; // ~0.5in
    await pdf.html(container, {
      x: margin,
      y: margin,
      width: pageWidth - margin * 2,
      windowWidth: 780,
      autoPaging: "text",
      margin: [margin, margin, margin, margin],
      html2canvas: { scale: 0.75, useCORS: true, backgroundColor: "#ffffff", letterRendering: true },
    });
    pdf.save(name);
  } finally {
    container.remove();
  }
}

export async function exportPDF(notes: GeneratedNotes) {
  await htmlToPdf(buildFullHtml(notes), filename(notes, "pdf"));
}

/* -------------------- DOCX (from HTML → keeps formatting) -------------------- */
async function htmlToDocx(html: string, name: string) {
  const { asBlob } = await import("html-docx-js-typescript");
  const result = await asBlob(html);
  const blob = result instanceof Blob
    ? result
    : new Blob([result as unknown as ArrayBuffer], {
        type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      });
  download(blob, name);
}

export async function exportDOCX(notes: GeneratedNotes) {
  await htmlToDocx(buildFullHtml(notes), filename(notes, "docx"));
}

/* -------------------- Per-topic exports -------------------- */
const topicFilename = (subject: string, topic: NoteTopic, ext: string) =>
  `${sanitize(subject)}-${sanitize(topic.topicName)}.${ext}`;

export const exportTopicPDF = (s: string, u: NoteUnit, t: NoteTopic) =>
  htmlToPdf(buildTopicHtml(s, u, t), topicFilename(s, t, "pdf"));

export const exportTopicDOCX = (s: string, u: NoteUnit, t: NoteTopic) =>
  htmlToDocx(buildTopicHtml(s, u, t), topicFilename(s, t, "docx"));

export const exportTopicMarkdown = (s: string, u: NoteUnit, t: NoteTopic) => {
  const md = `# ${t.topicName}\n\n_${s} — Unit ${u.unitNumber}: ${u.unitName}_\n\n---\n\n${t.content || ""}\n`;
  download(new Blob([md], { type: "text/markdown;charset=utf-8" }), topicFilename(s, t, "md"));
};

export const exportTopicJSON = (s: string, u: NoteUnit, t: NoteTopic) => {
  const payload = { subject: s, unit: { unitNumber: u.unitNumber, unitName: u.unitName }, topic: t };
  download(new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" }), topicFilename(s, t, "json"));
};
