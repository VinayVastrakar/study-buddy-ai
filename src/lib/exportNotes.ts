import type { GeneratedNotes } from "@/types/notes";

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
      lines.push(t.content.trim());
      lines.push("");
    }
  }
  const blob = new Blob([lines.join("\n")], { type: "text/markdown;charset=utf-8" });
  download(blob, filename(notes, "md"));
}

/* -------------------- PDF -------------------- */
export async function exportPDF(notes: GeneratedNotes) {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 48;
  const maxW = pageW - margin * 2;
  let y = margin;

  const ensureSpace = (needed: number) => {
    if (y + needed > pageH - margin) {
      doc.addPage();
      y = margin;
    }
  };

  const writeLines = (text: string, size: number, style: "normal" | "bold" | "italic" = "normal", lineGap = 4) => {
    doc.setFont("helvetica", style);
    doc.setFontSize(size);
    const lines = doc.splitTextToSize(text, maxW) as string[];
    const lineH = size * 1.25;
    for (const line of lines) {
      ensureSpace(lineH);
      doc.text(line, margin, y);
      y += lineH;
    }
    y += lineGap;
  };

  // Title page
  writeLines(notes.subject || "Study Notes", 26, "bold", 8);
  if (notes.course) writeLines(notes.course, 14, "italic", 4);
  writeLines(`Language: ${notes.language}   •   Detail Level: ${notes.detailLevel}`, 11, "normal", 8);
  doc.setDrawColor(180);
  doc.line(margin, y, pageW - margin, y);
  y += 16;

  for (const u of notes.units) {
    ensureSpace(60);
    writeLines(`Unit ${u.unitNumber} — ${u.unitName}`, 18, "bold", 6);
    for (const t of u.topics) {
      ensureSpace(40);
      writeLines(t.topicName, 13, "bold", 4);
      writeLines(t.content.trim(), 11, "normal", 10);
    }
  }

  doc.save(filename(notes, "pdf"));
}

/* -------------------- DOCX -------------------- */
export async function exportDOCX(notes: GeneratedNotes) {
  const { Document, Packer, Paragraph, HeadingLevel, TextRun, AlignmentType } = await import("docx");

  const children: any[] = [
    new Paragraph({
      heading: HeadingLevel.HEADING_1,
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: notes.subject || "Study Notes", bold: true })],
    }),
  ];
  if (notes.course) {
    children.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [new TextRun({ text: notes.course, italics: true })],
      })
    );
  }
  children.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: `Language: ${notes.language}  •  Detail Level: ${notes.detailLevel}`, size: 20 })],
    }),
    new Paragraph({ children: [new TextRun("")] })
  );

  for (const u of notes.units) {
    children.push(
      new Paragraph({
        heading: HeadingLevel.HEADING_2,
        children: [new TextRun({ text: `Unit ${u.unitNumber} — ${u.unitName}`, bold: true })],
      })
    );
    for (const t of u.topics) {
      children.push(
        new Paragraph({
          heading: HeadingLevel.HEADING_3,
          children: [new TextRun({ text: t.topicName, bold: true })],
        })
      );
      const paragraphs = t.content.split(/\n\s*\n/);
      for (const p of paragraphs) {
        children.push(
          new Paragraph({
            children: [new TextRun(p.replace(/\n/g, " ").trim())],
            spacing: { after: 120 },
          })
        );
      }
    }
  }

  const doc = new Document({ sections: [{ children }] });
  const blob = await Packer.toBlob(doc);
  download(blob, filename(notes, "docx"));
}

/* -------------------- Per-topic exports -------------------- */
import type { NoteUnit, NoteTopic } from "@/types/notes";

const topicNotes = (subject: string, unit: NoteUnit, topic: NoteTopic): GeneratedNotes => ({
  subject: `${subject} — ${topic.topicName}`,
  course: `Unit ${unit.unitNumber}: ${unit.unitName}`,
  language: "",
  detailLevel: "",
  units: [{ unitNumber: unit.unitNumber, unitName: unit.unitName, topics: [topic] }],
});

export const exportTopicPDF = (s: string, u: NoteUnit, t: NoteTopic) => exportPDF(topicNotes(s, u, t));
export const exportTopicDOCX = (s: string, u: NoteUnit, t: NoteTopic) => exportDOCX(topicNotes(s, u, t));
export const exportTopicMarkdown = (s: string, u: NoteUnit, t: NoteTopic) => exportMarkdown(topicNotes(s, u, t));
export const exportTopicJSON = (s: string, u: NoteUnit, t: NoteTopic) => exportJSON(topicNotes(s, u, t));
