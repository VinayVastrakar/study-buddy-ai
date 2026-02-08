import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Upload, FileText, X, BookOpen, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { DetailLevel, Language } from "@/types/notes";

interface Props {
  onGenerate: (syllabusText: string, detailLevel: DetailLevel, language: Language) => void;
  isLoading: boolean;
}

const DETAIL_LABELS: Record<DetailLevel, { label: string; desc: string }> = {
  "1": { label: "Short Notes", desc: "Quick revision, keywords only" },
  "2": { label: "Exam Ready", desc: "Perfect for 5–8 mark answers" },
  "3": { label: "Deep Explanation", desc: "Detailed 10–15 mark answers" },
  "4": { label: "Teaching Mode", desc: "Beginner-friendly with analogies" },
};

export default function SyllabusUploader({ onGenerate, isLoading }: Props) {
  const [syllabusText, setSyllabusText] = useState("");
  const [detailLevel, setDetailLevel] = useState<DetailLevel>("2");
  const [language, setLanguage] = useState<Language>("English");
  const [fileName, setFileName] = useState<string | null>(null);

  const handleFileUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    const text = await file.text();
    setSyllabusText(text);
  }, []);

  const handleSubmit = () => {
    if (!syllabusText.trim()) return;
    onGenerate(syllabusText, detailLevel, language);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="w-full max-w-2xl mx-auto space-y-6"
    >
      {/* Upload area */}
      <div className="relative">
        <label
          htmlFor="file-upload"
          className="flex flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed border-primary/30 bg-card p-8 cursor-pointer transition-all hover:border-primary/60 hover:bg-primary/5"
        >
          <div className="rounded-full bg-primary/10 p-3">
            <Upload className="h-6 w-6 text-primary" />
          </div>
          <div className="text-center">
            <p className="font-body font-medium text-foreground">
              Upload syllabus file
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              .txt, .md, or paste text below
            </p>
          </div>
          <input
            id="file-upload"
            type="file"
            accept=".txt,.md,.text"
            className="hidden"
            onChange={handleFileUpload}
          />
        </label>
        <AnimatePresence>
          {fileName && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="mt-3 flex items-center gap-2 rounded-md bg-primary/10 px-3 py-2 text-sm"
            >
              <FileText className="h-4 w-4 text-primary" />
              <span className="text-foreground font-medium">{fileName}</span>
              <button
                onClick={() => {
                  setFileName(null);
                  setSyllabusText("");
                }}
                className="ml-auto text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Text area */}
      <Textarea
        placeholder="Or paste your syllabus text here..."
        value={syllabusText}
        onChange={(e) => setSyllabusText(e.target.value)}
        className="min-h-[160px] bg-card border-border font-body text-sm resize-y"
      />

      {/* Parameters */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <label className="text-sm font-medium text-foreground flex items-center gap-2">
            <BookOpen className="h-4 w-4 text-primary" />
            Detail Level
          </label>
          <Select value={detailLevel} onValueChange={(v) => setDetailLevel(v as DetailLevel)}>
            <SelectTrigger className="bg-card">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.entries(DETAIL_LABELS) as [DetailLevel, { label: string; desc: string }][]).map(
                ([key, { label, desc }]) => (
                  <SelectItem key={key} value={key}>
                    <span className="font-medium">{label}</span>
                    <span className="text-muted-foreground ml-2 text-xs">— {desc}</span>
                  </SelectItem>
                )
              )}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-foreground flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            Language
          </label>
          <Select value={language} onValueChange={(v) => setLanguage(v as Language)}>
            <SelectTrigger className="bg-card">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="English">English</SelectItem>
              <SelectItem value="Hinglish">Hinglish</SelectItem>
              <SelectItem value="Hindi">Hindi</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Generate button */}
      <Button
        onClick={handleSubmit}
        disabled={!syllabusText.trim() || isLoading}
        className="w-full h-12 text-base font-medium bg-primary text-primary-foreground hover:bg-primary/90 shadow-[var(--shadow-warm)] transition-all"
        size="lg"
      >
        {isLoading ? (
          <span className="flex items-center gap-2">
            <span className="h-4 w-4 rounded-full border-2 border-primary-foreground/30 border-t-primary-foreground animate-spin" />
            Generating Notes...
          </span>
        ) : (
          <span className="flex items-center gap-2">
            <Sparkles className="h-5 w-5" />
            Generate Notes
          </span>
        )}
      </Button>
    </motion.div>
  );
}
