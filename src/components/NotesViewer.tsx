import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { BookOpen, ChevronRight, ArrowLeft, GraduationCap, Download } from "lucide-react";
import { toast } from "sonner";
import type { GeneratedNotes } from "@/types/notes";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { exportPDF, exportDOCX, exportMarkdown, exportJSON } from "@/lib/exportNotes";

interface Props {
  notes: GeneratedNotes;
  onReset: () => void;
}


export default function NotesViewer({ notes, onReset }: Props) {
  const [activeUnit, setActiveUnit] = useState(0);
  const [activeTopic, setActiveTopic] = useState(0);

  const unit = notes.units[activeUnit];
  const topic = unit?.topics[activeTopic];

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="w-full max-w-5xl mx-auto"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <Button variant="ghost" size="sm" onClick={onReset} className="text-muted-foreground mb-2">
            <ArrowLeft className="h-4 w-4 mr-1" /> New Syllabus
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
                <Download className="h-3.5 w-3.5" /> Export
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                onClick={async () => {
                  try { await exportPDF(notes); toast.success("PDF downloaded"); }
                  catch (e) { toast.error("PDF export failed"); console.error(e); }
                }}
              >
                Export as PDF
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={async () => {
                  try { await exportDOCX(notes); toast.success("Word document downloaded"); }
                  catch (e) { toast.error("DOCX export failed"); console.error(e); }
                }}
              >
                Export as Word (.docx)
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => { exportMarkdown(notes); toast.success("Markdown downloaded"); }}>
                Export as Markdown
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => { exportJSON(notes); toast.success("JSON downloaded"); }}>
                Export as JSON
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <span className="px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-medium">
            {notes.language}
          </span>
          <span className="px-3 py-1 rounded-full bg-accent/10 text-accent-foreground text-xs font-medium">
            Level {notes.detailLevel}
          </span>
        </div>

      </div>

      <div className="grid grid-cols-1 md:grid-cols-[260px_1fr] gap-6">
        {/* Sidebar – Units & Topics */}
        <nav className="rounded-lg bg-card border border-border p-4 space-y-3 h-fit md:sticky md:top-6">
          <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-2">Units</h3>
          {notes.units.map((u, ui) => (
            <div key={ui}>
              <button
                onClick={() => {
                  setActiveUnit(ui);
                  setActiveTopic(0);
                }}
                className={`w-full text-left px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                  activeUnit === ui
                    ? "bg-primary/10 text-primary"
                    : "text-foreground hover:bg-muted"
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
                        onClick={() => setActiveTopic(ti)}
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
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ))}
        </nav>

        {/* Content */}
        <AnimatePresence mode="wait">
          <motion.article
            key={`${activeUnit}-${activeTopic}`}
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -10 }}
            transition={{ duration: 0.25 }}
            className="rounded-lg bg-card border border-border p-6 md:p-8"
          >
            <div className="flex items-start gap-3 mb-4">
              <div className="rounded-full bg-primary/10 p-2 mt-1">
                <BookOpen className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">
                  Unit {unit?.unitNumber} — {unit?.unitName}
                </p>
                <h2 className="text-2xl font-heading text-foreground mt-1">
                  {topic?.topicName}
                </h2>
              </div>
            </div>
            <div className="prose prose-sm max-w-none text-foreground/90 leading-relaxed font-body whitespace-pre-line">
              {topic?.content}
            </div>

            {/* Navigation */}
            <div className="flex justify-between mt-8 pt-4 border-t border-border">
              <Button
                variant="ghost"
                size="sm"
                disabled={activeTopic === 0 && activeUnit === 0}
                onClick={() => {
                  if (activeTopic > 0) {
                    setActiveTopic(activeTopic - 1);
                  } else if (activeUnit > 0) {
                    setActiveUnit(activeUnit - 1);
                    setActiveTopic(notes.units[activeUnit - 1].topics.length - 1);
                  }
                }}
              >
                ← Previous
              </Button>
              <Button
                variant="ghost"
                size="sm"
                disabled={
                  activeUnit === notes.units.length - 1 &&
                  activeTopic === (unit?.topics.length ?? 1) - 1
                }
                onClick={() => {
                  if (activeTopic < (unit?.topics.length ?? 1) - 1) {
                    setActiveTopic(activeTopic + 1);
                  } else if (activeUnit < notes.units.length - 1) {
                    setActiveUnit(activeUnit + 1);
                    setActiveTopic(0);
                  }
                }}
              >
                Next →
              </Button>
            </div>
          </motion.article>
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
