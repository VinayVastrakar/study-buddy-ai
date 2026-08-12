import type { GeneratedNotes, NoteUnit, NoteTopic } from "@/types/notes";

export interface ParsedImport {
  units: NoteUnit[];
  meta?: { subject?: string; course?: string; language?: string; detailLevel?: string };
}

const UNIT_RE = /^(?:#\s*)?(?:unit|module|chapter|part)\s*[-–:.]?\s*([0-9]+|[IVXLC]+)\s*[-–:.)]?\s*(.*)$/i;
const NUMBERED_TOPIC_RE = /^(\d+(?:\.\d+)+)\s*[-–:.)]?\s+(.{2,120})$/;

function isMarkdownUnit(line: string) {
  return /^#\s+\S/.test(line);
}
function isMarkdownTopic(line: string) {
  return /^#{2,4}\s+\S/.test(line);
}
function stripHashes(line: string) {
  return line.replace(/^#+\s*/, "").trim();
}

/** Heuristic parse of plain text / markdown into units + topics. */
export function parseTextToUnits(text: string): NoteUnit[] {
  const lines = text.replace(/\r/g, "").split("\n");
  const units: NoteUnit[] = [];
  let unit: NoteUnit | null = null;
  let topic: NoteTopic | null = null;

  const pushTopic = () => {
    if (topic) {
      topic.content = topic.content.trim();
      if (!unit) unit = { unitNumber: String(units.length + 1), unitName: "Imported", topics: [] };
      unit.topics.push(topic);
      topic = null;
    }
  };
  const pushUnit = () => {
    pushTopic();
    if (unit) {
      if (unit.topics.length === 0) unit.topics.push({ topicName: unit.unitName, content: "" });
      units.push(unit);
      unit = null;
    }
  };

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) {
      if (topic) topic.content += "\n";
      continue;
    }

    const unitMatch = line.match(UNIT_RE);
    if (unitMatch || (isMarkdownUnit(line) && !unitMatch)) {
      pushUnit();
      if (unitMatch) {
        unit = {
          unitNumber: unitMatch[1],
          unitName: (unitMatch[2] || `Unit ${unitMatch[1]}`).replace(/[:–-]\s*$/, "").trim() || `Unit ${unitMatch[1]}`,
          topics: [],
        };
      } else {
        unit = { unitNumber: String(units.length + 1), unitName: stripHashes(line), topics: [] };
      }
      continue;
    }

    const numbered = line.match(NUMBERED_TOPIC_RE);
    if (isMarkdownTopic(line) || numbered) {
      pushTopic();
      topic = { topicName: numbered ? numbered[2].trim() : stripHashes(line), content: "" };
      continue;
    }

    // bullet lists of topic names when no topic started yet -> treat each as a topic name
    const bullet = line.match(/^[-*•]\s+(.{2,120})$/);
    if (bullet && !topic) {
      pushTopic();
      topic = { topicName: bullet[1].trim(), content: "" };
      continue;
    }

    if (!topic) topic = { topicName: line.slice(0, 120), content: "" };
    else topic.content += (topic.content ? "\n" : "") + raw;
  }
  pushUnit();

  return units.filter((u) => u.topics.length > 0);
}

/** Parse a JSON file — supports the app's own export shape. */
export function parseJSONImport(text: string): ParsedImport {
  const data = JSON.parse(text);
  if (data && Array.isArray(data.units)) {
    const notes = data as GeneratedNotes;
    return {
      units: notes.units.map((u, i) => ({
        unitNumber: String(u.unitNumber ?? i + 1),
        unitName: u.unitName || `Unit ${i + 1}`,
        topics: (u.topics || []).map((t) => ({ topicName: t.topicName || "Untitled", content: t.content || "" })),
      })),
      meta: {
        subject: notes.subject,
        course: notes.course,
        language: notes.language,
        detailLevel: notes.detailLevel,
      },
    };
  }
  // single topic object
  if (data && (data.topicName || data.content)) {
    return { units: [{ unitNumber: "1", unitName: "Imported", topics: [{ topicName: data.topicName || "Imported topic", content: data.content || "" }] }] };
  }
  if (Array.isArray(data)) {
    return {
      units: [{
        unitNumber: "1",
        unitName: "Imported",
        topics: data.map((t: any, i: number) => ({
          topicName: t?.topicName || t?.name || `Topic ${i + 1}`,
          content: t?.content || "",
        })),
      }],
    };
  }
  throw new Error("Unrecognised JSON structure");
}

async function extractDocx(file: File): Promise<string> {
  const mammoth = await import("mammoth/mammoth.browser");
  const buf = await file.arrayBuffer();
  const res = await (mammoth as any).convertToMarkdown({ arrayBuffer: buf });
  return res.value as string;
}

async function extractPdf(file: File): Promise<string> {
  const pdfjs: any = await import("pdfjs-dist");
  const workerUrl = (await import("pdfjs-dist/build/pdf.worker.min.mjs?url")).default;
  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
  const buf = await file.arrayBuffer();
  const doc = await pdfjs.getDocument({ data: buf }).promise;
  let out = "";
  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);
    const content = await page.getTextContent();
    let lastY: number | null = null;
    for (const item of content.items as any[]) {
      const y = item.transform?.[5];
      if (lastY !== null && y !== undefined && Math.abs(y - lastY) > 2) out += "\n";
      out += item.str;
      lastY = y ?? lastY;
    }
    out += "\n\n";
  }
  return out;
}

/** Read any supported file and return detected units/topics. */
export async function parseImportFile(file: File): Promise<ParsedImport> {
  const name = file.name.toLowerCase();

  if (name.endsWith(".json")) return parseJSONImport(await file.text());

  if (name.endsWith(".docx")) {
    const text = await extractDocx(file);
    return { units: parseTextToUnits(text) };
  }

  if (name.endsWith(".doc")) {
    throw new Error("Legacy .doc files are not supported — save as .docx first");
  }

  if (name.endsWith(".pdf")) {
    const text = await extractPdf(file);
    return { units: parseTextToUnits(text) };
  }

  if (name.endsWith(".md") || name.endsWith(".markdown") || name.endsWith(".txt")) {
    return { units: parseTextToUnits(await file.text()) };
  }

  throw new Error("Unsupported file type. Use .docx, .md, .json, .pdf or .txt");
}
