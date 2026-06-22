import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Zap, Flame, MapPin, Search, Lock, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { eur } from "@/lib/board/formatters";
import {
  type CTE,
  type DatiCliente,
  type ParametriRegolati,
  type PrezzoMercato,
  type RisultatoOfferta,
  type TipoCliente,
  type UsoGas,
  calcolaConfrontoOfferte,
} from "@/lib/board/calcoloOfferte";

// ─── Tipi Supabase (raw rows) ────────────────────────────────────────────────

interface SupabaseCteRow {
  id: string;
  nome: string;
  tipo_fornitura: "luce" | "gas" | "dual";
  tipo_prezzo: "fisso" | "variabile" | "indicizzato";
  prezzo_energia_luce: number | null;
  spread_luce: number | null;
  quota_fissa_luce: number | null;
  prezzo_energia_gas: number | null;
  spread_gas: number | null;
  quota_fissa_gas: number | null;
  mesi_storno_rischio: number | null;
  priorita: number;
  provvigione_override: number | null;
  provvigione_tipo: string | null;
  durata_blocco_mesi: number | null;
  fornitori: { nome: string; colore: string | null } | null;
  componenti_venditore?: { label: string; valore: string }[];
}

interface ZonaRow {
  id: string;
  regione: string;
  zona_elettrica: string;
  ambito_gas: string | null;
}

// ─── Adapter Supabase → tipo CTE del motore ──────────────────────────────────

function adaptCte(row: SupabaseCteRow): CTE {
  return {
    id: row.id,
    nome: row.nome,
    fornitore_nome: row.fornitori?.nome ?? "—",
    fornitore_colore: row.fornitori?.colore ?? undefined,
    tipo_fornitura: row.tipo_fornitura,
    tipo_prezzo: row.tipo_prezzo,
    prezzo_energia_luce: row.prezzo_energia_luce ?? undefined,
    spread_luce: row.spread_luce ?? undefined,
    quota_fissa_luce: row.quota_fissa_luce ?? undefined,
    prezzo_energia_gas: row.prezzo_energia_gas ?? undefined,
    spread_gas: row.spread_gas ?? undefined,
    quota_fissa_gas: row.quota_fissa_gas ?? undefined,
    durata_blocco_mesi: row.durata_blocco_mesi ?? undefined,
    provvigione: row.provvigione_override ?? undefined,
    provvigione_tipo: (row.provvigione_tipo as "fisso" | "percentuale") ?? undefined,
    mesi_storno_rischio: row.mesi_storno_rischio ?? undefined,
    priorita: row.priorita,
  };
}

// ─── Costanti form ───────────────────────────────────────────────────────────

const TIPO_CLIENTI: { v: TipoCliente; l: string }[] = [
  { v: "domestico_residente", l: "Domestico residente" },
  { v: "domestico_non_residente", l: "Domestico non residente" },
  { v: "business", l: "Business P.IVA" },
];

const USI_GAS: { v: UsoGas; l: string }[] = [
  { v: "riscaldamento", l: "Riscaldamento" },
  { v: "cottura_acs", l: "Cottura + ACS" },
  { v: "entrambi", l: "Entrambi" },
];

const POTENZE_DOM = [3, 4.5, 6];
const POTENZE_BUS = [6, 10, 15, 30];

// ─── Dati form di default ────────────────────────────────────────────────────

const DATI_DEFAULT: DatiCliente = {
  tipo_fornitura: "luce",
  tipo_cliente: "domestico_residente",
  consumo_annuo_kwh: 2700,
  consumo_annuo_smc: 1200,
  potenza_impegnata_kw: 3,
  uso_gas: "riscaldamento",
};

// ─── Componente SelettoreChip ─────────────────────────────────────────────────

function Chip<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { v: T; l: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="inline-flex flex-wrap gap-1.5">
      {options.map((o) => (
        <button
          key={o.v}
          type="button"
          onClick={() => onChange(o.v)}
          className={cn(
            "px-3 py-2 min-h-[44px] text-sm rounded-md border transition-colors cursor-pointer",
            value === o.v
              ? "bg-primary text-primary-foreground border-primary"
              : "bg-background hover:bg-muted border-input",
          )}
        >
          {o.l}
        </button>
      ))}
    </div>
  );
}

// ─── Card risultato singola offerta ──────────────────────────────────────────

function RisultatoCard({ r, idx, haSpesa }: { r: RisultatoOfferta; idx: number; haSpesa: boolean }) {
  const negativo = haSpesa && r.risparmio_annuo < 0;
  const positivo = haSpesa && r.risparmio_annuo > 0;
  const medals = ["🥇", "🥈", "🥉"];
  const borderClass = negativo
    ? "border-l-red-500 bg-red-50/30"
    : positivo && idx < 3
      ? (["border-l-green-500 bg-green-50/30", "border-l-blue-500", "border-l-orange-400"][idx] ?? "border-l-border")
      : "border-l-border";

  return (
    <Card className={cn("border-l-4 p-4 space-y-3", borderClass)}>
      {/* intestazione */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            {positivo && idx < 3 && <span className="text-base">{medals[idx]}</span>}
            <span className="font-semibold truncate">{r.nome}</span>
            <Badge
              variant="secondary"
              className={cn(
                "text-[10px] gap-1",
                r.tipo_prezzo === "fisso"
                  ? "bg-green-100 text-green-700"
                  : "bg-blue-100 text-blue-700",
              )}
            >
              {r.tipo_prezzo === "fisso" ? (
                <><Lock className="w-2.5 h-2.5" /> FISSO</>
              ) : (
                <><TrendingUp className="w-2.5 h-2.5" /> {r.tipo_prezzo.toUpperCase()}</>
              )}
            </Badge>
            {r.durata_blocco_mesi && (
              <Badge variant="outline" className="text-[10px]">
                {r.durata_blocco_mesi} mesi
              </Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">{r.fornitore_nome}</p>
        </div>
      </div>

      {/* costi */}
      <div className="grid grid-cols-2 gap-3 text-sm">
        <div>
          <div className="text-xs text-muted-foreground">Costo annuo stimato</div>
          <div className="font-semibold text-base">{eur(r.costo_annuo_totale)}</div>
        </div>
        {haSpesa && (
          <div className={cn(
            "rounded-lg px-3 py-2",
            negativo ? "bg-red-100/60" : "bg-green-100/40",
          )}>
            <div className="text-xs text-muted-foreground">
              {negativo ? "Costo in più" : "Risparmio annuo"}
            </div>
            <div className={cn("font-bold text-lg", negativo ? "text-red-700" : "text-green-700")}>
              {negativo ? "−" : "+"}{eur(Math.abs(r.risparmio_annuo))}
            </div>
            {r.risparmio_percentuale !== 0 && (
              <div className={cn("text-xs", negativo ? "text-red-600" : "text-green-600")}>
                {negativo ? "−" : "+"}{Math.abs(r.risparmio_percentuale).toFixed(1)}% ·{" "}
                {negativo ? "−" : "+"}{eur(Math.abs(r.risparmio_annuo) / 12)}/mese
              </div>
            )}
          </div>
        )}
      </div>
    </Card>
  );
}

// ─── Sezione classifica (luce o gas) ─────────────────────────────────────────

function Sezione({
  titolo,
  icon,
  risultati,
  haSpesa,
  bestRisparmio,
}: {
  titolo: string;
  icon: React.ReactNode;
  risultati: RisultatoOfferta[];
  haSpesa: boolean;
  bestRisparmio: number;
}) {
  const [expanded, setExpanded] = useState(false);
  const visible = expanded ? risultati : risultati.slice(0, 3);
  const extra = risultati.length - 3;

  if (risultati.length === 0) {
    return (
      <div className="rounded-lg border-2 border-dashed p-6 text-center text-muted-foreground text-sm">
        Nessuna offerta {titolo.toLowerCase()} attiva nel listino.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold flex items-center gap-2 text-base">
          {icon} Classifica {titolo}
        </h3>
        {haSpesa && bestRisparmio > 0 && (
          <div className="text-right">
            <div className="text-xs text-muted-foreground">Migliore risparmio</div>
            <div className="text-xl font-bold text-green-600">{eur(bestRisparmio)}/anno</div>
          </div>
        )}
      </div>
      {!haSpesa && (
        <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-3 py-2">
          Inserisci la spesa attuale per vedere il risparmio.
        </p>
      )}
      <div className="space-y-3">
        {visible.map((r, i) => (
          <RisultatoCard key={r.cte_id} r={r} idx={i} haSpesa={haSpesa} />
        ))}
      </div>
      {extra > 0 && (
        <Button variant="outline" size="sm" className="w-full min-h-[44px]" onClick={() => setExpanded((v) => !v)}>
          {expanded ? "Mostra solo top 3" : `Vedi altre ${extra} offerte`}
        </Button>
      )}
    </div>
  );
}

// ─── Componente principale ───────────────────────────────────────────────────

export function AnalisiTab() {
  // dati persistenti dal DB
  const [zones, setZones] = useState<ZonaRow[]>([]);
  const [rawCtes, setRawCtes] = useState<SupabaseCteRow[]>([]);
  const [prezziMercato, setPrezziMercato] = useState<PrezzoMercato>({ pun_medio: 0.115, psv_medio: 0.42 });
  const [parametriLuce, setParametriLuce] = useState<ParametriRegolati | null>(null);
  const [parametriGas, setParametriGas] = useState<ParametriRegolati | null>(null);
  const [loadingData, setLoadingData] = useState(true);
  const [loadingZona, setLoadingZona] = useState(false);

  // form agent
  const [dati, setDati] = useState<DatiCliente>(DATI_DEFAULT);
  const [regione, setRegione] = useState("");
  const [potenzaCustom, setPotenzaCustom] = useState(false);

  // risultati
  const [showResults, setShowResults] = useState(false);
  const [filtro, setFiltro] = useState<"entrambi" | "luce" | "gas">("entrambi");

  const set = (patch: Partial<DatiCliente>) => {
    setDati((d) => ({ ...d, ...patch }));
    setShowResults(false);
  };

  // ── Caricamento iniziale: zone + CTE + prezzi mercato ────────────────────
  useEffect(() => {
    let mounted = true;
    async function load() {
      const [zonesRes, ctesRes, prezziRes] = await Promise.all([
        supabase.from("zone_territoriali").select("*").order("regione"),
        supabase
          .from("cte")
          .select("*, fornitori(nome, colore)")
          .eq("attiva", true)
          .order("priorita", { ascending: false }),
        supabase
          .from("mercato_prezzi")
          .select("indice, valore")
          .in("indice", ["PUN", "PSV"])
          .order("data", { ascending: false })
          .limit(60), // 30 gg × 2 indici
      ]);
      if (!mounted) return;

      setZones((zonesRes.data ?? []) as ZonaRow[]);
      setRawCtes((ctesRes.data ?? []) as unknown as SupabaseCteRow[]);

      // media ultimi 30 gg
      const rows = (prezziRes.data ?? []) as { indice: string; valore: number }[];
      const pun = rows.filter((r) => r.indice === "PUN");
      const psv = rows.filter((r) => r.indice === "PSV");
      setPrezziMercato({
        pun_medio: pun.length ? pun.reduce((s, r) => s + r.valore, 0) / pun.length : 0.115,
        psv_medio: psv.length ? psv.reduce((s, r) => s + r.valore, 0) / psv.length : 0.42,
      });

      setLoadingData(false);
    }
    load();
    return () => { mounted = false; };
  }, []);

  // ── Caricamento parametri ARERA quando cambia regione ────────────────────
  useEffect(() => {
    if (!regione || zones.length === 0) return;
    const zona = zones.find((z) => z.regione === regione);
    if (!zona) return;

    let mounted = true;
    setLoadingZona(true);

    async function loadParametri() {
      if (!zona) return;
      const oggi = new Date().toISOString().slice(0, 10);
      const [luceRes, gasRes] = await Promise.all([
        supabase
          .from("parametri_regolati")
          .select("valori")
          .eq("tipo_fornitura", "luce")
          .eq("ambito", zona.zona_elettrica)
          .lte("periodo_da", oggi)
          .gte("periodo_a", oggi)
          .order("periodo_da", { ascending: false })
          .limit(1),
        zona.ambito_gas
          ? supabase
              .from("parametri_regolati")
              .select("valori")
              .eq("tipo_fornitura", "gas")
              .eq("ambito", zona.ambito_gas)
              .lte("periodo_da", oggi)
              .gte("periodo_a", oggi)
              .order("periodo_da", { ascending: false })
              .limit(1)
          : Promise.resolve({ data: [] as { valori: unknown }[] }),
      ]);
      if (!mounted) return;

      const plRaw = (luceRes.data?.[0]?.valori ?? null) as ParametriRegolati | null;
      const pgRaw = ((gasRes as { data: { valori: unknown }[] | null }).data?.[0]?.valori ?? null) as ParametriRegolati | null;

      // fallback se i parametri ARERA non sono ancora popolati per questa zona
      setParametriLuce(
        plRaw ?? {
          sigma1_mese: 1.90, sigma2_kw_mese: 2.106, sigma3_uc3_kwh: 0.01057,
          oneri_luce_fisso_mese: 0.50, oneri_luce_var_kwh: 0.0350,
          accise_luce_dom: 0.0227, accise_luce_bus: 0.0125, soglia_esenzione_kwh_mese: 150,
          iva_dom: 0.10, iva_bus: 0.22, perdite_rete: 1.10, cdispd_anno: 1.23, canone_rai_anno: 90,
          accise: 0.0227, iva: 0.10,
        },
      );
      setParametriGas(
        zona.ambito_gas
          ? (pgRaw ?? { trasporto: 0.09, oneri: 0.04, accise: 0.044, iva: 0.10 })
          : null,
      );

      // aggiorna dati cliente con zona
      setDati((d) => ({
        ...d,
        zona_arera: zona.zona_elettrica,
        ambito_gas: zona.ambito_gas ?? undefined,
      }));
      setLoadingZona(false);
    }

    loadParametri();
    return () => { mounted = false; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [regione, zones]);

  // ── Calcolo risultati ─────────────────────────────────────────────────────
  const ctes = useMemo(() => rawCtes.map(adaptCte), [rawCtes]);

  const risultatiLuce = useMemo(() => {
    if (!showResults || !parametriLuce || !dati.consumo_annuo_kwh) return [];
    return calcolaConfrontoOfferte(
      { ...dati, prezzo_materia_gas: 0, quota_fissa_gas_mese: 0 },
      ctes.filter((c) => c.tipo_fornitura === "luce"),
      parametriLuce,
      null,
      prezziMercato,
    );
  }, [showResults, parametriLuce, dati, ctes, prezziMercato]);

  const risultatiGas = useMemo(() => {
    if (!showResults || !parametriGas || !dati.consumo_annuo_smc) return [];
    return calcolaConfrontoOfferte(
      { ...dati, prezzo_materia_luce: 0, quota_fissa_luce_mese: 0 },
      ctes.filter((c) => c.tipo_fornitura === "gas"),
      null,
      parametriGas,
      prezziMercato,
    );
  }, [showResults, parametriGas, dati, ctes, prezziMercato]);

  if (loadingData) {
    return (
      <div className="container mx-auto px-3 sm:px-4 py-6">
        <Skeleton className="h-96" />
      </div>
    );
  }

  const isBusiness = dati.tipo_cliente === "business";
  const potenze = isBusiness ? POTENZE_BUS : POTENZE_DOM;

  const haDatiAttualiLuce = (dati.prezzo_materia_luce ?? 0) > 0 && (dati.quota_fissa_luce_mese ?? 0) >= 0;
  const haDatiAttualiGas  = (dati.prezzo_materia_gas  ?? 0) > 0 && (dati.quota_fissa_gas_mese  ?? 0) >= 0;

  const canCalcola = !!regione && !loadingZona
    && ((!!dati.consumo_annuo_kwh && haDatiAttualiLuce) || (!!dati.consumo_annuo_smc && haDatiAttualiGas));

  const mancaDatiAttuali = !!regione && !loadingZona
    && ((!!dati.consumo_annuo_kwh && !haDatiAttualiLuce) || (!!dati.consumo_annuo_smc && !haDatiAttualiGas));

  const zonaInfo = zones.find((z) => z.regione === regione);

  return (
    <div className="container mx-auto px-3 sm:px-4 py-4 sm:py-6 max-w-full overflow-x-hidden">
      <div className="grid lg:grid-cols-2 gap-6">

        {/* ── FORM ─────────────────────────────────────────────── */}
        <Card className="p-5 sm:p-6 space-y-6">
          <div className="flex items-center gap-2">
            <Search className="w-5 h-5 text-primary" />
            <h2 className="text-lg font-semibold">Dati cliente</h2>
          </div>

          {/* Tipo cliente */}
          <div className="space-y-2">
            <Label>Tipo cliente</Label>
            <Chip<TipoCliente>
              options={TIPO_CLIENTI}
              value={dati.tipo_cliente}
              onChange={(v) => set({ tipo_cliente: v, potenza_impegnata_kw: v === "business" ? 6 : 3 })}
            />
          </div>

          {/* Zona ARERA */}
          <div className="space-y-2">
            <Label className="flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5" /> Zona ARERA — regione cliente
            </Label>
            <select
              value={regione}
              onChange={(e) => { setRegione(e.target.value); setShowResults(false); }}
              className="w-full h-11 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="">— Seleziona regione —</option>
              {zones.map((z) => (
                <option key={z.id} value={z.regione}>
                  {z.regione} · {z.zona_elettrica}{z.ambito_gas ? ` / ${z.ambito_gas}` : " (no gas)"}
                </option>
              ))}
            </select>
            {zonaInfo && (
              <div className="text-[11px] text-muted-foreground">
                PUN ref.: {(prezziMercato.pun_medio * 100).toFixed(2)} c€/kWh ·
                PSV ref.: {prezziMercato.psv_medio.toFixed(3)} €/Smc (media 30 gg)
              </div>
            )}
          </div>

          {/* Potenza */}
          <div className="space-y-2">
            <Label>Potenza impegnata (kW)</Label>
            <div className="flex flex-wrap items-center gap-2">
              {potenze.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => { set({ potenza_impegnata_kw: p }); setPotenzaCustom(false); }}
                  className={cn(
                    "px-3 py-2 min-h-[44px] text-sm rounded-md border cursor-pointer transition-colors",
                    !potenzaCustom && dati.potenza_impegnata_kw === p
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-background hover:bg-muted",
                  )}
                >
                  {p}
                </button>
              ))}
              <button
                type="button"
                onClick={() => setPotenzaCustom(true)}
                className={cn(
                  "px-3 py-2 min-h-[44px] text-sm rounded-md border cursor-pointer transition-colors",
                  potenzaCustom ? "bg-primary text-primary-foreground border-primary" : "bg-background hover:bg-muted",
                )}
              >
                Altro
              </button>
              {potenzaCustom && (
                <Input
                  type="number"
                  step="0.5"
                  value={dati.potenza_impegnata_kw ?? ""}
                  onChange={(e) => set({ potenza_impegnata_kw: parseFloat(e.target.value) || 0 })}
                  className="w-24 h-11"
                />
              )}
            </div>
          </div>

          {/* Luce */}
          <div className="rounded-lg border border-yellow-200 bg-yellow-50/50 p-4 space-y-4">
            <div className="flex items-center gap-2">
              <Zap className="w-5 h-5 text-yellow-500" />
              <h3 className="font-semibold">Energia elettrica</h3>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Consumo annuo (kWh)</Label>
              <Input
                type="number"
                min={0}
                step={100}
                value={dati.consumo_annuo_kwh ?? ""}
                onChange={(e) => set({ consumo_annuo_kwh: parseInt(e.target.value) || 0 })}
                className="h-11"
                placeholder="es. 2700"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1.5">
                <Label className="text-xs">Prezzo materia (€/kWh)</Label>
                <Input
                  type="number"
                  min={0}
                  step={0.0001}
                  value={dati.prezzo_materia_luce ?? ""}
                  onChange={(e) => set({ prezzo_materia_luce: parseFloat(e.target.value) || undefined })}
                  className="h-11"
                  placeholder="es. 0.1250"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Quota fissa (€/mese)</Label>
                <Input
                  type="number"
                  min={0}
                  step={0.01}
                  value={dati.quota_fissa_luce_mese ?? ""}
                  onChange={(e) => set({ quota_fissa_luce_mese: parseFloat(e.target.value) || undefined })}
                  className="h-11"
                  placeholder="es. 14.50"
                />
              </div>
            </div>
          </div>

          {/* Gas */}
          <div className="rounded-lg border border-orange-200 bg-orange-50/50 p-4 space-y-4">
            <div className="flex items-center gap-2">
              <Flame className="w-5 h-5 text-orange-500" />
              <h3 className="font-semibold">Gas naturale</h3>
              {!zonaInfo?.ambito_gas && (
                <span className="text-xs text-muted-foreground">(non disponibile in Sardegna)</span>
              )}
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Consumo annuo (Smc)</Label>
              <Input
                type="number"
                min={0}
                step={50}
                value={dati.consumo_annuo_smc ?? ""}
                onChange={(e) => set({ consumo_annuo_smc: parseInt(e.target.value) || 0 })}
                className="h-11"
                placeholder="es. 1200"
                disabled={!zonaInfo?.ambito_gas && !!regione}
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1.5">
                <Label className="text-xs">Prezzo materia (€/Smc)</Label>
                <Input
                  type="number"
                  min={0}
                  step={0.001}
                  value={dati.prezzo_materia_gas ?? ""}
                  onChange={(e) => set({ prezzo_materia_gas: parseFloat(e.target.value) || undefined })}
                  className="h-11"
                  placeholder="es. 0.420"
                  disabled={!zonaInfo?.ambito_gas && !!regione}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Quota fissa (€/mese)</Label>
                <Input
                  type="number"
                  min={0}
                  step={0.01}
                  value={dati.quota_fissa_gas_mese ?? ""}
                  onChange={(e) => set({ quota_fissa_gas_mese: parseFloat(e.target.value) || undefined })}
                  className="h-11"
                  placeholder="es. 12.00"
                  disabled={!zonaInfo?.ambito_gas && !!regione}
                />
              </div>
            </div>
            {zonaInfo?.ambito_gas && (
              <div className="space-y-1.5">
                <Label className="text-xs">Uso gas</Label>
                <Chip<UsoGas>
                  options={USI_GAS}
                  value={dati.uso_gas ?? "riscaldamento"}
                  onChange={(v) => set({ uso_gas: v })}
                />
              </div>
            )}
          </div>

          {/* CTA */}
          {!regione && (
            <p className="text-sm text-amber-700 bg-amber-50 rounded-md px-3 py-2 border border-amber-200">
              Seleziona la regione per abilitare il calcolo.
            </p>
          )}
          <Button
            size="lg"
            className="w-full min-h-[48px] bg-green-600 hover:bg-green-700 text-white text-base font-semibold"
            disabled={!canCalcola}
            onClick={() => setShowResults(true)}
          >
            <Search className="w-5 h-5 mr-2" />
            {loadingZona ? "Caricamento parametri…" : "Trova offerta migliore"}
          </Button>
          {mancaDatiAttuali && (
            <p className="text-sm text-red-700 bg-red-50 rounded-md px-3 py-2 border border-red-200">
              Servono prezzo materia e quota fissa dell&apos;offerta attuale del cliente per calcolare il risparmio reale. Senza, niente confronto.
            </p>
          )}
        </Card>

        {/* ── RISULTATI ────────────────────────────────────────── */}
        <div className="space-y-4">
          {showResults ? (
            <>
              {/* toggle luce / gas / entrambi */}
              <div className="inline-flex rounded-lg border bg-muted p-1 gap-1">
                {(
                  [
                    { v: "entrambi" as const, l: "⚡ + 🔥 Entrambi" },
                    { v: "luce" as const, l: "⚡ Luce" },
                    { v: "gas" as const, l: "🔥 Gas" },
                  ] as const
                ).map((o) => (
                  <button
                    key={o.v}
                    onClick={() => setFiltro(o.v)}
                    className={cn(
                      "px-3 py-1.5 min-h-[36px] text-sm rounded-md transition-colors",
                      filtro === o.v
                        ? "bg-background text-foreground shadow-sm font-medium"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {o.l}
                  </button>
                ))}
              </div>

              {filtro !== "gas" && (
                <Sezione
                  titolo="Luce"
                  icon={<Zap className="w-4 h-4 text-yellow-500" />}
                  risultati={risultatiLuce}
                  haSpesa={haDatiAttualiLuce}
                  bestRisparmio={risultatiLuce[0]?.risparmio_annuo ?? 0}
                />
              )}
              {filtro !== "luce" && (
                <Sezione
                  titolo="Gas"
                  icon={<Flame className="w-4 h-4 text-orange-500" />}
                  risultati={risultatiGas}
                  haSpesa={haDatiAttualiGas}
                  bestRisparmio={risultatiGas[0]?.risparmio_annuo ?? 0}
                />
              )}
            </>
          ) : (
            <div className="rounded-lg border-2 border-dashed p-12 text-center text-muted-foreground space-y-3">
              <div className="text-4xl opacity-20">⚡🔥</div>
              <p className="text-sm">
                Compila i dati e premi <strong>Trova offerta migliore</strong>{" "}
                per vedere la classifica offerte.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
