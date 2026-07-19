import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { BookOpen, Trash2, Loader2, Plus, Clock } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import AppHeader from "@/components/AppHeader";

interface HistoryRow {
  id: string;
  subject: string;
  course: string | null;
  language: string;
  detail_level: string;
  created_at: string;
}

export default function History() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [rows, setRows] = useState<HistoryRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    document.title = "My Notes History";
    if (!user) return;
    supabase
      .from("notes_history")
      .select("id, subject, course, language, detail_level, created_at")
      .order("created_at", { ascending: false })
      .then(({ data, error }) => {
        if (error) toast.error(error.message);
        else setRows(data || []);
        setLoading(false);
      });
  }, [user]);

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("notes_history").delete().eq("id", id);
    if (error) return toast.error(error.message);
    setRows((r) => r.filter((x) => x.id !== id));
    toast.success("Deleted");
  };

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />
      <main className="max-w-4xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-heading text-foreground">My History</h1>
            <p className="text-muted-foreground text-sm mt-1">All notes you've generated</p>
          </div>
          <Button onClick={() => navigate("/")}>
            <Plus className="h-4 w-4 mr-1" /> New notes
          </Button>
        </div>

        {loading ? (
          <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
        ) : rows.length === 0 ? (
          <div className="text-center py-16 rounded-lg border border-dashed border-border">
            <BookOpen className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground">No notes yet. Generate your first set!</p>
            <Button onClick={() => navigate("/")} className="mt-4">Get started</Button>
          </div>
        ) : (
          <div className="grid gap-3">
            {rows.map((r, i) => (
              <motion.div
                key={r.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.03 }}
                className="group rounded-lg border border-border bg-card p-4 hover:border-primary/40 transition-colors flex items-center gap-4"
              >
                <Link to={`/notes/${r.id}`} className="flex-1 min-w-0">
                  <h3 className="font-heading text-lg text-foreground truncate">{r.subject}</h3>
                  {r.course && <p className="text-sm text-muted-foreground truncate">{r.course}</p>}
                  <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                    <span className="px-2 py-0.5 rounded-full bg-primary/10 text-primary">{r.language}</span>
                    <span className="px-2 py-0.5 rounded-full bg-accent/10">Level {r.detail_level}</span>
                    <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{new Date(r.created_at).toLocaleDateString()}</span>
                  </div>
                </Link>
                <Button variant="ghost" size="icon" onClick={() => handleDelete(r.id)} className="opacity-0 group-hover:opacity-100 text-destructive">
                  <Trash2 className="h-4 w-4" />
                </Button>
              </motion.div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
