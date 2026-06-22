import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Pencil, Trash2, Plus, Upload, TrendingUp, Lock, CalendarX, Copy } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { CteFormModal, type CteRow, type CteFormPayload, type FornitoreOption } from "./CteFormModal";
import { UploadPdfFlow } from "./UploadPdfFlow";

type Filtro = "tutte" | "luce" | "gas" | "residenziale" | "business" | "attive" | "scadute";

function isScaduta(valida_a: string | null | undefined): boolean {
  if (!valida_a) return false;
  return new Date(valida_a).getTime() < Date.now();
}

function formatData(d: string | null | undefined): string | null {
  if (!d) return null;
  return new Date(d).toLocaleDateString("it-IT");
}

export function ListinoTab() {
  const [ctes, setCtes] = useState<CteRow[]>([]);
  const [fornitori, setFornitori] = useState<FornitoreOption[]>([]);
  const [filtro, setFiltro] = useState<Filtro>("tutte");
  const [fornitoreFilter, setFornitoreFilter] = useState<string>("");
  const [editing, setEditing] = useState<CteRow | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [showUpload, setShowUpload] = useState(false);

  const carica = async () => {
    const { data } = await supabase
      .from("cte")
      .select("*, fornitori(nome, colore)")
      .order("created_at", { ascending: false });
    if (data) setCtes(data as unknown as CteRow[]);
  };

  useEffect(() => {
    carica();
    supabase.from("fornitori").select("id, nome").eq("attivo", true).order("nome")
      .then(({ data }) => { if (data) setFornitori(data as FornitoreOption[]); });
  }, []);

  const fornitoriInUso = useMemo(() => {
    const seen = new Map<string, string>();
    for (const c of ctes) {
      if (c.fornitore_id && c.fornitori?.nome) seen.set(c.fornitore_id, c.fornitori.nome);
    }
    return Array.from(seen.entries())
      .map(([id, nome]) => ({ id, nome }))
      .sort((a, b) => a.nome.localeCompare(b.nome));
  }, [ctes]);

  const filtrate = useMemo(() => ctes.filter((c) => {
    if (fornitoreFilter && c.fornitore_id !== fornitoreFilter) return false;
    switch (filtro) {
      case "luce": return c.tipo_fornitura === "luce";
      case "gas": return c.tipo_fornitura === "gas";
      case "residenziale": return c.segmento === "residenziale";
      case "business": return c.segmento === "business";
      case "attive": return c.attiva && !isScaduta(c.valida_a);
      case "scadute": return isScaduta(c.valida_a);
      default: return true;
    }
  }), [ctes, filtro, fornitoreFilter]);

  const stats = useMemo(() => {
    const attive = ctes.filter((c) => c.attiva && !isScaduta(c.valida_a));
    const luce = attive.filter((c) => c.tipo_fornitura === "luce").length;
    const gas = attive.filter((c) => c.tipo_fornitura === "gas").length;
    const inScadenza = ctes.filter((c) => {
      if (!c.valida_a) return false;
      const d = new Date(c.valida_a).getTime();
      const now = Date.now();
      return d > now && d - now < 30 * 24 * 3600 * 1000;
    }).length;
    const fornitoriByCte = new Set(ctes.filter((c) => c.fornitore_id).map((c) => c.fornitore_id));
    return { totali: attive.length, luce, gas, fornitori: fornitoriByCte.size, inScadenza };
  }, [ctes]);

  const toggleAttiva = async (c: CteRow) => {
    await supabase.from("cte").update({ attiva: !c.attiva }).eq("id", c.id);
    carica();
  };

  const elimina = async (c: CteRow) => {
    if (!confirm(`Eliminare "${c.nome}"?`)) return;
    const { error } = await supabase.from("cte").delete().eq("id", c.id);
    if (error) { toast.error("Errore: " + error.message); return; }
    toast.success("Offerta eliminata");
    carica();
  };

  const scaduteIds = useMemo(() => ctes.filter((c) => isScaduta(c.valida_a)).map((c) => c.id), [ctes]);

  const eliminaScadute = async () => {
    if (!scaduteIds.length) return;
    if (!confirm(`Eliminare ${scaduteIds.length} offerte scadute? Operazione irreversibile.`)) return;
    const { error } = await supabase.from("cte").delete().in("id", scaduteIds);
    if (error) { toast.error("Errore: " + error.message); return; }
    toast.success(`${scaduteIds.length} offerte scadute eliminate`);
    carica();
  };

  const duplicatiIds = useMemo(() => {
    const byKey = new Map<string, CteRow[]>();
    for (const c of ctes) {
      const key = [
        c.fornitore_id ?? "",
        (c.nome ?? "").trim().toLowerCase(),
        c.tipo_fornitura, c.segmento, c.tipo_prezzo,
        c.prezzo_energia_luce ?? "", c.spread_luce ?? "",
        c.prezzo_energia_gas ?? "", c.spread_gas ?? "",
      ].join("|");
      if (!byKey.has(key)) byKey.set(key, []);
      byKey.get(key)!.push(c);
    }
    const dup: string[] = [];
    for (const arr of byKey.values()) {
      if (arr.length < 2) continue;
      arr.sort((a, b) => (b.created_at ?? "").localeCompare(a.created_at ?? ""));
      dup.push(...arr.slice(1).map((c) => c.id));
    }
    return dup;
  }, [ctes]);

  const rimuoviDoppioni = async () => {
    if (!duplicatiIds.length) return;
    if (!confirm(`Trovati ${duplicatiIds.length} doppioni. Eliminarli mantenendo la copia più recente?`)) return;
    const { error } = await supabase.from("cte").delete().in("id", duplicatiIds);
    if (error) { toast.error("Errore: " + error.message); return; }
    toast.success(`${duplicatiIds.length} doppioni rimossi`);
    carica();
  };

  const salva = async (payload: CteFormPayload) => {
    if (editing) {
      const { error } = await supabase.from("cte").update(payload).eq("id", editing.id);
      if (error) { toast.error("Errore: " + error.message); return; }
      toast.success("Offerta aggiornata");
    } else {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { toast.error("Sessione scaduta — effettua di nuovo il login"); return; }
      const { data: membership } = await supabase
        .from("tenant_members")
        .select("tenant_id")
        .eq("user_id", user.id)
        .limit(1)
        .maybeSingle();
      if (!membership?.tenant_id) { toast.error("Tenant non trovato per questo utente"); return; }
      const { error } = await supabase.from("cte").insert({ ...payload, tenant_id: membership.tenant_id });
      if (error) { toast.error("Errore: " + error.message); return; }
      toast.success("Offerta aggiunta");
    }
    carica();
  };

  const filtri: { v: Filtro; l: string }[] = [
    { v: "tutte", l: "Tutte" }, { v: "luce", l: "Luce" }, { v: "gas", l: "Gas" },
    { v: "residenziale", l: "Family" }, { v: "business", l: "Business" },
    { v: "attive", l: "Attive" }, { v: "scadute", l: "Scadute" },
  ];

  return (
    <div className="container mx-auto px-3 sm:px-4 py-4 sm:py-6 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold">Listino offerte</h2>
          <p className="text-sm text-muted-foreground">{stats.totali} attive</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={rimuoviDoppioni} disabled={!duplicatiIds.length} className="gap-2">
            <Copy className="w-4 h-4" />Rimuovi doppioni{duplicatiIds.length ? ` (${duplicatiIds.length})` : ""}
          </Button>
          <Button variant="outline" size="sm" onClick={eliminaScadute} disabled={!scaduteIds.length} className="gap-2 text-red-600 hover:text-red-700">
            <CalendarX className="w-4 h-4" />Elimina scadute{scaduteIds.length ? ` (${scaduteIds.length})` : ""}
          </Button>
          <Button variant="outline" onClick={() => setShowUpload(true)} className="gap-2"><Upload className="w-4 h-4" />Carica PDF</Button>
          <Button onClick={() => { setEditing(null); setShowForm(true); }} className="gap-2"><Plus className="w-4 h-4" />Aggiungi</Button>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <Card className="p-3"><div className="text-xs text-muted-foreground">Attive</div><div className="text-xl font-bold">{stats.totali}</div></Card>
        <Card className="p-3"><div className="text-xs text-muted-foreground">Luce / Gas</div><div className="text-xl font-bold">{stats.luce} / {stats.gas}</div></Card>
        <Card className="p-3"><div className="text-xs text-muted-foreground">Fornitori</div><div className="text-xl font-bold">{stats.fornitori}</div></Card>
        <Card className="p-3"><div className="text-xs text-muted-foreground">In scadenza ≤30gg</div><div className="text-xl font-bold text-orange-500">{stats.inScadenza}</div></Card>
      </div>

      <div className="flex flex-wrap gap-2 items-center">
        {filtri.map((f) => (
          <button key={f.v} onClick={() => setFiltro(f.v)}
            className={cn("px-3 py-1.5 text-sm rounded-full border", filtro === f.v ? "bg-primary text-primary-foreground border-primary" : "bg-background")}>
            {f.l}
          </button>
        ))}
        <select value={fornitoreFilter} onChange={(e) => setFornitoreFilter(e.target.value)} className="ml-auto text-sm border rounded-md px-2 py-1.5 bg-background">
          <option value="">Tutti i fornitori</option>
          {fornitoriInUso.map((f) => <option key={f.id} value={f.id}>{f.nome}</option>)}
        </select>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {filtrate.map((c) => {
          const scaduta = isScaduta(c.valida_a);
          const isLuce = c.tipo_fornitura === "luce";
          const unita = isLuce ? "kWh" : "Smc";
          const prezzo = isLuce ? c.prezzo_energia_luce : c.prezzo_energia_gas;
          const spread = isLuce ? c.spread_luce : c.spread_gas;
          const quota = isLuce ? c.quota_fissa_luce : c.quota_fissa_gas;
          const segLabel = c.segmento === "business" ? "Business" : "Family";
          return (
            <Card key={c.id} className={cn("p-4 space-y-2", scaduta && "bg-muted/40")}>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm">{isLuce ? "⚡" : "🔥"}</span>
                    <h4 className="font-semibold truncate">{c.nome}</h4>
                  </div>
                  <p className="text-xs text-muted-foreground">{c.fornitori?.nome ?? "—"} · {segLabel}</p>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <Badge className={cn("text-[10px]", c.tipo_prezzo === "indicizzato" ? "bg-blue-100 text-blue-700" : "bg-green-100 text-green-700")}>
                    {c.tipo_prezzo === "indicizzato"
                      ? <><TrendingUp className="w-3 h-3 mr-1" />INDEX</>
                      : <><Lock className="w-3 h-3 mr-1" />FISSO</>}
                  </Badge>
                  {scaduta && <Badge variant="destructive" className="text-[10px]">SCADUTA</Badge>}
                </div>
              </div>
              <div className="text-xs text-muted-foreground">
                {c.tipo_prezzo === "fisso"
                  ? <>Prezzo: <strong>{prezzo} €/{unita}</strong></>
                  : <>Spread: <strong>{spread} €/{unita}</strong> ({isLuce ? "PUN" : "PSV"})</>}
                {quota != null && <> · Fisso: <strong>{quota} €/mese</strong></>}
              </div>
              {(c.componenti_venditore?.length ?? 0) > 0 && (
                <details className="text-xs">
                  <summary className="cursor-pointer text-muted-foreground hover:text-foreground select-none">
                    Dettaglio venditore ({c.componenti_venditore!.length})
                  </summary>
                  <div className="mt-1 space-y-0.5 pl-2 border-l border-border">
                    {c.componenti_venditore!.map((v, i) => (
                      <div key={i} className="flex gap-2">
                        <span className="font-medium">{v.label}:</span>
                        <span className="text-muted-foreground">{v.valore}</span>
                      </div>
                    ))}
                  </div>
                </details>
              )}
              {c.target_note && <p className="text-xs text-muted-foreground italic">{c.target_note}</p>}
              {c.valida_a && <p className="text-xs text-muted-foreground">Val. {formatData(c.valida_a)}</p>}
              <div className="flex items-center justify-between pt-2 border-t">
                <div className="flex items-center gap-2 text-xs">
                  <Switch checked={c.attiva} onCheckedChange={() => toggleAttiva(c)} />
                  <span>{c.attiva ? "Attiva" : "Disattivata"}</span>
                </div>
                <div className="flex gap-1">
                  <Button variant="ghost" size="icon" onClick={() => { setEditing(c); setShowForm(true); }}><Pencil className="w-4 h-4" /></Button>
                  <Button variant="ghost" size="icon" onClick={() => elimina(c)}><Trash2 className="w-4 h-4 text-red-500" /></Button>
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      <CteFormModal
        open={showForm}
        onClose={() => setShowForm(false)}
        onSave={salva}
        initial={editing}
        fornitori={fornitori}
      />
      <UploadPdfFlow open={showUpload} onClose={() => setShowUpload(false)} onSaved={carica} />
    </div>
  );
}
