import { useEffect, useState } from "react";
import { RequirePlatformAdmin } from "@/components/admin/RequirePlatformAdmin";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ShieldCheck, Plus, Loader2, UserPlus, Copy, Check } from "lucide-react";
import { slugify } from "@/lib/admin/slug";
import { toast } from "sonner";

const PIANI = ["free", "starter", "pro", "business"] as const;
type Piano = (typeof PIANI)[number];

const RUOLI = ["owner", "admin", "agent"] as const;
type Ruolo = (typeof RUOLI)[number];

interface TenantRow {
  id: string;
  slug: string;
  nome: string | null;
  piano: string | null;
  attivo: boolean | null;
  created_at: string;
  colore_primario: string | null;
}

function generatePassword(): string {
  const chars = "abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789!@#%&";
  const arr = new Uint8Array(14);
  crypto.getRandomValues(arr);
  return Array.from(arr, (b) => chars[b % chars.length]).join("");
}

// ── NuovoTenantDialog ─────────────────────────────────────────────────────────

interface NuovoTenantDialogProps {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}

function NuovoTenantDialog({ open, onClose, onCreated }: NuovoTenantDialogProps) {
  const [nome, setNome] = useState("");
  const [slug, setSlug] = useState("");
  const [slugManuale, setSlugManuale] = useState(false);
  const [piano, setPiano] = useState<Piano>("free");
  const [colore, setColore] = useState("#4f46e5");
  const [saving, setSaving] = useState(false);
  const [errore, setErrore] = useState<string | null>(null);

  const handleNomeChange = (v: string) => {
    setNome(v);
    if (!slugManuale) setSlug(slugify(v));
  };

  const handleSlugChange = (v: string) => {
    setSlug(v);
    setSlugManuale(true);
  };

  const reset = () => {
    setNome(""); setSlug(""); setSlugManuale(false);
    setPiano("free"); setColore("#4f46e5"); setErrore(null);
  };

  const handleClose = () => { reset(); onClose(); };

  const submit = async () => {
    if (!nome.trim() || !slug.trim()) return;
    setSaving(true);
    setErrore(null);
    const { error } = await supabase
      .from("tenants")
      .insert({ nome: nome.trim(), slug: slug.trim(), piano, colore_primario: colore, attivo: true })
      .select()
      .single();
    setSaving(false);
    if (error) {
      if (error.code === "23505") {
        setErrore("Slug già esistente — scegli un nome diverso.");
      } else {
        setErrore(error.message);
      }
      return;
    }
    toast.success(`Tenant "${nome.trim()}" creato.`);
    reset();
    onCreated();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) handleClose(); }}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Nuovo tenant</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="nt-nome">Nome *</Label>
            <Input
              id="nt-nome"
              placeholder="es. Energia Verde Srl"
              value={nome}
              onChange={(e) => handleNomeChange(e.target.value)}
              autoFocus
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="nt-slug">Slug *</Label>
            <Input
              id="nt-slug"
              placeholder="es. energia-verde-srl"
              value={slug}
              onChange={(e) => handleSlugChange(e.target.value)}
              className="font-mono text-sm"
            />
            <p className="text-[11px] text-muted-foreground">
              Identificatore univoco — solo lettere, numeri e trattini.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label>Piano</Label>
            <Select value={piano} onValueChange={(v) => setPiano(v as Piano)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PIANI.map((p) => (
                  <SelectItem key={p} value={p} className="capitalize">
                    {p}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="nt-colore">Colore primario</Label>
            <div className="flex items-center gap-2">
              <input
                id="nt-colore"
                type="color"
                value={colore}
                onChange={(e) => setColore(e.target.value)}
                className="w-9 h-9 rounded cursor-pointer border border-border bg-transparent p-0.5"
              />
              <span className="text-sm font-mono text-muted-foreground">{colore}</span>
            </div>
          </div>

          {errore && (
            <p className="text-sm text-destructive">{errore}</p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={saving}>
            Annulla
          </Button>
          <Button
            onClick={submit}
            disabled={saving || !nome.trim() || !slug.trim()}
            className="gap-2"
          >
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            Crea tenant
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── AggiuntaAgenteDialog ──────────────────────────────────────────────────────

interface AggiuntaAgenteDialogProps {
  open: boolean;
  onClose: () => void;
  tenant: TenantRow | null;
}

function AggiuntaAgenteDialog({ open, onClose, tenant }: AggiuntaAgenteDialogProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<Ruolo>("owner");
  const [saving, setSaving] = useState(false);
  const [errore, setErrore] = useState<string | null>(null);
  const [success, setSuccess] = useState<{ email: string; password: string } | null>(null);
  const [copied, setCopied] = useState(false);

  const reset = () => {
    setEmail(""); setPassword(""); setRole("owner");
    setSaving(false); setErrore(null); setSuccess(null); setCopied(false);
  };

  const handleClose = () => { reset(); onClose(); };

  const submit = async () => {
    if (!email.trim() || !password || !tenant) return;
    setSaving(true);
    setErrore(null);
    const { data, error } = await supabase.functions.invoke("provision-tenant-user", {
      body: { tenant_id: tenant.id, email: email.trim(), password, role },
    });
    setSaving(false);
    if (error) {
      setErrore(error.message ?? "Errore di rete");
      return;
    }
    if (data?.error) {
      setErrore(data.error);
      return;
    }
    setSuccess({ email: email.trim(), password });
  };

  const copia = async () => {
    const testo = `Email: ${success?.email}\nPassword: ${success?.password}`;
    try {
      await navigator.clipboard.writeText(testo);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // silent
    }
  };

  if (!tenant) return null;

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) handleClose(); }}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Aggiungi agente — {tenant.nome ?? tenant.slug}</DialogTitle>
        </DialogHeader>

        {success ? (
          <div className="space-y-4 py-2">
            <div className="rounded-lg bg-muted/60 border border-border p-4 space-y-3">
              <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                Credenziali create
              </p>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Email</p>
                <p className="text-sm font-medium font-mono">{success.email}</p>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Password</p>
                <p className="text-sm font-medium font-mono">{success.password}</p>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Condividi queste credenziali col broker. La password non verrà mostrata di nuovo.
            </p>
            <Button onClick={copia} variant="outline" className="w-full gap-2">
              {copied ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
              {copied ? "Copiato" : "Copia email + password"}
            </Button>
          </div>
        ) : (
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="ag-email">Email *</Label>
              <Input
                id="ag-email"
                type="email"
                placeholder="broker@esempio.it"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoFocus
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="ag-password">Password *</Label>
              <div className="flex gap-2">
                <Input
                  id="ag-password"
                  type="text"
                  placeholder="min 8 caratteri"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="font-mono text-sm flex-1"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setPassword(generatePassword())}
                  className="shrink-0 text-xs px-3"
                >
                  Genera
                </Button>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Ruolo</Label>
              <Select value={role} onValueChange={(v) => setRole(v as Ruolo)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {RUOLI.map((r) => (
                    <SelectItem key={r} value={r} className="capitalize">
                      {r}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {errore && (
              <p className="text-sm text-destructive">{errore}</p>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            {success ? "Chiudi" : "Annulla"}
          </Button>
          {!success && (
            <Button
              onClick={submit}
              disabled={saving || !email.trim() || !password}
              className="gap-2"
            >
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}
              Crea agente
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── TenantList ────────────────────────────────────────────────────────────────

interface TenantListProps {
  tenants: TenantRow[] | null;
  error: string | null;
  onRefresh: () => void;
  onProvision: (tenant: TenantRow) => void;
}

function TenantList({ tenants, error, onRefresh, onProvision }: TenantListProps) {
  const [toggling, setToggling] = useState<string | null>(null);

  const toggleAttivo = async (t: TenantRow) => {
    if (t.attivo) {
      const ok = window.confirm(`Sospendere "${t.nome ?? t.slug}"? L'accesso al board sarà bloccato per questo tenant.`);
      if (!ok) return;
    }
    setToggling(t.id);
    const { error: err } = await supabase
      .from("tenants")
      .update({ attivo: !t.attivo })
      .eq("id", t.id);
    setToggling(null);
    if (err) {
      toast.error("Errore: " + err.message);
    } else {
      toast.success(t.attivo ? `"${t.nome ?? t.slug}" sospeso.` : `"${t.nome ?? t.slug}" riattivato.`);
      onRefresh();
    }
  };

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
          className="flex items-center gap-3 px-4 py-3 bg-background hover:bg-muted/40 transition-colors"
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
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onProvision(t)}
              className="h-7 px-2 text-[11px] text-muted-foreground hover:text-foreground gap-1"
              title="Aggiungi agente a questo tenant"
            >
              <UserPlus className="w-3 h-3" />
              <span className="hidden sm:inline">Agente</span>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              disabled={toggling === t.id}
              onClick={() => toggleAttivo(t)}
              className="h-7 px-2 text-[11px] text-muted-foreground hover:text-foreground"
            >
              {toggling === t.id
                ? <Loader2 className="w-3 h-3 animate-spin" />
                : t.attivo ? "Sospendi" : "Riattiva"}
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}

// ── AdminConsole ──────────────────────────────────────────────────────────────

export default function AdminConsole() {
  const [tenants, setTenants] = useState<TenantRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [nuovoOpen, setNuovoOpen] = useState(false);
  const [agentTarget, setAgentTarget] = useState<TenantRow | null>(null);

  const loadTenants = () => {
    setTenants(null);
    setError(null);
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
  };

  useEffect(() => { loadTenants(); }, []);

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
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
                Tenant registrati
              </h2>
              <Button
                size="sm"
                onClick={() => setNuovoOpen(true)}
                className="gap-1.5 h-8 text-xs"
              >
                <Plus className="w-3.5 h-3.5" />
                Nuovo tenant
              </Button>
            </div>
            <TenantList
              tenants={tenants}
              error={error}
              onRefresh={loadTenants}
              onProvision={(t) => setAgentTarget(t)}
            />
          </section>
        </main>

        <NuovoTenantDialog
          open={nuovoOpen}
          onClose={() => setNuovoOpen(false)}
          onCreated={() => { setNuovoOpen(false); loadTenants(); }}
        />

        <AggiuntaAgenteDialog
          open={agentTarget !== null}
          onClose={() => setAgentTarget(null)}
          tenant={agentTarget}
        />
      </div>
    </RequirePlatformAdmin>
  );
}
