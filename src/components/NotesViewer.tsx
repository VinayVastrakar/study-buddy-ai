import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  BookOpen, ChevronRight, ArrowLeft, GraduationCap, Download,
  Pencil, Plus, Save, X, Trash2, Sparkles, Loader2, FolderPlus, Upload,
} from "lucide-react";
import { toast } from "sonner";
import type { GeneratedNotes, NoteUnit } from "@/types/notes";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  exportPDF, exportDOCX, exportMarkdown, exportJSON,
  exportTopicPDF, exportTopicDOCX, exportTopicMarkdown, exportTopicJSON,
} from "@/lib/exportNotes";
import { parseImportFile } from "@/lib/importNotes";
import { supabase } from "@/integrations/supabase/client";
import MarkdownContent from "./MarkdownContent";
import ReadAloud from "./ReadAloud";


interface Props {
  notes: GeneratedNotes;
  onReset: () => void;
  onChange?: (updated: GeneratedNotes) => void | Promise<void>;
}

const DETAIL_LABELS: Record<string, string> = {
  "1": "Short Notes",
  "2": "Exam Ready",
  "3": "Deep Explanation",
  "4": "Teaching Mode",
};

export default function NotesViewer({ notes: initialNotes, onReset, onChange }: Props) {
  const [notes, setNotes] = useState<GeneratedNotes>(initialNotes);
  const [activeUnit, setActiveUnit] = useState(0);
  const [activeTopic, setActiveTopic] = useState(0);
  const [editing, setEditing] = useState(false);
  const [draftName, setDraftName] = useState("");
  const [draftContent, setDraftContent] = useState("");
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);

  // Add topic dialog (multi)
  const [addOpen, setAddOpen] = useState(false);
  const [addUnitIdx, setAddUnitIdx] = useState(0);
  const [newName, setNewName] = useState("");
  const [genDetail, setGenDetail] = useState(String(notes.detailLevel || "2"));
  const [genLang, setGenLang] = useState(notes.language || "English");

  // Add unit dialog (multi topics)
  const [unitOpen, setUnitOpen] = useState(false);
  const [newUnitName, setNewUnitName] = useState("");
  const [newUnitNumber, setNewUnitNumber] = useState("");
  const [newUnitTopic, setNewUnitTopic] = useState("");

  // Import dialog
  const [importOpen, setImportOpen] = useState(false);
  const [importUnits, setImportUnits] = useState<NoteUnit[]>([]);
  const [importSkipped, setImportSkipped] = useState<Set<string>>(new Set());
  const [importMode, setImportMode] = useState<"units" | "topics">("units");
  const [importRegen, setImportRegen] = useState(false);
  const [importing, setImporting] = useState(false);
  const importInputRef = useRef<HTMLInputElement>(null);



  // Read-aloud sentences (from rendered markdown)
  const [sentences, setSentences] = useState<string[]>([]);
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => { setNotes(initialNotes); }, [initialNotes]);

  const unit = notes.units[activeUnit];
  const topic = unit?.topics[activeTopic];

  const persist = async (next: GeneratedNotes) => {
    setNotes(next);
    if (onChange) {
      setSaving(true);
      try { await onChange(next); }
      finally { setSaving(false); }
    }
  };

  const callAI = async (topicName: string, unitName: string, detailLevel: string, language: string): Promise<string> => {
    const userApiKey = localStorage.getItem("gemini_api_key") || undefined;
    const { data, error } = await supabase.functions.invoke("generate-topic", {
      body: {
        topicName,
        subject: notes.subject,
        course: notes.course,
        unitName,
        detailLevel,
        language,
        userApiKey,
      },
    });
    if (error) throw error;
    if (!data?.content) throw new Error("No content returned");
    return data.content as string;
  };

  const startEdit = () => {
    if (!topic) return;
    setDraftName(topic.topicName);
    setDraftContent(topic.content);
    setGenDetail(String(notes.detailLevel || "2"));
    setGenLang(notes.language || "English");
    setEditing(true);
  };

  const generateForEdit = async () => {
    if (!draftName.trim()) { toast.error("Enter a topic name first"); return; }
    setGenerating(true);
    try {
      const content = await callAI(draftName.trim(), unit?.unitName || "", genDetail, genLang);
      setDraftContent(content);
      toast.success("Content generated");
    } catch (e) {
      console.error(e);
      toast.error(e instanceof Error ? e.message : "Generation failed");
    } finally {
      setGenerating(false);
    }
  };

  const saveEdit = async () => {
    if (!draftName.trim()) { toast.error("Topic name cannot be empty"); return; }
    const next: GeneratedNotes = {
      ...notes,
      units: notes.units.map((u, ui) =>
        ui !== activeUnit ? u : {
          ...u,
          topics: u.topics.map((t, ti) =>
            ti !== activeTopic ? t : { topicName: draftName.trim(), content: draftContent }
          ),
        }
      ),
    };
    await persist(next);
    setEditing(false);
    toast.success("Topic updated");
  };

  const openAddDialog = (unitIdx: number) => {
    setAddUnitIdx(unitIdx);
    setNewName("");
    setGenDetail(String(notes.detailLevel || "2"));
    setGenLang(notes.language || "English");
    setAddOpen(true);
  };

  const openAddUnitDialog = () => {
    const nextNum = String(notes.units.length + 1);
    setNewUnitNumber(nextNum);
    setNewUnitName("");
    setNewUnitTopic("");
    setGenDetail(String(notes.detailLevel || "2"));
    setGenLang(notes.language || "English");
    setUnitOpen(true);
  };

  /** Split a textarea value into a list of topic names. */
  const parseNames = (raw: string): string[] =>
    raw
      .split(/\r?\n|,/)
      .map((s) => s.replace(/^[-*•\d.)\s]+/, "").trim())
      .filter(Boolean);

  /** Generate content for many topics with a small concurrency limit. */
  const generateMany = async (
    names: string[],
    unitName: string,
    detailLevel: string,
    language: string
  ): Promise<{ topicName: string; content: string }[]> => {
    const results: { topicName: string; content: string }[] = names.map((n) => ({ topicName: n, content: "" }));
    let done = 0;
    let failures = 0;
    setProgress({ done: 0, total: names.length });

    const queue = names.map((n, i) => ({ n, i }));
    const worker = async () => {
      for (;;) {
        const job = queue.shift();
        if (!job) return;
        try {
          results[job.i].content = await callAI(job.n, unitName, detailLevel, language);
        } catch (e) {
          console.error("generate failed for", job.n, e);
          failures++;
        }
        done++;
        setProgress({ done, total: names.length });
      }
    };
    await Promise.all(Array.from({ length: Math.min(3, names.length) }, worker));
    setProgress(null);
    if (failures) toast.error(`${failures} of ${names.length} topics could not be generated — added as empty`);
    return results;
  };

  const addUnit = async (opts?: { withAI?: boolean; topicsOnly?: boolean }) => {
    if (!newUnitName.trim()) { toast.error("Enter a unit name"); return; }
    const num = newUnitNumber.trim() || String(notes.units.length + 1);
    const unitName = newUnitName.trim();
    const names = parseNames(newUnitTopic);

    let topics = (names.length ? names : ["Introduction"]).map((n) => ({ topicName: n, content: "" }));

    if (opts?.withAI) {
      if (!names.length) { toast.error("Enter at least one topic name to generate"); return; }
      setGenerating(true);
      try {
        topics = await generateMany(names, unitName, genDetail, genLang);
      } finally {
        setGenerating(false);
      }
    }

    const next: GeneratedNotes = {
      ...notes,
      units: [...notes.units, { unitNumber: num, unitName, topics }],
    };
    await persist(next);
    setUnitOpen(false);
    setActiveUnit(next.units.length - 1);
    setActiveTopic(0);
    toast.success(`Unit added with ${topics.length} topic${topics.length > 1 ? "s" : ""}`);
  };

  const insertTopics = async (unitIdx: number, list: { topicName: string; content: string }[]) => {
    const next: GeneratedNotes = {
      ...notes,
      units: notes.units.map((u, ui) =>
        ui !== unitIdx ? u : { ...u, topics: [...u.topics, ...list] }
      ),
    };
    await persist(next);
    setActiveUnit(unitIdx);
    setActiveTopic(Math.max(0, next.units[unitIdx].topics.length - list.length));
    setAddOpen(false);
  };

  const addTopicWithAI = async () => {
    const names = parseNames(newName);
    if (!names.length) { toast.error("Enter at least one topic name"); return; }
    setGenerating(true);
    try {
      const targetUnit = notes.units[addUnitIdx];
      const list = await generateMany(names, targetUnit?.unitName || "", genDetail, genLang);
      await insertTopics(addUnitIdx, list);
      toast.success(`${list.length} topic${list.length > 1 ? "s" : ""} added with AI content`);
    } catch (e) {
      console.error(e);
      toast.error(e instanceof Error ? e.message : "Generation failed");
    } finally {
      setGenerating(false);
    }
  };

  const addTopicEmpty = async () => {
    const names = parseNames(newName);
    if (!names.length) { toast.error("Enter at least one topic name"); return; }
    await insertTopics(addUnitIdx, names.map((n) => ({ topicName: n, content: "" })));
    toast.success(`${names.length} topic${names.length > 1 ? "s" : ""} added`);
  };

  // ---------- Import (docx / md / json / pdf) ----------
  const openImport = (mode: "units" | "topics", unitIdx?: number) => {
    setImportMode(mode);
    if (typeof unitIdx === "number") setAddUnitIdx(unitIdx);
    setImportUnits([]);
    setImportSkipped(new Set());
    setImportRegen(false);
    setImportOpen(true);
  };

  const handleImportFile = async (file: File) => {
    setImporting(true);
    try {
      const parsed = await parseImportFile(file);
      if (!parsed.units.length) throw new Error("No topics detected in this file");
      setImportUnits(parsed.units);
      toast.success(`Detected ${parsed.units.length} unit(s), ${parsed.units.reduce((a, u) => a + u.topics.length, 0)} topic(s)`);
    } catch (e) {
      console.error(e);
      toast.error(e instanceof Error ? e.message : "Could not read this file");
    } finally {
      setImporting(false);
      if (importInputRef.current) importInputRef.current.value = "";
    }
  };

  const toggleSkip = (key: string) => {
    setImportSkipped((prev) => {
      const n = new Set(prev);
      n.has(key) ? n.delete(key) : n.add(key);
      return n;
    });
  };

  const confirmImport = async () => {
    const selected: NoteUnit[] = importUnits
      .map((u, ui) => ({
        ...u,
        topics: u.topics.filter((_, ti) => !importSkipped.has(`${ui}:${ti}`)),
      }))
      .filter((u) => u.topics.length > 0 && !importSkipped.has(`${importUnits.indexOf(u)}:unit`));

    const chosen = importUnits
      .map((u, ui) => ({ u, ui }))
      .filter(({ ui }) => !importSkipped.has(`${ui}:unit`))
      .map(({ u, ui }) => ({
        ...u,
        topics: u.topics.filter((_, ti) => !importSkipped.has(`${ui}:${ti}`)),
      }))
      .filter((u) => u.topics.length > 0);

    const units = chosen.length ? chosen : selected;
    if (!units.length) { toast.error("Nothing selected to import"); return; }

    setImporting(true);
    try {
      // Optionally generate content for topics with no body
      let prepared = units;
      if (importRegen) {
        setGenerating(true);
        prepared = [];
        for (const u of units) {
          const empties = u.topics.filter((t) => !t.content.trim()).map((t) => t.topicName);
          const generated = empties.length ? await generateMany(empties, u.unitName, genDetail, genLang) : [];
          const map = new Map(generated.map((g) => [g.topicName, g.content]));
          prepared.push({
            ...u,
            topics: u.topics.map((t) => (t.content.trim() ? t : { ...t, content: map.get(t.topicName) || "" })),
          });
        }
        setGenerating(false);
      }

      let next: GeneratedNotes;
      if (importMode === "topics") {
        const flat = prepared.flatMap((u) => u.topics);
        next = {
          ...notes,
          units: notes.units.map((u, ui) => (ui !== addUnitIdx ? u : { ...u, topics: [...u.topics, ...flat] })),
        };
        setActiveUnit(addUnitIdx);
      } else {
        const base = notes.units.length;
        next = {
          ...notes,
          units: [
            ...notes.units,
            ...prepared.map((u, i) => ({
              unitNumber: u.unitNumber || String(base + i + 1),
              unitName: u.unitName || `Unit ${base + i + 1}`,
              topics: u.topics,
            })),
          ],
        };
        setActiveUnit(base);
      }
      setActiveTopic(0);
      await persist(next);
      setImportOpen(false);
      toast.success("Imported successfully");
    } catch (e) {
      console.error(e);
      toast.error(e instanceof Error ? e.message : "Import failed");
    } finally {
      setImporting(false);
      setGenerating(false);
    }
  };



  const deleteTopic = async () => {
    if (!unit || unit.topics.length <= 1) { toast.error("Unit must have at least one topic"); return; }
    if (!window.confirm(`Delete topic "${topic?.topicName}"?`)) return;
    const next: GeneratedNotes = {
      ...notes,
      units: notes.units.map((u, ui) =>
        ui !== activeUnit ? u : { ...u, topics: u.topics.filter((_, ti) => ti !== activeTopic) }
      ),
    };
    await persist(next);
    setActiveTopic(Math.max(0, activeTopic - 1));
    toast.success("Topic deleted");
  };

  const runExport = async (fn: () => void | Promise<void>, label: string) => {
    try { await fn(); toast.success(`${label} downloaded`); }
    catch (e) { console.error(e); toast.error(`${label} export failed`); }
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="w-full max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between mb-6 gap-4 flex-wrap">
        <div>
          <Button variant="ghost" size="sm" onClick={onReset} className="text-muted-foreground mb-2">
            <ArrowLeft className="h-4 w-4 mr-1" /> Back
          </Button>
          <h1 className="text-3xl md:text-4xl font-heading text-foreground">{notes.subject}</h1>
          {notes.course && (
            <p className="text-muted-foreground mt-1 flex items-center gap-2">
              <GraduationCap className="h-4 w-4" /> {notes.course}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="gap-1.5">
                <Download className="h-3.5 w-3.5" /> Export All
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => runExport(() => exportPDF(notes), "PDF")}>Export as PDF</DropdownMenuItem>
              <DropdownMenuItem onClick={() => runExport(() => exportDOCX(notes), "Word")}>Export as Word (.docx)</DropdownMenuItem>
              <DropdownMenuItem onClick={() => runExport(() => exportMarkdown(notes), "Markdown")}>Export as Markdown</DropdownMenuItem>
              <DropdownMenuItem onClick={() => runExport(() => exportJSON(notes), "JSON")}>Export as JSON</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <span className="px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-medium">{notes.language}</span>
          <span className="px-3 py-1 rounded-full bg-accent/10 text-accent-foreground text-xs font-medium">Level {notes.detailLevel}</span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-[260px_1fr] gap-6">
        {/* Sidebar */}
        <nav className="rounded-lg bg-card border border-border p-4 space-y-3 h-fit md:sticky md:top-6">
          <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-2">Units</h3>
          {notes.units.map((u, ui) => (
            <div key={ui}>
              <button
                onClick={() => { setActiveUnit(ui); setActiveTopic(0); setEditing(false); }}
                className={`w-full text-left px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                  activeUnit === ui ? "bg-primary/10 text-primary" : "text-foreground hover:bg-muted"
                }`}
              >
                <span className="text-xs text-muted-foreground mr-2">U{u.unitNumber}</span>
                {u.unitName}
              </button>
              <AnimatePresence>
                {activeUnit === ui && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden ml-4 mt-1 space-y-0.5"
                  >
                    {u.topics.map((t, ti) => (
                      <button
                        key={ti}
                        onClick={() => { setActiveTopic(ti); setEditing(false); }}
                        className={`w-full text-left px-3 py-1.5 rounded text-xs transition-colors flex items-center gap-1 ${
                          activeTopic === ti && activeUnit === ui
                            ? "text-primary font-medium"
                            : "text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        <ChevronRight className="h-3 w-3 flex-shrink-0" />
                        <span className="line-clamp-1">{t.topicName}</span>
                      </button>
                    ))}
                    <button
                      onClick={() => openAddDialog(ui)}
                      className="w-full text-left px-3 py-1.5 rounded text-xs text-primary/80 hover:text-primary hover:bg-primary/5 transition-colors flex items-center gap-1 mt-1"
                    >
                      <Plus className="h-3 w-3" /> Add topic
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ))}
          <button
            onClick={openAddUnitDialog}
            className="w-full text-left px-3 py-2 rounded-md text-sm font-medium text-primary/90 hover:text-primary hover:bg-primary/5 transition-colors flex items-center gap-1.5 border border-dashed border-primary/30 mt-2"
          >
            <FolderPlus className="h-3.5 w-3.5" /> Add Unit
          </button>
        </nav>

        {/* Content */}
        <AnimatePresence mode="wait">
          <motion.article
            key={`${activeUnit}-${activeTopic}-${editing ? "e" : "v"}`}
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -10 }}
            transition={{ duration: 0.2 }}
            className="rounded-lg bg-card border border-border p-6 md:p-8"
          >
            <div className="flex items-start justify-between gap-4 mb-4">
              <div className="flex items-start gap-3 flex-1 min-w-0">
                <div className="rounded-full bg-primary/10 p-2 mt-1 shrink-0">
                  <BookOpen className="h-5 w-5 text-primary" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-muted-foreground">
                    Unit {unit?.unitNumber} — {unit?.unitName}
                  </p>
                  {editing ? (
                    <Input
                      value={draftName}
                      onChange={(e) => setDraftName(e.target.value)}
                      className="mt-1 font-heading text-xl md:text-2xl h-auto py-1.5"
                      placeholder="Topic name"
                    />
                  ) : (
                    <h2 className="text-2xl font-heading text-foreground mt-1 break-words">
                      {topic?.topicName}
                    </h2>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-1 shrink-0">
                {!editing && topic && (
                  <>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm" className="gap-1.5" title="Export this topic">
                          <Download className="h-3.5 w-3.5" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => runExport(() => exportTopicPDF(notes.subject, unit, topic), "Topic PDF")}>Topic as PDF</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => runExport(() => exportTopicDOCX(notes.subject, unit, topic), "Topic Word")}>Topic as Word</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => runExport(() => exportTopicMarkdown(notes.subject, unit, topic), "Topic Markdown")}>Topic as Markdown</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => runExport(() => exportTopicJSON(notes.subject, unit, topic), "Topic JSON")}>Topic as JSON</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                    <Button variant="ghost" size="sm" onClick={startEdit} title="Edit topic">
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={deleteTopic} title="Delete topic" className="text-destructive hover:text-destructive">
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </>
                )}
                {editing && (
                  <>
                    <Button size="sm" onClick={saveEdit} disabled={saving || generating} className="gap-1.5">
                      <Save className="h-3.5 w-3.5" /> {saving ? "Saving…" : "Save"}
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => setEditing(false)} disabled={saving || generating}>
                      <X className="h-4 w-4" />
                    </Button>
                  </>
                )}
              </div>
            </div>

            {editing ? (
              <div className="space-y-3">
                <div className="flex flex-wrap items-end gap-3 p-3 rounded-md bg-muted/40 border border-border/60">
                  <div className="space-y-1">
                    <Label className="text-xs">Detail Level</Label>
                    <Select value={genDetail} onValueChange={setGenDetail}>
                      <SelectTrigger className="w-[180px] h-9"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {Object.entries(DETAIL_LABELS).map(([v, l]) => (
                          <SelectItem key={v} value={v}>Level {v} — {l}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Language</Label>
                    <Select value={genLang} onValueChange={setGenLang}>
                      <SelectTrigger className="w-[150px] h-9"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="English">English</SelectItem>
                        <SelectItem value="Hinglish">Hinglish</SelectItem>
                        <SelectItem value="Hindi">Hindi</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <Button size="sm" variant="secondary" onClick={generateForEdit} disabled={generating} className="gap-1.5">
                    {generating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                    {generating ? "Generating…" : "Generate with AI"}
                  </Button>
                </div>
                <Textarea
                  value={draftContent}
                  onChange={(e) => setDraftContent(e.target.value)}
                  placeholder="Write topic content (Markdown supported) or click Generate with AI…"
                  className="min-h-[400px] font-mono leading-relaxed text-sm"
                />
                <p className="text-xs text-muted-foreground">
                  Markdown supported: **bold**, *italic*, # heading, - list, `code`, tables, etc.
                </p>
              </div>
            ) : (
              <>
                {topic?.content ? (
                  <>
                    <ReadAloud
                      containerRef={contentRef}
                      sentences={sentences}
                      language={notes.language || "English"}
                    />
                    <MarkdownContent
                      ref={contentRef}
                      markdown={topic.content}
                      onSentences={setSentences}
                    />
                  </>
                ) : (
                  <p className="text-muted-foreground italic">No content yet. Click edit to add.</p>
                )}
              </>
            )}

            {/* Navigation */}
            {!editing && (
              <div className="flex justify-between mt-8 pt-4 border-t border-border">
                <Button
                  variant="ghost" size="sm"
                  disabled={activeTopic === 0 && activeUnit === 0}
                  onClick={() => {
                    if (activeTopic > 0) setActiveTopic(activeTopic - 1);
                    else if (activeUnit > 0) {
                      setActiveUnit(activeUnit - 1);
                      setActiveTopic(notes.units[activeUnit - 1].topics.length - 1);
                    }
                  }}
                >
                  ← Previous
                </Button>
                <Button
                  variant="ghost" size="sm"
                  disabled={activeUnit === notes.units.length - 1 && activeTopic === (unit?.topics.length ?? 1) - 1}
                  onClick={() => {
                    if (activeTopic < (unit?.topics.length ?? 1) - 1) setActiveTopic(activeTopic + 1);
                    else if (activeUnit < notes.units.length - 1) {
                      setActiveUnit(activeUnit + 1);
                      setActiveTopic(0);
                    }
                  }}
                >
                  Next →
                </Button>
              </div>
            )}
          </motion.article>
        </AnimatePresence>
      </div>

      {/* Add Topic Dialog (multiple) */}
      <Dialog open={addOpen} onOpenChange={(o) => !generating && setAddOpen(o)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add topics</DialogTitle>
            <DialogDescription>
              Adding to Unit {notes.units[addUnitIdx]?.unitNumber} — {notes.units[addUnitIdx]?.unitName}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Topic names — one per line</Label>
              <Textarea
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                rows={5}
                placeholder={"Dependency Injection\nBean Lifecycle\nSpring Boot Starters"}
                autoFocus
              />
              <p className="text-xs text-muted-foreground">
                {parseNames(newName).length} topic(s) detected — all will be generated together.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Detail Level</Label>
                <Select value={genDetail} onValueChange={setGenDetail}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(DETAIL_LABELS).map(([v, l]) => (
                      <SelectItem key={v} value={v}>Level {v} — {l}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Language</Label>
                <Select value={genLang} onValueChange={setGenLang}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="English">English</SelectItem>
                    <SelectItem value="Hinglish">Hinglish</SelectItem>
                    <SelectItem value="Hindi">Hindi</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            {progress && (
              <p className="text-sm text-primary">Generating {progress.done}/{progress.total}…</p>
            )}
          </div>
          <DialogFooter className="gap-2 sm:gap-2">
            <Button variant="ghost" onClick={() => openImport("topics", addUnitIdx)} disabled={generating} className="gap-1.5">
              <Upload className="h-4 w-4" /> Import file
            </Button>
            <Button variant="secondary" onClick={addTopicEmpty} disabled={generating}>Add empty</Button>
            <Button onClick={addTopicWithAI} disabled={generating} className="gap-1.5">
              {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              {generating ? "Generating…" : "Generate with AI"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Unit Dialog (multiple topics) */}
      <Dialog open={unitOpen} onOpenChange={(o) => !generating && setUnitOpen(o)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add new unit</DialogTitle>
            <DialogDescription>Create a unit with multiple topics, optionally generated by AI.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-[100px_1fr] gap-3">
              <div className="space-y-1.5">
                <Label>Number</Label>
                <Input value={newUnitNumber} onChange={(e) => setNewUnitNumber(e.target.value)} placeholder="e.g. 5" />
              </div>
              <div className="space-y-1.5">
                <Label>Unit name</Label>
                <Input value={newUnitName} onChange={(e) => setNewUnitName(e.target.value)} placeholder="e.g. Advanced Topics" autoFocus />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Topics — one per line</Label>
              <Textarea
                value={newUnitTopic}
                onChange={(e) => setNewUnitTopic(e.target.value)}
                rows={5}
                placeholder={"Reactive Streams\nBackpressure\nWebFlux basics"}
              />
              <p className="text-xs text-muted-foreground">{parseNames(newUnitTopic).length} topic(s) detected.</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Detail Level</Label>
                <Select value={genDetail} onValueChange={setGenDetail}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(DETAIL_LABELS).map(([v, l]) => (
                      <SelectItem key={v} value={v}>Level {v} — {l}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Language</Label>
                <Select value={genLang} onValueChange={setGenLang}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="English">English</SelectItem>
                    <SelectItem value="Hinglish">Hinglish</SelectItem>
                    <SelectItem value="Hindi">Hindi</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            {progress && (
              <p className="text-sm text-primary">Generating {progress.done}/{progress.total}…</p>
            )}
          </div>
          <DialogFooter className="gap-2 sm:gap-2">
            <Button variant="ghost" onClick={() => openImport("units")} disabled={generating} className="gap-1.5">
              <Upload className="h-4 w-4" /> Import file
            </Button>
            <Button variant="secondary" onClick={() => addUnit()} disabled={generating} className="gap-1.5">
              <FolderPlus className="h-4 w-4" /> Add Unit
            </Button>
            <Button onClick={() => addUnit({ withAI: true })} disabled={generating} className="gap-1.5">
              {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              {generating ? "Generating…" : "Add + Generate topics"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Import Dialog */}
      <Dialog open={importOpen} onOpenChange={(o) => !importing && !generating && setImportOpen(o)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Import {importMode === "units" ? "units & topics" : "topics"}</DialogTitle>
            <DialogDescription>
              Supported files: Word (.docx), Markdown (.md), text (.txt), JSON (.json), PDF (.pdf)
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <input
              ref={importInputRef}
              type="file"
              accept=".docx,.md,.txt,.json,.pdf"
              className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) handleImportFile(f); }}
            />
            <Button variant="outline" onClick={() => importInputRef.current?.click()} disabled={importing} className="w-full gap-2">
              {importing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              {importing ? "Reading file…" : "Choose file"}
            </Button>

            {importUnits.length > 0 && (
              <div className="max-h-64 overflow-y-auto rounded-md border border-border p-3 space-y-3">
                {importUnits.map((u, ui) => (
                  <div key={ui} className="space-y-1.5">
                    <label className="flex items-center gap-2 text-sm font-medium">
                      <Checkbox
                        checked={!importSkipped.has(`${ui}:unit`)}
                        onCheckedChange={() => toggleSkip(`${ui}:unit`)}
                      />
                      Unit {u.unitNumber} — {u.unitName}
                    </label>
                    <div className="pl-6 space-y-1">
                      {u.topics.map((t, ti) => (
                        <label key={ti} className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Checkbox
                            checked={!importSkipped.has(`${ui}:${ti}`)}
                            onCheckedChange={() => toggleSkip(`${ui}:${ti}`)}
                          />
                          <span className="truncate">{t.topicName}</span>
                          {!t.content.trim() && <span className="text-xs text-amber-600">(no content)</span>}
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {importUnits.length > 0 && (
              <label className="flex items-start gap-2 text-sm">
                <Checkbox checked={importRegen} onCheckedChange={(v) => setImportRegen(!!v)} />
                <span>Generate AI notes for topics that have no content (uses the Detail Level & Language above)</span>
              </label>
            )}

            {progress && <p className="text-sm text-primary">Generating {progress.done}/{progress.total}…</p>}
          </div>

          <DialogFooter className="gap-2 sm:gap-2">
            <Button variant="ghost" onClick={() => setImportOpen(false)} disabled={importing || generating}>Cancel</Button>
            <Button onClick={confirmImport} disabled={importing || generating || !importUnits.length} className="gap-1.5">
              {(importing || generating) ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              Import
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </motion.div>
  );
}
