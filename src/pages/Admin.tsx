import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Loader2, Search, ShieldCheck, Users } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import AppHeader from "@/components/AppHeader";
import { Input } from "@/components/ui/input";

interface Row {
  id: string;
  email: string | null;
  display_name: string | null;
  created_at: string;
  notesCount: number;
  isAdmin: boolean;
}

export default function Admin() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");

  useEffect(() => {
    document.title = "Admin — All users";
    (async () => {
      const [{ data: profiles, error }, { data: notes }, { data: roles }] = await Promise.all([
        supabase.from("profiles").select("id, email, display_name, created_at").order("created_at", { ascending: false }),
        supabase.from("notes_history").select("id, user_id"),
        supabase.from("user_roles").select("user_id, role"),
      ]);
      if (error) toast.error(error.message);
      const counts = new Map<string, number>();
      (notes || []).forEach((n) => counts.set(n.user_id, (counts.get(n.user_id) || 0) + 1));
      const admins = new Set((roles || []).filter((r) => r.role === "admin").map((r) => r.user_id));
      setRows(
        (profiles || []).map((p) => ({
          ...p,
          notesCount: counts.get(p.id) || 0,
          isAdmin: admins.has(p.id),
        }))
      );
      setLoading(false);
    })();
  }, []);

  const filtered = rows.filter((r) => {
    const s = q.trim().toLowerCase();
    if (!s) return true;
    return (r.email || "").toLowerCase().includes(s) || (r.display_name || "").toLowerCase().includes(s);
  });

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />
      <main className="max-w-5xl mx-auto px-4 py-8">
        <div className="flex items-center gap-2 mb-1">
          <ShieldCheck className="h-5 w-5 text-primary" />
          <h1 className="text-3xl font-heading text-foreground">Admin panel</h1>
        </div>
        <p className="text-muted-foreground text-sm mb-6">All users and their generated notes</p>

        <div className="relative mb-4 max-w-sm">
          <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by email or name" className="pl-9" />
        </div>

        {loading ? (
          <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 rounded-lg border border-dashed border-border">
            <Users className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground">No users found.</p>
          </div>
        ) : (
          <div className="grid gap-3">
            {filtered.map((r) => (
              <Link
                key={r.id}
                to={`/admin/users/${r.id}`}
                className="rounded-lg border border-border bg-card p-4 hover:border-primary/40 transition-colors flex items-center justify-between gap-4"
              >
                <div className="min-w-0">
                  <p className="font-medium text-foreground truncate">
                    {r.display_name || "Unnamed"}
                    {r.isAdmin && <span className="ml-2 text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary">admin</span>}
                  </p>
                  <p className="text-sm text-muted-foreground truncate">{r.email}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm text-foreground">{r.notesCount} notes</p>
                  <p className="text-xs text-muted-foreground">joined {new Date(r.created_at).toLocaleDateString()}</p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
