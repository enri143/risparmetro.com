import { useEffect, useMemo, useState } from "react";
import {
  CheckCircle2,
  ChevronDown,
  Eye,
  Flame,
  Maximize2,
  Save,
  Search,
  ShieldCheck,
  ShieldOff,
  TrendingUp,
  Zap,
} from "lucide-react";
import { ConfrontoDettagliatoView } from "./ConfrontoDettagliatoView";
import { MaxiTrattativaPanel } from "./analisi/MaxiTrattativaPanel";
import { PresentazioneView } from "./PresentazioneView";
import { TrattativaView } from "./TrattativaView";
import { UploadBollettaButton, type OcrDoneResult } from "./analisi/UploadBollettaButton";
import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";
import { eur } from "@/lib/board/formatters";
import {
  calcolaConfrontoOfferte,
  type CTE,
  type DatiCliente,
  type ParametriRegolati,
  type PrezzoMercato,
  type RisultatoOfferta,
  type TipoFornitura,
  type UsoGas,
} from "@/lib/board/calcoloOfferte";
import {
  fetchParametriAreraLuce,
  CUTOVER_COMPONENTI,
  type ParametriAreraLuce,
} from "@/lib/calcolo/parametriArera";

// ── Types ─────────────────────────────────────────────────────────────────────

interface SupabaseCteRow {
  id: string;
  nome: string;
  tipo_fornitura: TipoFornitura;
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
  segmento: "residenziale" | "business" | "entrambi";
  fornitori: { nome: string; colore: string | null } | null;
  componenti_venditore?: { label: string; valore: string }[];
}

type CTEConSegmento = CTE & { segmento_cliente?: "residenziale" | "business" | "entrambi" };

interface ZonaRow {
  id: string;
  regione: string;
  zona_elettrica: string;
  ambito_gas: string | null;
}

type ClienteSeg = "domestico" | "business";
type ResidenzaSeg = "residente" | "non_residente";

// ── Adapter ───────────────────────────────────────────────────────────────────

function adaptCte(row: SupabaseCteRow): CTEConSegmento {
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
    segmento_cliente: row.segmento,
  };
}

// ── Constants ─────────────────────────────────────────────────────────────────

const TIPO_FORNITURA_OPT: { v: TipoFornitura; l: string }[] = [
  { v: "luce", l: "Luce" },
  { v: "gas", l: "Gas" },
  { v: "dual", l: "Luce + Gas" },
];

const USI_GAS_OPT: { v: UsoGas; l: string }[] = [
  { v: "riscaldamento", l: "Riscaldamento" },
  { v: "cottura_acs", l: "Cottura + ACS" },
  { v: "entrambi", l: "Entrambi" },
];

const POTENZE_DOM = [1.5, 3, 4.5, 6];
const POTENZE_BUS = [6, 10, 15, 30];

const DATI_DEFAULT: DatiCliente = {
  tipo_fornitura: "dual",
  tipo_cliente: "domestico_residente",
  consumo_annuo_kwh: undefined,
  consumo_annuo_smc: undefined,
  potenza_impegnata_kw: 3,
  uso_gas: "riscaldamento",
};

const FALLBACK_LUCE: ParametriRegolati = {
  sigma1_mese:               1.90,
  sigma2_kw_mese:            2.106,
  sigma3_uc3_kwh:            0.01057,
  oneri_luce_fisso_mese:     0.50,
  oneri_luce_var_kwh:        0.0350,
  accise_luce_dom:           0.0227,
  accise_luce_bus:           0.0125,
  soglia_esenzione_kwh_mese: 150,
  iva_dom:                   0.10,
  iva_bus:                   0.22,
  perdite_rete:              1.10,
  cdispd_anno:               1.23,
  canone_rai_anno:           90,
  accise:                    0.0227,
  iva:                       0.10,
};

const FALLBACK_GAS: ParametriRegolati = {
  trasporto: 0.09,
  oneri: 0.04,
  accise: 0.044,
  iva: 0.1,
};

// ── SegControl ────────────────────────────────────────────────────────────────

function SegControl<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { v: T; l: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex h-12 border border-border-ui rounded-lg bg-surface-subtle p-1 gap-0.5">
      {options.map((o) => (
        <button
          key={o.v}
          type="button"
          onClick={() => onChange(o.v)}
          className={cn(
            "flex-1 rounded-md text-sm font-medium transition-colors min-h-[40px] whitespace-nowrap px-2",
            value === o.v
              ? "bg-brand text-brand-foreground shadow-sm"
              : "text-text-muted hover:text-text-base hover:bg-surface-overlay",
          )}
        >
          {o.l}
        </button>
      ))}
    </div>
  );
}

// ── FornitoreAvatar ────────────────────────────────────────────────────────────

function FornitoreAvatar({ nome, colore }: { nome: string; colore?: string }) {
  return (
    <div
      className="w-10 h-10 rounded-full border border-border-ui flex items-center justify-center text-lg font-bold shrink-0 bg-white shadow-sm"
      style={{ color: colore ?? "#534AB7" }}
    >
      {nome.charAt(0).toUpperCase()}
    </div>
  );
}

// ── StandardOfferCard ─────────────────────────────────────────────────────────

function StandardOfferCard({
  r,
  idx,
  haSpesa,
  selected,
  onSelect,
}: {
  r: RisultatoOfferta;
  idx: number;
  haSpesa: boolean;
  selected?: boolean;
  onSelect?: () => void;
}) {
  const isBest = idx === 0 && haSpesa && r.risparmio_annuo > 0;
  const negativo = haSpesa && r.risparmio_annuo < 0;

  return (
    <div
      className={cn(
        "bg-white border rounded-xl overflow-hidden shadow-sm relative transition-all",
        selected ? "border-brand ring-1 ring-brand/20" : "border-border-ui",
      )}
    >
      <div
        className={cn(
          "absolute left-0 top-0 bottom-0 w-[3px]",
          isBest ? "bg-savings-bar" : negativo ? "bg-spend" : "bg-border-ui",
        )}
      />
      <div className="pl-5 pr-5 py-5 flex flex-col md:flex-row md:items-center gap-4">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <FornitoreAvatar nome={r.fornitore_nome} colore={r.fornitore_colore} />
          <div className="min-w-0">
            <div className="font-semibold text-base text-text-base truncate">{r.nome}</div>
            <div className="flex items-center gap-1.5 mt-1 flex-wrap">
              <span
                className={cn(
                  "text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded",
                  r.tipo_prezzo === "fisso"
                    ? "bg-surface-subtle text-text-muted"
                    : "bg-brand-subtle text-brand-subtle-foreground",
                )}
              >
                {r.tipo_prezzo}
              </span>
              {isBest && (
                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-savings-subtle text-savings-subtle-foreground">
                  Miglior risparmio
                </span>
              )}
              {r.durata_blocco_mesi && (
                <span className="text-[10px] text-text-muted">
                  {r.durata_blocco_mesi} mesi
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex flex-col md:w-40 shrink-0">
          <span className="text-xs text-text-muted">Costo stimato</span>
          <span className="font-semibold text-lg text-text-base">
            {eur(r.costo_annuo_totale)}
            <span className="text-sm font-normal text-text-muted">/anno</span>
          </span>
        </div>

        {haSpesa && (
          <div className="flex flex-col md:items-end shrink-0">
            <span className="text-xs text-text-muted">
              {negativo ? "Costo aggiuntivo" : "Risparmio"}
            </span>
            <span
              className={cn(
                "font-bold text-2xl leading-tight",
                negativo ? "text-spend" : "text-savings",
              )}
            >
              {negativo ? "−" : "+"}
              {eur(Math.abs(r.risparmio_annuo))}
            </span>
            {r.risparmio_percentuale !== 0 && (
              <span className={cn("text-xs", negativo ? "text-spend" : "text-savings")}>
                {negativo ? "−" : "+"}
                {Math.abs(r.risparmio_percentuale).toFixed(1)}%
              </span>
            )}
          </div>
        )}

        {onSelect && (
          <button
            type="button"
            onClick={onSelect}
            className={cn(
              "flex items-center gap-1.5 px-3 py-2 rounded-lg border text-xs font-medium transition-all min-h-[36px] shrink-0",
              selected
                ? "bg-savings-subtle border-savings text-savings-subtle-foreground"
                : "border-border-ui text-text-muted hover:bg-surface-subtle",
            )}
          >
            {selected ? (
              <>
                <CheckCircle2 className="w-3.5 h-3.5" />
                Selezionata
              </>
            ) : (
              "Seleziona"
            )}
          </button>
        )}
      </div>
    </div>
  );
}


// ── AnalisiCockpit ────────────────────────────────────────────────────────────

export function AnalisiCockpit() {
  // ── Data state ──────────────────────────────────────────────────────────────
  const [zones, setZones] = useState<ZonaRow[]>([]);
  const [rawCtes, setRawCtes] = useState<SupabaseCteRow[]>([]);
  const [prezziMercato, setPrezziMercato] = useState<PrezzoMercato>({
    pun_medio: 0.115,
    psv_medio: 0.42,
  });
  const [parametriLuce] = useState<ParametriRegolati | null>(null);
  const [parametriGas, setParametriGas] = useState<ParametriRegolati | null>(null);
  const [areraLuce, setAreraLuce] = useState<ParametriAreraLuce | null>(null);
  const [loadingData, setLoadingData] = useState(true);
  const [loadingZona, setLoadingZona] = useState(false);

  // ── Form state ───────────────────────────────────────────────────────────────
  const [dati, setDati] = useState<DatiCliente>(DATI_DEFAULT);
  const [clienteSeg, setClienteSeg] = useState<ClienteSeg>("domestico");
  const [residenzaSeg, setResidenzaSeg] = useState<ResidenzaSeg>("residente");
  const [potenzaCustom, setPotenzaCustom] = useState(false);

  // Prezzi correnti — sostituiscono spesa_annua come input diretto
  const [prezzoMateriaLuce, setPrezzoMateriaLuce] = useState("");
  const [quotaFissaLuceAtt, setQuotaFissaLuceAtt] = useState("");
  const [prezzoMateriaGas, setPrezzoMateriaGas] = useState("");
  const [quotaFissaGasAtt, setQuotaFissaGasAtt] = useState("");

  // Avanzati
  const [regione, setRegione] = useState("");
  const [showAdvanced, setShowAdvanced] = useState(false);

  // ── Results state ────────────────────────────────────────────────────────────
  const [showResults, setShowResults] = useState(false);
  const [presentationMode, setPresentationMode] = useState(false);
  const [showDettagliato, setShowDettagliato] = useState(false);
  const [clientMode, setClientMode] = useState(false);
  const [selectedCteId, setSelectedCteId] = useState<string | null>(null);
  const [showMaxi, setShowMaxi] = useState(false);
  const [trattativaOfferta, setTrattativaOfferta] = useState<RisultatoOfferta | null>(null);
  const [savingSimulazione, setSavingSimulazione] = useState(false);
  const [saveOk, setSaveOk] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [ocrResult, setOcrResult] = useState<OcrDoneResult | null>(null);

  // ── Helpers ──────────────────────────────────────────────────────────────────
  const set = (patch: Partial<DatiCliente>) => {
    setDati((d) => ({ ...d, ...patch }));
    setShowResults(false);
    setPresentationMode(false);
    setShowDettagliato(false);
    setSelectedCteId(null);
    setSaveOk(false);
    setSaveError(null);
  };

  const resetResults = () => {
    setShowResults(false);
    setPresentationMode(false);
    setShowDettagliato(false);
    setSelectedCteId(null);
    setSaveOk(false);
    setSaveError(null);
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleOcrApply = (patch: any, extracted: any) => {
    const dataPatch: Partial<DatiCliente> = {};
    if (patch.consumoLuce != null) dataPatch.consumo_annuo_kwh = patch.consumoLuce;
    if (patch.potenzaKw != null) dataPatch.potenza_impegnata_kw = patch.potenzaKw;
    if (patch.consumoGas != null) dataPatch.consumo_annuo_smc = patch.consumoGas;
    if (extracted?.tipo && ["luce", "gas", "dual"].includes(extracted.tipo)) {
      dataPatch.tipo_fornitura = extracted.tipo as "luce" | "gas" | "dual";
    }
    set(dataPatch);
    if (patch.prezzoLuce != null) setPrezzoMateriaLuce(String(patch.prezzoLuce));
    if (patch.fissoLuceMese != null) setQuotaFissaLuceAtt(String(patch.fissoLuceMese));
    if (patch.prezzoGas != null) setPrezzoMateriaGas(String(patch.prezzoGas));
    if (patch.fissoGasMese != null) setQuotaFissaGasAtt(String(patch.fissoGasMese));
    if (extracted?.segmento === "business") setClienteSeg("business");
    else if (extracted?.segmento === "family") setClienteSeg("domestico");
    if (extracted?.residente != null) setResidenzaSeg(extracted.residente ? "residente" : "non_residente");
  };

  const handleOcrDone = (result: OcrDoneResult) => {
    setOcrResult(result);
  };

  // ── Initial load ──────────────────────────────────────────────────────────────
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
          .limit(60),
      ]);
      if (!mounted) return;

      setZones((zonesRes.data ?? []) as ZonaRow[]);
      setRawCtes((ctesRes.data ?? []) as unknown as SupabaseCteRow[]);

      const rows = (prezziRes.data ?? []) as { indice: string; valore: number }[];
      const pun = rows.filter((r) => r.indice === "PUN");
      const psv = rows.filter((r) => r.indice === "PSV");
      setPrezziMercato({
        pun_medio: pun.length ? pun.reduce((s, r) => s + r.valore, 0) / pun.length : 0.115,
        psv_medio: psv.length ? psv.reduce((s, r) => s + r.valore, 0) / psv.length : 0.42,
      });

      setLoadingData(false);

      // Parametri ARERA luce da componenti_regolate (fonte di verità dal 2026-04-01)
      if (new Date() >= CUTOVER_COMPONENTI) {
        try {
          const arera = await fetchParametriAreraLuce(supabase, new Date());
          if (mounted) setAreraLuce(arera);
        } catch (e) {
          console.warn("[AnalisiCockpit] componenti_regolate non disponibile:", (e as Error).message);
        }
      }
    }
    load();
    return () => { mounted = false; };
  }, []);

  // ── Load ARERA params on region change ──────────────────────────────────────
  useEffect(() => {
    if (!regione || zones.length === 0) return;
    const zona = zones.find((z) => z.regione === regione);
    if (!zona) return;

    let mounted = true;
    setLoadingZona(true);

    async function loadParametri() {
      if (!zona) return;
      const oggi = new Date().toISOString().slice(0, 10);
      // Luce: parametri da componenti_regolate (areraLuce ha priorità), query parametri_regolati rimossa.
      const gasRes = await (zona.ambito_gas
        ? supabase
            .from("parametri_regolati")
            .select("valori")
            .eq("tipo_fornitura", "gas")
            .eq("ambito", zona.ambito_gas)
            .lte("periodo_da", oggi)
            .gte("periodo_a", oggi)
            .order("periodo_da", { ascending: false })
            .limit(1)
        : Promise.resolve({ data: [] as { valori: unknown }[] }));
      if (!mounted) return;

      const pgRaw = (
        (gasRes as { data: { valori: unknown }[] | null }).data?.[0]?.valori ?? null
      ) as ParametriRegolati | null;

      setParametriGas(zona.ambito_gas ? (pgRaw ?? FALLBACK_GAS) : null);

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

  // ── Derived ───────────────────────────────────────────────────────────────────
  const isBusiness = clienteSeg === "business";
  const tipoCliente = isBusiness
    ? "business"
    : residenzaSeg === "residente" ? "domestico_residente" : "domestico_non_residente";
  const potenze = isBusiness ? POTENZE_BUS : POTENZE_DOM;
  const showLuce = dati.tipo_fornitura === "luce" || dati.tipo_fornitura === "dual";
  const showGas = dati.tipo_fornitura === "gas" || dati.tipo_fornitura === "dual";
  const zonaInfo = zones.find((z) => z.regione === regione);

  // Spesa annua computata: prezzo × consumo + quota × 12
  const spesaAnnuaLuce = useMemo(() => {
    const consumo = dati.consumo_annuo_kwh ?? 0;
    const prezzo = parseFloat(prezzoMateriaLuce) || 0;
    const quota = parseFloat(quotaFissaLuceAtt) || 0;
    return prezzo * consumo + quota * 12;
  }, [dati.consumo_annuo_kwh, prezzoMateriaLuce, quotaFissaLuceAtt]);

  const spesaAnnuaGas = useMemo(() => {
    const consumo = dati.consumo_annuo_smc ?? 0;
    const prezzo = parseFloat(prezzoMateriaGas) || 0;
    const quota = parseFloat(quotaFissaGasAtt) || 0;
    return prezzo * consumo + quota * 12;
  }, [dati.consumo_annuo_smc, prezzoMateriaGas, quotaFissaGasAtt]);

  // ── Results ───────────────────────────────────────────────────────────────────
  const ctes = useMemo(() => rawCtes.map(adaptCte), [rawCtes]);

  const risultatiLuce = useMemo(() => {
    if (!showResults || !showLuce || !(dati.consumo_annuo_kwh ?? 0)) return [];
    // Usa componenti_regolate quando disponibile (data >= 2026-04-01), altrimenti parametri_regolati
    const useArera = areraLuce !== null && new Date() >= CUTOVER_COMPONENTI;
    const effParamLuce: ParametriRegolati = useArera
      ? areraLuce.parametriLuce
      : (parametriLuce ?? FALLBACK_LUCE);
    const effPrezzi: PrezzoMercato = useArera
      ? { ...prezziMercato, pun_medio: areraLuce.prezziMercato.pun_medio }
      : prezziMercato;
    return calcolaConfrontoOfferte(
      {
        ...dati,
        tipo_cliente: tipoCliente,
        prezzo_materia_luce: parseFloat(prezzoMateriaLuce) || undefined,
        quota_fissa_luce_mese: parseFloat(quotaFissaLuceAtt) || undefined,
        prezzo_materia_gas: 0,
        quota_fissa_gas_mese: 0,
      },
      ctes.filter((c) =>
        c.tipo_fornitura === "luce" &&
        (c.segmento_cliente === "entrambi" || c.segmento_cliente === undefined ||
          (clienteSeg === "domestico" ? c.segmento_cliente === "residenziale" : c.segmento_cliente === "business"))
      ),
      effParamLuce,
      null,
      effPrezzi,
    );
  }, [showResults, showLuce, dati, tipoCliente, clienteSeg, prezzoMateriaLuce, quotaFissaLuceAtt, ctes, parametriLuce, prezziMercato, areraLuce]);

  const risultatiGas = useMemo(() => {
    if (!showResults || !showGas || !(dati.consumo_annuo_smc ?? 0)) return [];
    return calcolaConfrontoOfferte(
      {
        ...dati,
        tipo_cliente: tipoCliente,
        prezzo_materia_gas: parseFloat(prezzoMateriaGas) || undefined,
        quota_fissa_gas_mese: parseFloat(quotaFissaGasAtt) || undefined,
        prezzo_materia_luce: 0,
        quota_fissa_luce_mese: 0,
      },
      ctes.filter((c) =>
        c.tipo_fornitura === "gas" &&
        (c.segmento_cliente === "entrambi" || c.segmento_cliente === undefined ||
          (clienteSeg === "domestico" ? c.segmento_cliente === "residenziale" : c.segmento_cliente === "business"))
      ),
      null,
      parametriGas ?? FALLBACK_GAS,
      prezziMercato,
    );
  }, [showResults, showGas, dati, tipoCliente, clienteSeg, prezzoMateriaGas, quotaFissaGasAtt, ctes, parametriGas, prezziMercato]);

  const haDatiAttualiLuce = (parseFloat(prezzoMateriaLuce) || 0) > 0 && (parseFloat(quotaFissaLuceAtt) || 0) >= 0;
  const haDatiAttualiGas  = (parseFloat(prezzoMateriaGas)  || 0) > 0 && (parseFloat(quotaFissaGasAtt)  || 0) >= 0;
  const haSpesaLuce = haDatiAttualiLuce && spesaAnnuaLuce > 0;
  const haSpesaGas  = haDatiAttualiGas  && spesaAnnuaGas  > 0;
  const canCalcola =
    !loadingZona &&
    ((showLuce && !!(dati.consumo_annuo_kwh ?? 0) && haDatiAttualiLuce) ||
      (showGas && !!(dati.consumo_annuo_smc ?? 0) && haDatiAttualiGas));

  const bestLuce = risultatiLuce[0];
  const bestGas = risultatiGas[0];
  const totalRisparmio =
    ((bestLuce?.risparmio_annuo ?? 0) > 0 ? (bestLuce?.risparmio_annuo ?? 0) : 0) +
    ((bestGas?.risparmio_annuo ?? 0) > 0 ? (bestGas?.risparmio_annuo ?? 0) : 0);

  const handleSalvaSimulazione = async () => {
    setSavingSimulazione(true);
    setSaveOk(false);
    setSaveError(null);
    try {
      const { data: tenantId, error: rpcErr } = await supabase.rpc("current_tenant_id");
      if (rpcErr || !tenantId) {
        throw new Error("Sessione non collegata: configura Supabase Auth prima di salvare.");
      }
      const snapshot = [
        ...risultatiLuce.map((r) => ({ ...r, _util: "luce", prezzi_snapshot: prezziMercato })),
        ...risultatiGas.map((r) => ({ ...r, _util: "gas", prezzi_snapshot: prezziMercato })),
      ];
      const spesaTotale = spesaAnnuaLuce + spesaAnnuaGas;
      const { error: insertErr } = await supabase.from("simulazioni").insert({
        tenant_id: tenantId as string,
        dati_input: {
          ...dati,
          prezzo_materia_luce: parseFloat(prezzoMateriaLuce) || undefined,
          quota_fissa_luce_mese: parseFloat(quotaFissaLuceAtt) || undefined,
          prezzo_materia_gas: parseFloat(prezzoMateriaGas) || undefined,
          quota_fissa_gas_mese: parseFloat(quotaFissaGasAtt) || undefined,
          prezzi_mercato: prezziMercato,
        },
        snapshot_offerte: snapshot,
        offerta_scelta_id: selectedCteId ?? null,
        risparmio_annuo: totalRisparmio,
        risparmio_percentuale:
          spesaTotale > 0
            ? Math.round((totalRisparmio / spesaTotale) * 10000) / 100
            : null,
        stato: "bozza",
        bolletta_ocr: ocrResult
          ? { extracted: ocrResult.extracted, raw: ocrResult.raw, source: "gemini+claude", extracted_at: ocrResult.extractedAt }
          : null,
        bolletta_file_path: ocrResult?.filePath ?? null,
      });
      if (insertErr) throw insertErr;
      setSaveOk(true);
    } catch (err: unknown) {
      setSaveError(err instanceof Error ? err.message : "Errore nel salvataggio.");
    } finally {
      setSavingSimulazione(false);
    }
  };

  if (loadingData) {
    return (
      <div className="container mx-auto px-4 py-10 flex items-center justify-center">
        <div className="text-sm text-text-muted">Caricamento offerte…</div>
      </div>
    );
  }

  if (showDettagliato && showResults) {
    return (
      <ConfrontoDettagliatoView
        risultatiLuce={risultatiLuce}
        risultatiGas={risultatiGas}
        ctes={ctes}
        prezziMercato={prezziMercato}
        parametriLuce={parametriLuce}
        parametriGas={parametriGas}
        spesaAnnuaLuce={spesaAnnuaLuce}
        spesaAnnuaGas={spesaAnnuaGas}
        onBack={() => setShowDettagliato(false)}
        clientMode={clientMode}
        onToggleClientMode={() => setClientMode((v) => !v)}
        selectedCteId={selectedCteId}
        onSelectCte={setSelectedCteId}
      />
    );
  }

  // ── Render ────────────────────────────────────────────────────────────────────
  return (
    <div className="mx-auto px-4 sm:px-6 py-5 max-w-screen-xl">
      {showMaxi && showResults && (
        <MaxiTrattativaPanel
          luce={risultatiLuce}
          gas={risultatiGas}
          onClose={() => setShowMaxi(false)}
        />
      )}
      {trattativaOfferta && (
        <TrattativaView
          offerta={trattativaOfferta}
          risultatiLuce={risultatiLuce}
          risultatiGas={risultatiGas}
          spesaAnnuaLuce={spesaAnnuaLuce}
          spesaAnnuaGas={spesaAnnuaGas}
          onClose={() => setTrattativaOfferta(null)}
        />
      )}
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-text-base">Analisi Fornitura</h1>
        {showResults && (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setClientMode((v) => !v)}
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-full border text-sm font-medium transition-all min-h-[44px]",
                clientMode
                  ? "bg-surface-subtle text-text-base border-border-ui shadow-sm"
                  : "bg-white text-text-muted border-border-ui hover:bg-surface-subtle",
              )}
            >
              {clientMode ? (
                <ShieldCheck className="w-4 h-4 text-savings" />
              ) : (
                <ShieldOff className="w-4 h-4" />
              )}
              {clientMode ? "Modalità Cliente" : "Agente"}
            </button>
            <button
              type="button"
              onClick={() => setPresentationMode((v) => !v)}
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-full border text-sm font-medium transition-all min-h-[44px]",
                presentationMode
                  ? "bg-brand text-brand-foreground border-brand shadow-sm"
                  : "bg-white text-text-base border-border-ui hover:bg-surface-subtle",
              )}
            >
              <Eye className="w-4 h-4" />
              {presentationMode ? "Modalità Presentazione" : "Presentazione"}
            </button>
            <button
              type="button"
              onClick={() => setShowMaxi(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-full border border-border-ui bg-white text-text-base text-sm font-medium hover:bg-surface-subtle transition-all min-h-[44px]"
            >
              <Maximize2 className="w-4 h-4" />
              Maxi
            </button>
          </div>
        )}
      </div>

      {/* Two-column: Form + Dropzone */}
      <div className="grid xl:grid-cols-12 gap-5 items-start">
        {/* Form */}
        <div className="xl:col-span-7 bg-white border border-border-ui rounded-xl p-6 shadow-sm space-y-6">

          {/* 1 — Tipo fornitura + Tipo cliente */}
          <div className="grid md:grid-cols-2 gap-5">
            <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase tracking-wider text-text-muted">
                Tipo fornitura
              </label>
              <SegControl
                options={TIPO_FORNITURA_OPT}
                value={dati.tipo_fornitura}
                onChange={(v) => set({ tipo_fornitura: v })}
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase tracking-wider text-text-muted">
                Tipo cliente
              </label>
              <SegControl<ClienteSeg>
                options={[
                  { v: "domestico", l: "Domestico" },
                  { v: "business", l: "Business" },
                ]}
                value={clienteSeg}
                onChange={(v) => {
                  setClienteSeg(v);
                  set({ potenza_impegnata_kw: v === "business" ? 6 : 3 });
                }}
              />
            </div>
          </div>

          {/* 2 — Residenza (solo domestico) */}
          {!isBusiness && (
            <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase tracking-wider text-text-muted">
                Residenza
              </label>
              <SegControl<ResidenzaSeg>
                options={[
                  { v: "residente", l: "Residente" },
                  { v: "non_residente", l: "Non residente" },
                ]}
                value={residenzaSeg}
                onChange={setResidenzaSeg}
              />
            </div>
          )}

          {/* 3 — Potenza disponibile */}
          <div className="space-y-2">
            <label className="text-[10px] font-bold uppercase tracking-wider text-text-muted">
              Potenza disponibile (kW)
            </label>
            <div className="relative">
              <select
                value={potenzaCustom ? "altro" : (dati.potenza_impegnata_kw?.toString() ?? "3")}
                onChange={(e) => {
                  if (e.target.value === "altro") {
                    setPotenzaCustom(true);
                  } else {
                    setPotenzaCustom(false);
                    set({ potenza_impegnata_kw: parseFloat(e.target.value) });
                  }
                }}
                className="w-full h-12 rounded-lg border border-border-ui bg-surface-subtle px-4 text-sm text-text-base focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand appearance-none"
              >
                {potenze.map((p) => (
                  <option key={p} value={p.toString()}>
                    {p} kW
                  </option>
                ))}
                <option value="altro">Altro...</option>
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted pointer-events-none" />
            </div>
            {potenzaCustom && (
              <input
                type="number"
                step="0.5"
                min="0.5"
                value={dati.potenza_impegnata_kw ?? ""}
                onChange={(e) =>
                  set({ potenza_impegnata_kw: parseFloat(e.target.value) || 0 })
                }
                placeholder="kW personalizzato"
                className="h-12 w-full px-4 text-sm rounded-lg border border-brand/40 bg-white focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand placeholder:text-text-placeholder"
              />
            )}
          </div>

          {/* 4 — Blocco LUCE */}
          {showLuce && (
            <div className="bg-surface-subtle border border-border-ui rounded-xl p-5 space-y-4">
              <div className="flex items-center gap-2">
                <Zap className="w-4 h-4 text-yellow-500" />
                <span className="text-sm font-semibold text-text-base">Energia Elettrica</span>
              </div>
              <div className="grid sm:grid-cols-3 gap-4">
                <div className="relative">
                  <label className="absolute -top-2 left-3 bg-white px-1 text-[11px] font-medium text-text-muted">
                    Consumo annuo (kWh)
                  </label>
                  <input
                    type="number"
                    min={0}
                    step={100}
                    value={dati.consumo_annuo_kwh ?? ""}
                    onChange={(e) =>
                      set({ consumo_annuo_kwh: parseInt(e.target.value) || 0 })
                    }
                    className="h-12 w-full px-4 text-sm rounded-lg border border-border-ui bg-white focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand placeholder:text-text-placeholder"
                    placeholder="es. 2700"
                  />
                </div>
                <div className="relative">
                  <label className="absolute -top-2 left-3 bg-white px-1 text-[11px] font-medium text-text-muted">
                    Prezzo materia prima (€/kWh)
                  </label>
                  <input
                    type="number"
                    min={0}
                    step={0.0001}
                    value={prezzoMateriaLuce}
                    onChange={(e) => {
                      setPrezzoMateriaLuce(e.target.value);
                      resetResults();
                    }}
                    className="h-12 w-full px-4 text-sm rounded-lg border border-border-ui bg-white focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand placeholder:text-text-placeholder"
                    placeholder="es. 0.1250"
                  />
                </div>
                <div className="relative">
                  <label className="absolute -top-2 left-3 bg-white px-1 text-[11px] font-medium text-text-muted">
                    Quota fissa (€/mese)
                  </label>
                  <input
                    type="number"
                    min={0}
                    step={0.01}
                    value={quotaFissaLuceAtt}
                    onChange={(e) => {
                      setQuotaFissaLuceAtt(e.target.value);
                      resetResults();
                    }}
                    className="h-12 w-full px-4 text-sm rounded-lg border border-border-ui bg-white focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand placeholder:text-text-placeholder"
                    placeholder="es. 14.50"
                  />
                </div>
              </div>
            </div>
          )}

          {/* 5 — Blocco GAS */}
          {showGas && (
            <div className="bg-surface-subtle border border-border-ui rounded-xl p-5 space-y-4">
              <div className="flex items-center gap-2">
                <Flame className="w-4 h-4 text-orange-500" />
                <span className="text-sm font-semibold text-text-base">Gas Naturale</span>
              </div>
              <div className="grid sm:grid-cols-3 gap-4">
                <div className="relative">
                  <label className="absolute -top-2 left-3 bg-white px-1 text-[11px] font-medium text-text-muted">
                    Consumo annuo (Smc)
                  </label>
                  <input
                    type="number"
                    min={0}
                    step={50}
                    value={dati.consumo_annuo_smc ?? ""}
                    onChange={(e) =>
                      set({ consumo_annuo_smc: parseInt(e.target.value) || 0 })
                    }
                    className="h-12 w-full px-4 text-sm rounded-lg border border-border-ui bg-white focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand placeholder:text-text-placeholder"
                    placeholder="es. 1200"
                  />
                </div>
                <div className="relative">
                  <label className="absolute -top-2 left-3 bg-white px-1 text-[11px] font-medium text-text-muted">
                    Prezzo materia prima (€/Smc)
                  </label>
                  <input
                    type="number"
                    min={0}
                    step={0.001}
                    value={prezzoMateriaGas}
                    onChange={(e) => {
                      setPrezzoMateriaGas(e.target.value);
                      resetResults();
                    }}
                    className="h-12 w-full px-4 text-sm rounded-lg border border-border-ui bg-white focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand placeholder:text-text-placeholder"
                    placeholder="es. 0.420"
                  />
                </div>
                <div className="relative">
                  <label className="absolute -top-2 left-3 bg-white px-1 text-[11px] font-medium text-text-muted">
                    Quota fissa (€/mese)
                  </label>
                  <input
                    type="number"
                    min={0}
                    step={0.01}
                    value={quotaFissaGasAtt}
                    onChange={(e) => {
                      setQuotaFissaGasAtt(e.target.value);
                      resetResults();
                    }}
                    className="h-12 w-full px-4 text-sm rounded-lg border border-border-ui bg-white focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand placeholder:text-text-placeholder"
                    placeholder="es. 12.00"
                  />
                </div>
              </div>
            </div>
          )}

          {/* 6 — Toggle dettagli avanzati */}
          <button
            type="button"
            onClick={() => setShowAdvanced((v) => !v)}
            className="flex items-center gap-1.5 text-sm text-brand hover:text-brand-hover transition-colors"
          >
            <ChevronDown
              className={cn("w-4 h-4 transition-transform", showAdvanced && "rotate-180")}
            />
            {showAdvanced ? "Nascondi dettagli" : "Dettagli per calcolo preciso"}
          </button>

          {/* 7 — Sezione avanzata */}
          {showAdvanced && (
            <div className="pt-4 border-t border-border-ui space-y-5">
              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase tracking-wider text-text-muted">
                  Zona ARERA — regione cliente
                </label>
                <div className="relative">
                  <select
                    value={regione}
                    onChange={(e) => {
                      setRegione(e.target.value);
                      setShowResults(false);
                      setPresentationMode(false);
                    }}
                    className="w-full h-12 rounded-lg border border-border-ui bg-surface-subtle px-4 text-sm text-text-base focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand appearance-none"
                  >
                    <option value="">— Seleziona per calcolo preciso —</option>
                    {zones.map((z) => (
                      <option key={z.id} value={z.regione}>
                        {z.regione} · {z.zona_elettrica}
                        {z.ambito_gas ? ` / ${z.ambito_gas}` : " (no gas)"}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted pointer-events-none" />
                </div>
                {zonaInfo && (
                  <p className="text-[11px] text-text-muted">
                    PUN: {(prezziMercato.pun_medio * 100).toFixed(2)} c€/kWh · PSV:{" "}
                    {prezziMercato.psv_medio.toFixed(3)} €/Smc (media 30 gg)
                  </p>
                )}
              </div>

              {showGas && zonaInfo?.ambito_gas && (
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-text-muted">
                    Uso gas
                  </label>
                  <SegControl
                    options={USI_GAS_OPT}
                    value={dati.uso_gas ?? "riscaldamento"}
                    onChange={(v) => set({ uso_gas: v })}
                  />
                </div>
              )}
            </div>
          )}

          {/* 8 — CTA */}
          <button
            type="button"
            disabled={!canCalcola}
            onClick={() => {
              setShowResults(true);
              setPresentationMode(false);
            }}
            className={cn(
              "w-full h-[52px] rounded-xl font-semibold text-base flex items-center justify-center gap-2 transition-all",
              canCalcola
                ? "bg-brand text-brand-foreground hover:bg-brand-hover shadow-sm"
                : "bg-surface-subtle text-text-muted cursor-not-allowed",
            )}
          >
            <Search className="w-5 h-5" />
            {loadingZona ? "Caricamento parametri…" : "Confronta offerte"}
          </button>
        </div>

        {/* Dropzone bolletta */}
        <div className="xl:col-span-5 min-h-[240px] flex flex-col justify-center">
          <UploadBollettaButton
            dati={{
              segmento: isBusiness ? "business" : "family",
              potenzaKw: dati.potenza_impegnata_kw ?? 3,
              residente: residenzaSeg === "residente",
              canoneRai: false,
              consumoLuce: dati.consumo_annuo_kwh ?? 0,
              prezzoLuce: parseFloat(prezzoMateriaLuce) || 0,
              fissoLuceMese: parseFloat(quotaFissaLuceAtt) || 0,
              consumoGas: dati.consumo_annuo_smc ?? 0,
              prezzoGas: parseFloat(prezzoMateriaGas) || 0,
              fissoGasMese: parseFloat(quotaFissaGasAtt) || 0,
            }}
            onApply={handleOcrApply}
            onOcrDone={handleOcrDone}
          />
        </div>
      </div>

      {/* Results section */}
      {showResults && (
        <div className="mt-8 space-y-6">
          {presentationMode ? (
            <PresentazioneView
              risultatiLuce={risultatiLuce}
              risultatiGas={risultatiGas}
              spesaAnnuaLuce={spesaAnnuaLuce}
              spesaAnnuaGas={spesaAnnuaGas}
              dati={dati}
              parametriLuce={parametriLuce}
              parametriGas={parametriGas}
              onVediDettagliati={() => setShowDettagliato(true)}
            />
          ) : (
            <>
              {/* Summary bar */}
              <div className="grid md:grid-cols-3 gap-4 bg-surface-subtle border border-border-ui rounded-xl p-5">
                <div className="space-y-1">
                  <p className="text-xs text-text-muted">Spesa Attuale (Stimata)</p>
                  <p className="text-2xl font-bold text-text-base">
                    {eur(spesaAnnuaLuce + spesaAnnuaGas)}
                    <span className="text-sm font-normal text-text-muted"> /anno</span>
                  </p>
                </div>
                <div className="md:border-l border-border-ui md:pl-5 space-y-1">
                  <p className="text-xs text-text-muted">Miglior Offerta</p>
                  <p className="font-semibold text-base text-text-base">
                    {bestLuce?.nome ?? bestGas?.nome ?? "—"}
                  </p>
                </div>
                <div className="md:border-l border-border-ui md:pl-5 space-y-1">
                  <p className="text-xs text-text-muted">Risparmio Massimo</p>
                  <p className="text-2xl font-bold text-savings">
                    +{eur(totalRisparmio)}
                    <span className="text-sm font-normal text-text-muted"> /anno</span>
                  </p>
                </div>
              </div>

              {/* Action bar */}
              <div className="flex items-center gap-3 flex-wrap">
                <button
                  type="button"
                  onClick={handleSalvaSimulazione}
                  disabled={savingSimulazione || saveOk}
                  className={cn(
                    "flex items-center gap-2 h-10 px-4 rounded-xl border text-sm font-medium transition-all min-h-[44px]",
                    saveOk
                      ? "bg-savings-subtle border-savings text-savings-subtle-foreground"
                      : "border-border-ui text-text-muted hover:bg-surface-subtle disabled:opacity-50",
                  )}
                >
                  {saveOk ? (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      Salvata
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4" />
                      {savingSimulazione ? "Salvataggio…" : "Salva simulazione"}
                    </>
                  )}
                </button>
                {selectedCteId && (() => {
                  const off =
                    risultatiLuce.find((r) => r.cte_id === selectedCteId) ??
                    risultatiGas.find((r) => r.cte_id === selectedCteId);
                  return off ? (
                    <button
                      type="button"
                      onClick={() => setTrattativaOfferta(off)}
                      className="flex items-center gap-2 h-10 px-4 rounded-xl border border-brand text-sm font-semibold text-brand hover:bg-brand-subtle transition-all min-h-[44px]"
                    >
                      <TrendingUp className="w-4 h-4" />
                      Trattativa
                    </button>
                  ) : null;
                })()}
                {saveError && <p className="text-xs text-spend">{saveError}</p>}
              </div>

              {/* Offer lists */}
              <div className="space-y-8">
                {showLuce && risultatiLuce.length > 0 && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h3 className="font-semibold flex items-center gap-2 text-base text-text-base">
                        <Zap className="w-4 h-4 text-yellow-500" />
                        Classifica Luce
                      </h3>
                      {haSpesaLuce && (bestLuce?.risparmio_annuo ?? 0) > 0 && (
                        <div className="text-right">
                          <p className="text-xs text-text-muted">Miglior risparmio</p>
                          <p className="text-xl font-bold text-savings">
                            {eur(bestLuce?.risparmio_annuo ?? 0)}/anno
                          </p>
                        </div>
                      )}
                    </div>
                    <div className="space-y-3">
                      {risultatiLuce.map((r, i) => (
                        <StandardOfferCard
                          key={r.cte_id}
                          r={r}
                          idx={i}
                          haSpesa={haSpesaLuce}
                          selected={selectedCteId === r.cte_id}
                          onSelect={() => setSelectedCteId(r.cte_id)}
                        />
                      ))}
                    </div>
                  </div>
                )}
                {showLuce && risultatiLuce.length === 0 && (
                  <div className="rounded-xl border-2 border-dashed border-border-ui p-8 text-center text-text-muted text-sm">
                    Nessuna offerta luce attiva nel listino.
                  </div>
                )}

                {showGas && risultatiGas.length > 0 && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h3 className="font-semibold flex items-center gap-2 text-base text-text-base">
                        <Flame className="w-4 h-4 text-orange-500" />
                        Classifica Gas
                      </h3>
                      {haSpesaGas && (bestGas?.risparmio_annuo ?? 0) > 0 && (
                        <div className="text-right">
                          <p className="text-xs text-text-muted">Miglior risparmio</p>
                          <p className="text-xl font-bold text-savings">
                            {eur(bestGas?.risparmio_annuo ?? 0)}/anno
                          </p>
                        </div>
                      )}
                    </div>
                    <div className="space-y-3">
                      {risultatiGas.map((r, i) => (
                        <StandardOfferCard
                          key={r.cte_id}
                          r={r}
                          idx={i}
                          haSpesa={haSpesaGas}
                          selected={selectedCteId === r.cte_id}
                          onSelect={() => setSelectedCteId(r.cte_id)}
                        />
                      ))}
                    </div>
                  </div>
                )}
                {showGas && risultatiGas.length === 0 && (
                  <div className="rounded-xl border-2 border-dashed border-border-ui p-8 text-center text-text-muted text-sm">
                    Nessuna offerta gas attiva nel listino.
                  </div>
                )}
              </div>

              {/* Confronto tecnico */}
              {(risultatiLuce.length > 0 || risultatiGas.length > 0) && (
                <div className="flex justify-end pt-2">
                  <button
                    type="button"
                    onClick={() => setShowDettagliato(true)}
                    className="flex items-center gap-2 h-10 px-4 rounded-xl border border-border-ui text-sm font-medium text-text-muted hover:text-text-base hover:bg-surface-subtle transition-colors"
                  >
                    Confronto Tecnico Dettagliato →
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Empty state */}
      {!showResults && (
        <div className="mt-8 rounded-xl border-2 border-dashed border-border-ui p-14 text-center text-text-muted space-y-3">
          <div className="flex justify-center gap-3 opacity-20">
            <Zap className="w-10 h-10" />
            <Flame className="w-10 h-10" />
          </div>
          <p className="text-sm">
            Inserisci i dati e premi{" "}
            <strong className="text-text-base">Confronta offerte</strong> per vedere
            la classifica.
          </p>
        </div>
      )}
    </div>
  );
}
