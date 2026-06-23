import { useEffect, useState } from "react";
import { RequirePlatformAdmin } from "@/components/admin/RequirePlatformAdmin";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ShieldCheck } from "lucide-react";

interface TenantRow {
  id: string;
  slug: string;
  nome: string | null;
  piano: string | null;
  attivo: boolean | null;
  created_at: string;
  colore_primario: string | null;
}

function TenantList() {
  const [tenants, setTenants] = useState<TenantRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    supabase
      .from("tenants")
      .select("id, slug, nome, piano, attivo, created_at, colore_primario")
      .order("created_at", { ascending: false })
      .then(({ data, error: err }) => {
        if (err) {
          console.error("[AdminConsole] tenants fetch error:", err);
          setError(err.message);
        } else {
          setTenants((data ?? []) as unknown as TenantRow[]);
        }
      });
  }, []);

  if (!tenants && !error) {
    return (
      <div className="space-y-2">
        {[...Array(3)].map((_, i) => (
          <Skeleton key={i} className="h-14 w-full rounded-lg" />
        ))}
      </div>
    );
  }

  if (error) {
    return <p className="text-sm text-destructive">Errore caricamento tenant: {error}</p>;
  }

  if (!tenants || tenants.length === 0) {
    return <p className="text-sm text-muted-foreground">Nessun tenant registrato.</p>;
  }

  return (
    <div className="divide-y divide-border rounded-lg border border-border overflow-hidden">
      {tenants.map((t) => (
        <div
          key={t.id}
          className="flex items-center gap-4 px-4 py-3 bg-background hover:bg-muted/40 transition-colors"
        >
          <div
            className="w-2.5 h-2.5 rounded-full shrink-0"
            style={{ backgroundColor: t.colore_primario ?? "#94a3b8" }}
          />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-foreground truncate">
              {t.nome ?? t.slug}
            </p>
            <p className="text-xs text-muted-foreground font-mono">{t.slug}</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {t.piano && (
              <Badge variant="outline" className="text-[11px] capitalize">
                {t.piano}
              </Badge>
            )}
            <Badge
              variant={t.attivo ? "default" : "secondary"}
              className="text-[11px]"
            >
              {t.attivo ? "attivo" : "sospeso"}
            </Badge>
            <span className="text-[11px] text-muted-foreground hidden sm:block tabular-nums">
              {new Date(t.created_at).toLocaleDateString("it-IT")}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}

export default function AdminConsole() {
  return (
    <RequirePlatformAdmin>
      <div className="min-h-screen bg-muted/30">
        <header className="bg-background border-b border-border px-6 py-4">
          <div className="container mx-auto max-w-4xl flex items-center gap-3">
            <ShieldCheck className="w-5 h-5 text-primary shrink-0" />
            <div>
              <h1 className="text-base font-semibold text-foreground leading-tight">
                Console Admin — Risparmetro
              </h1>
              <p className="text-xs text-muted-foreground">Solo platform_admin</p>
            </div>
          </div>
        </header>

        <main className="container mx-auto max-w-4xl px-4 sm:px-6 py-8 space-y-6">
          <section>
            <h2 className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground mb-3">
              Tenant registrati
            </h2>
            <TenantList />
          </section>
        </main>
      </div>
    </RequirePlatformAdmin>
  );
}
