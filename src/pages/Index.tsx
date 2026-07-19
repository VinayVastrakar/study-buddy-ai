import { useState, useCallback } from "react";
import { motion } from "framer-motion";
import { BookOpen } from "lucide-react";
import { toast } from "sonner";
import SyllabusUploader from "@/components/SyllabusUploader";
import NotesViewer from "@/components/NotesViewer";
import LoadingNotes from "@/components/LoadingNotes";
import ApiKeySettings, { getStoredApiKey } from "@/components/ApiKeySettings";
import AppHeader from "@/components/AppHeader";
import { streamSSE } from "@/lib/parseSSE";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import type { GeneratedNotes, DetailLevel, Language } from "@/types/notes";

const GENERATE_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-notes`;

export default function Index() {
  const { session, user } = useAuth();
  const [notes, setNotes] = useState<GeneratedNotes | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const saveHistory = useCallback(
    async (n: GeneratedNotes, syllabusText: string, detailLevel: DetailLevel, language: Language) => {
      if (!user) return;
      const { error } = await supabase.from("notes_history").insert({
        user_id: user.id,
        subject: n.subject || "Untitled",
        course: n.course || null,
        language,
        detail_level: detailLevel,
        syllabus_text: syllabusText,
        notes: n as unknown as any,
      });
      if (error) toast.error("Could not save to history: " + error.message);
      else toast.success("Saved to your history");
    },
    [user]
  );

  const handleGenerate = useCallback(
    async (syllabusText: string, detailLevel: DetailLevel, language: Language) => {
      setIsLoading(true);
      setNotes(null);

      try {
        const resp = await fetch(GENERATE_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session?.access_token ?? import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({
            syllabusText,
            detailLevel,
            language,
            userApiKey: getStoredApiKey() || undefined,
          }),
        });

        if (resp.status === 429) { toast.error("Rate limit reached. Try again shortly."); setIsLoading(false); return; }
        if (resp.status === 402) { toast.error("AI credits exhausted."); setIsLoading(false); return; }
        if (!resp.ok) {
          const err = await resp.json().catch(() => ({}));
          throw new Error(err.error || "Generation failed");
        }

        let fullText = "";
        await streamSSE({
          response: resp,
          onDelta: (chunk) => { fullText += chunk; },
          onDone: async () => {
            try {
              let cleaned = fullText.trim();
              if (cleaned.startsWith("```")) cleaned = cleaned.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
              const parsed: GeneratedNotes = JSON.parse(cleaned);
              setNotes(parsed);
              await saveHistory(parsed, syllabusText, detailLevel, language);
            } catch (e) {
              console.error("Failed to parse notes JSON:", e, fullText);
              toast.error("Failed to parse generated notes. Please try again.");
            }
            setIsLoading(false);
          },
        });
      } catch (e) {
        console.error(e);
        toast.error(e instanceof Error ? e.message : "Something went wrong");
        setIsLoading(false);
      }
    },
    [session, saveHistory]
  );

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />
      {!notes && !isLoading && (
        <header className="pt-16 pb-8 px-4 text-center">
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/10 text-primary text-sm font-medium mb-6">
            <BookOpen className="h-4 w-4" />
            AI-Powered Study Notes
          </motion.div>
          <motion.h1 initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="text-4xl md:text-6xl font-heading text-foreground leading-tight max-w-3xl mx-auto">
            Turn your syllabus into <span className="text-primary italic">exam-ready</span> notes
          </motion.h1>
          <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }} className="text-muted-foreground mt-4 max-w-lg mx-auto font-body text-lg">
            Upload your syllabus, choose your detail level, and get beautifully structured study material in seconds.
          </motion.p>
        </header>
      )}

      <main className="px-4 pb-16">
        {isLoading && <LoadingNotes />}
        {!notes && !isLoading && (
          <>
            <ApiKeySettings />
            <SyllabusUploader onGenerate={handleGenerate} isLoading={isLoading} />
          </>
        )}
        {notes && <NotesViewer notes={notes} onReset={() => setNotes(null)} />}
      </main>
    </div>
  );
}
