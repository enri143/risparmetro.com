import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Pencil, Trash2, Plus, Upload, TrendingUp, Lock, CalendarX, Copy } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import type { CTE } from "@/lib/board/types";
import { CteFormModal } from "./CteFormModal";
import { UploadPdfFlow } from "./UploadPdfFlow";

type Filtro = "tutte" | "luce" | "gas" | "family" | "business" | "attive" | "scadute";

function isScaduta(validita: string | null): boolean {
  if (!validita) return false;
  const m = validita.match(/(\d{2})\/(\d{2})\/(\d{4})/);
  if (!m) return false;
  const d = new Date(parseInt(m[3]), parseInt(m[2]) - 1, parseInt(m[1]));
  return d.getTime() < Date.now();
}

export function ListinoTab() {
  const [ctes, setCtes] = useState<CTE[]>([]);
  const [filtro, setFiltro] = useState<Filtro>("tutte");
  const [fornitoreFilter, setFornitoreFilter] = useState<string>("");
  const [editing, setEditing] = useState<CTE | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [showUpload, setShowUpload] = useState(false);

  const carica = async () => {
    const { data } = await supabase.from("cte").select("*").order("created_at", { ascending: false });
    if (data) setCtes(data as unknown as CTE[]);
  };

  useEffect(() => { carica(); }, []);

  const fornitori = useMemo(() => Array.from(new Set(ctes.map((c) => c.fornitore))).sort(), [ctes]);

  const filtrate = useMemo(() => ctes.filter((c) => {
    if (fornitoreFilter && c.fornitore !== fornitoreFilter) return false;
    switch (filtro) {
      case "luce": return c.tipo === "luce";
      case "gas": return c.tipo === "gas";
      case "family": return c.segmento === "family";
      case "business": return c.segmento === "business";
      case "attive": return c.attiva && !isScaduta(c.validita);
      case "scadute": return isScaduta(c.validita);
      default: return true;
    }
  }), [ctes, filtro, fornitoreFilter]);

  const stats = useMemo(() => {
    const attive = ctes.filter((c) => c.attiva && !isScaduta(c.validita));
    const luce = attive.filter((c) => c.tipo === "luce").length;
    const gas = attive.filter((c) => c.tipo === "gas").length;
    const inScadenza = ctes.filter((c) => {
      if (!c.validita) return false;
      const m = c.validita.match(/(\d{2})\/(\d{2})\/(\d{4})/);
      if (!m) return false;
      const d = new Date(parseInt(m[3]), parseInt(m[2]) - 1, parseInt(m[1])).getTime();
      const now = Date.now();
      return d > now && d - now < 30 * 24 * 3600 * 1000;
    }).length;
    return { totali: attive.length, luce, gas, fornitori: fornitori.length, inScadenza };
  }, [ctes, fornitori]);

  const toggleAttiva = async (c: CTE) => {
    await supabase.from("cte").update({ attiva: !c.attiva }).eq("id", c.id);
    carica();
  };

  const elimina = async (c: CTE) => {
    if (!confirm(`Eliminare "${c.nome}"?`)) return;
    const { error } = await supabase.from("cte").delete().eq("id", c.id);
    if (error) { toast.error("Errore: " + error.message); return; }
    toast.success("Offerta eliminata");
    carica();
  };

  const scaduteIds = useMemo(() => ctes.filter((c) => isScaduta(c.validita)).map((c) => c.id), [ctes]);

  const eliminaScadute = async () => {
    if (!scaduteIds.length) return;
    if (!confirm(`Eliminare ${scaduteIds.length} offerte scadute? Operazione irreversibile.`)) return;
    const { error } = await supabase.from("cte").delete().in("id", scaduteIds);
    if (error) { toast.error("Errore: " + error.message); return; }
    toast.success(`${scaduteIds.length} offerte scadute eliminate`);
    carica();
  };

  const duplicatiIds = useMemo(() => {
    const byKey = new Map<string, CTE[]>();
    for (const c of ctes) {
      const key = [
        (c.fornitore ?? "").trim().toLowerCase(),
        (c.nome ?? "").trim().toLowerCase(),
        c.tipo, c.segmento, c.tipo_prezzo,
        c.prezzo_fisso ?? "", c.indice ?? "", c.spread ?? "",
        c.commercializzazione_anno ?? "",
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

  const salva = async (cte: Partial<CTE>) => {
    if (editing) {
      await supabase.from("cte").update(cte).eq("id", editing.id);
      toast.success("Offerta aggiornata");
    } else {
      await supabase.from("cte").insert(cte as never);
      toast.success("Offerta aggiunta");
    }
    carica();
  };

  const filtri: { v: Filtro; l: string }[] = [
    { v: "tutte", l: "Tutte" }, { v: "luce", l: "⚡ Luce" }, { v: "gas", l: "🔥 Gas" },
    { v: "family", l: "Family" }, { v: "business", l: "Business" },
    { v: "attive", l: "✅ Attive" }, { v: "scadute", l: "❌ Scadute" },
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
        <Card className="p-3"><div className="text-xs text-muted-foreground">⚡ / 🔥</div><div className="text-xl font-bold">{stats.luce} / {stats.gas}</div></Card>
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
          {fornitori.map((f) => <option key={f} value={f}>{f}</option>)}
        </select>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {filtrate.map((c) => {
          const scaduta = isScaduta(c.validita);
          return (
            <Card key={c.id} className={cn("p-4 space-y-2", scaduta && "bg-muted/40")}>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm">{c.tipo === "luce" ? "⚡" : "🔥"}</span>
                    <h4 className="font-semibold truncate">{c.nome}</h4>
                  </div>
                  <p className="text-xs text-muted-foreground">{c.fornitore} · {c.segmento}</p>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <Badge className={cn("text-[10px]", c.tipo_prezzo === "index" ? "bg-blue-100 text-blue-700" : "bg-green-100 text-green-700")}>
                    {c.tipo_prezzo === "index" ? <><TrendingUp className="w-3 h-3 mr-1" />INDEX</> : <><Lock className="w-3 h-3 mr-1" />FISSO</>}
                  </Badge>
                  {scaduta && <Badge variant="destructive" className="text-[10px]">SCADUTA</Badge>}
                </div>
              </div>
              <div className="text-xs text-muted-foreground">
                {c.tipo_prezzo === "fisso"
                  ? <>Prezzo: <strong>{c.prezzo_fisso} €/{c.tipo === "luce" ? "kWh" : "Smc"}</strong></>
                  : <>Spread: <strong>{c.spread} €/{c.tipo === "luce" ? "kWh" : "Smc"}</strong> ({c.indice})</>}
                {" · "}Fisso: <strong>{c.commercializzazione_anno} €/anno</strong>
              </div>
              {c.note && <p className="text-xs text-muted-foreground italic">{c.note}</p>}
              {c.validita && <p className="text-xs text-muted-foreground">Val. {c.validita}</p>}
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

      <CteFormModal open={showForm} onClose={() => setShowForm(false)} onSave={salva} initial={editing} fornitori={fornitori} />
      <UploadPdfFlow open={showUpload} onClose={() => setShowUpload(false)} onSaved={carica} />
    </div>
  );
}
