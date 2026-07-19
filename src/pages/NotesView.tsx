import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import NotesViewer from "@/components/NotesViewer";
import AppHeader from "@/components/AppHeader";
import type { GeneratedNotes } from "@/types/notes";

export default function NotesView() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [notes, setNotes] = useState<GeneratedNotes | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    supabase
      .from("notes_history")
      .select("notes, subject")
      .eq("id", id)
      .maybeSingle()
      .then(({ data, error }) => {
        if (error) toast.error(error.message);
        else if (data) {
          setNotes(data.notes as unknown as GeneratedNotes);
          document.title = `${data.subject} — Notes`;
        }
        setLoading(false);
      });
  }, [id]);

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />
      <main className="px-4 py-8">
        {loading ? (
          <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
        ) : notes ? (
          <NotesViewer notes={notes} onReset={() => navigate("/history")} />
        ) : (
          <p className="text-center text-muted-foreground py-16">Notes not found.</p>
        )}
      </main>
    </div>
  );
}
