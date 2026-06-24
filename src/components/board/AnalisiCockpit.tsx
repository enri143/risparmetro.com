import { useEffect, useMemo, useState } from "react";
import { useNavigate, useLocation, Outlet } from "react-router-dom";
import {
  Eye,
  Maximize2,
  RotateCcw,
  ShieldCheck,
  ShieldOff,
} from "lucide-react";
import { MaxiTrattativaPanel } from "./analisi/MaxiTrattativaPanel";
import { AnalisiStepper } from "./analisi/AnalisiStepper";
import { type OcrDoneResult } from "./analisi/UploadBollettaButton";
import { buildClientePatch, type Extracted as OcrExtracted } from "@/lib/board/ocrBolletta";
import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";
import {
  calcolaConfrontoOfferte,
  type CTE,
  type DatiCliente,
  type ParametriRegolati,
  type PrezzoMercato,
  type RisultatoOfferta,
  type TipoFornitura,
} from "@/lib/board/calcoloOfferte";
import {
  fetchParametriAreraLuce,
  CUTOVER_COMPONENTI,
  type ParametriAreraLuce,
} from "@/lib/calcolo/parametriArera";
import type { ZonaRow, ClienteSeg, ResidenzaSeg } from "./analisi/cockpitShared";

// ── AnalisiCtx — condiviso via Outlet context con i 3 sub-route ───────────────

export type AnalisiCtx = {
  dati: DatiCliente;
  set: (patch: Partial<DatiCliente>) => void;
  clienteSeg: ClienteSeg;
  setClienteSeg: (v: ClienteSeg) => void;
  residenzaSeg: ResidenzaSeg;
  setResidenzaSeg: (v: ResidenzaSeg) => void;
  isBusiness: boolean;
  potenze: number[];
  potenzaCustom: boolean;
  setPotenzaCustom: (v: boolean) => void;
  prezzoMateriaLuce: string;
  setPrezzoMateriaLuce: (v: string) => void;
  quotaFissaLuceAtt: string;
  setQuotaFissaLuceAtt: (v: string) => void;
  prezzoMateriaGas: string;
  setPrezzoMateriaGas: (v: string) => void;
  quotaFissaGasAtt: string;
  setQuotaFissaGasAtt: (v: string) => void;
  showLuce: boolean;
  showGas: boolean;
  regione: string;
  setRegione: (v: string) => void;
  showAdvanced: boolean;
  setShowAdvanced: (v: boolean) => void;
  zones: ZonaRow[];
  zonaInfo: ZonaRow | undefined;
  prezziMercato: PrezzoMercato;
  ctes: CTE[];
  canCalcola: boolean;
  loadingZona: boolean;
  nomeCliente: string; setNomeCliente: (v: string) => void;
  cognomeCliente: string; setCognomeCliente: (v: string) => void;
  ragioneSocialeCliente: string; setRagioneSocialeCliente: (v: string) => void;
  telefonoCliente: string; setTelefonoCliente: (v: string) => void;
  noteCliente: string; setNoteCliente: (v: string) => void;
  indirizzoCliente: string; setIndirizzoCliente: (v: string) => void;
  comuneCliente: string; setComuneCliente: (v: string) => void;
  capCliente: string; setCapCliente: (v: string) => void;
  provinciaCliente: string; setProvinciaCliente: (v: string) => void;
  podCliente: string; setPodCliente: (v: string) => void;
  pdrCliente: string; setPdrCliente: (v: string) => void;
  fornitoreAttualeCliente: string; setFornitoreAttualeCliente: (v: string) => void;
  offertaAttualeCliente: string; setOffertaAttualeCliente: (v: string) => void;
  scadenzaOffertaCliente: string; setScadenzaOffertaCliente: (v: string) => void;
  clienteDettaglioOpen: boolean; setClienteDettaglioOpen: (v: boolean) => void;
  handleOcrApply: (patch: Record<string, unknown>, extracted: OcrExtracted) => void;
  handleOcrDone: (result: OcrDoneResult) => void;
  goToOfferte: () => void;
  resetResults: () => void;
  risultatiLuce: RisultatoOfferta[];
  risultatiGas: RisultatoOfferta[];
  spesaAnnuaLuce: number;
  spesaAnnuaGas: number;
  haSpesaLuce: boolean;
  haSpesaGas: boolean;
  bestLuce: RisultatoOfferta | undefined;
  bestGas: RisultatoOfferta | undefined;
  totalRisparmio: number;
  clientMode: boolean;
  setClientMode: (v: boolean) => void;
  showProvvigioni: boolean;
  setShowProvvigioni: (v: boolean) => void;
  selectedCteId: string | null;
  setSelectedCteId: (id: string | null) => void;
  savingSimulazione: boolean;
  saveOk: boolean;
  saveError: string | null;
  handleSalvaSimulazione: () => Promise<void>;
  trattativaOfferta: RisultatoOfferta | null;
  setTrattativaOfferta: (o: RisultatoOfferta | null) => void;
  parametriLuce: ParametriRegolati | null;
  parametriGas: ParametriRegolati | null;
};

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
  durata_blocco_mesi: number | null;
  priorita: number;
  segmento: "residenziale" | "business" | "entrambi";
  fornitori: { nome: string; colore: string | null } | null;
  componenti_venditore?: { label: string; valore: string }[];
}

interface ProvvigioniRow {
  provvigione_override: number | null;
  provvigione_tipo: string | null;
  mesi_storno_rischio: number | null;
}

type CTEConSegmento = CTE & { segmento_cliente?: "residenziale" | "business" | "entrambi" };

// ── Adapter ───────────────────────────────────────────────────────────────────

function adaptCte(row: SupabaseCteRow, prov?: ProvvigioniRow | null): CTEConSegmento {
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
    provvigione: prov?.provvigione_override ?? undefined,
    provvigione_tipo: (prov?.provvigione_tipo as "fisso" | "percentuale") ?? undefined,
    mesi_storno_rischio: prov?.mesi_storno_rischio ?? undefined,
    priorita: row.priorita,
    segmento_cliente: row.segmento,
  };
}

// ── Constants ─────────────────────────────────────────────────────────────────

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

// ── AnalisiCockpit ────────────────────────────────────────────────────────────

export function AnalisiCockpit() {
  const navigate = useNavigate();
  const location = useLocation();

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
  const [clientMode, setClientMode] = useState(false);
  const [showProvvigioni, setShowProvvigioni] = useState(true);
  const [provvigioniMap, setProvvigioniMap] = useState<Record<string, ProvvigioniRow>>({});
  const [selectedCteId, setSelectedCteId] = useState<string | null>(null);
  const [showMaxi, setShowMaxi] = useState(false);
  const [maxiRevealMode, setMaxiRevealMode] = useState(false);
  const [trattativaOfferta, setTrattativaOfferta] = useState<RisultatoOfferta | null>(null);
  const [savingSimulazione, setSavingSimulazione] = useState(false);
  const [saveOk, setSaveOk] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [ocrResult, setOcrResult] = useState<OcrDoneResult | null>(null);

  // ── Cliente (opzionale, CRM) ──────────────────────────────────────────────────
  const [nomeCliente, setNomeCliente] = useState("");
  const [cognomeCliente, setCognomeCliente] = useState("");
  const [ragioneSocialeCliente, setRagioneSocialeCliente] = useState("");
  const [telefonoCliente, setTelefonoCliente] = useState("");
  const [noteCliente, setNoteCliente] = useState("");
  const [indirizzoCliente, setIndirizzoCliente] = useState("");
  const [comuneCliente, setComuneCliente] = useState("");
  const [capCliente, setCapCliente] = useState("");
  const [provinciaCliente, setProvinciaCliente] = useState("");
  const [podCliente, setPodCliente] = useState("");
  const [pdrCliente, setPdrCliente] = useState("");
  const [fornitoreAttualeCliente, setFornitoreAttualeCliente] = useState("");
  const [offertaAttualeCliente, setOffertaAttualeCliente] = useState("");
  const [scadenzaOffertaCliente, setScadenzaOffertaCliente] = useState("");
  const [clienteDettaglioOpen, setClienteDettaglioOpen] = useState(false);

  // ── Helpers ──────────────────────────────────────────────────────────────────
  const set = (patch: Partial<DatiCliente>) => {
    setDati((d) => ({ ...d, ...patch }));
    setSelectedCteId(null);
    setSaveOk(false);
    setSaveError(null);
  };

  const resetResults = () => {
    navigate("/board/analisi/dati", { replace: true });
    setSelectedCteId(null);
    setSaveOk(false);
    setSaveError(null);
  };

  const handleOcrApply = (patch: Record<string, unknown>, extracted: OcrExtracted) => {
    const dataPatch: Partial<DatiCliente> = {};
    if (patch.consumoLuce != null) dataPatch.consumo_annuo_kwh = patch.consumoLuce as number;
    if (patch.potenzaKw != null) dataPatch.potenza_impegnata_kw = patch.potenzaKw as number;
    if (patch.consumoGas != null) dataPatch.consumo_annuo_smc = patch.consumoGas as number;
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

    const cliPatch = buildClientePatch(extracted);
    if (cliPatch.nome) setNomeCliente(cliPatch.nome);
    if (cliPatch.cognome) setCognomeCliente(cliPatch.cognome);
    if (cliPatch.ragione_sociale) {
      setRagioneSocialeCliente(cliPatch.ragione_sociale);
      if (!nomeCliente && !cliPatch.nome) setNomeCliente(cliPatch.ragione_sociale);
    }
    if (cliPatch.indirizzo) setIndirizzoCliente(cliPatch.indirizzo);
    if (cliPatch.comune) setComuneCliente(cliPatch.comune);
    if (cliPatch.cap) setCapCliente(cliPatch.cap);
    if (cliPatch.provincia) setProvinciaCliente(cliPatch.provincia);
    if (cliPatch.pod) setPodCliente(cliPatch.pod);
    if (cliPatch.pdr) setPdrCliente(cliPatch.pdr);
    if (cliPatch.fornitore_attuale) setFornitoreAttualeCliente(cliPatch.fornitore_attuale);
    if (cliPatch.offerta_attuale) setOffertaAttualeCliente(cliPatch.offerta_attuale);
    if (cliPatch.scadenza_offerta) setScadenzaOffertaCliente(cliPatch.scadenza_offerta);
    const hasAnag = !!(
      cliPatch.cognome || cliPatch.ragione_sociale || cliPatch.indirizzo ||
      cliPatch.pod || cliPatch.pdr || cliPatch.fornitore_attuale ||
      cliPatch.offerta_attuale || cliPatch.scadenza_offerta
    );
    if (hasAnag) setClienteDettaglioOpen(true);
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
          .select("id, nome, tipo_fornitura, tipo_prezzo, prezzo_energia_luce, spread_luce, quota_fissa_luce, prezzo_energia_gas, spread_gas, quota_fissa_gas, durata_blocco_mesi, priorita, segmento, componenti_venditore, fornitori(nome, colore)")
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

  // ── Provvigioni — caricamento SOLO in modalità agente ────────────────────────
  useEffect(() => {
    if (clientMode) {
      setProvvigioniMap({});
      return;
    }
    if (rawCtes.length === 0) return;
    async function loadProvvigioni() {
      const { data } = await supabase
        .from("cte")
        .select("id, provvigione_override, provvigione_tipo, mesi_storno_rischio")
        .eq("attiva", true);
      if (!data) return;
      const map: Record<string, ProvvigioniRow> = {};
      for (const row of data as (ProvvigioniRow & { id: string })[]) {
        map[row.id] = {
          provvigione_override: row.provvigione_override,
          provvigione_tipo: row.provvigione_tipo,
          mesi_storno_rischio: row.mesi_storno_rischio,
        };
      }
      setProvvigioniMap(map);
    }
    void loadProvvigioni();
  }, [clientMode, rawCtes]);

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

  const isOnResults = location.pathname.endsWith("/offerte") || location.pathname.endsWith("/presenta");
  const isPresenta = location.pathname.endsWith("/presenta");

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
  const ctes = useMemo(
    () => rawCtes.map((row) => adaptCte(row, clientMode ? null : (provvigioniMap[row.id] ?? null))),
    [rawCtes, provvigioniMap, clientMode],
  );

  const risultatiLuce = useMemo(() => {
    if (!showLuce || !(dati.consumo_annuo_kwh ?? 0)) return [];
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
  }, [showLuce, dati, tipoCliente, clienteSeg, prezzoMateriaLuce, quotaFissaLuceAtt, ctes, parametriLuce, prezziMercato, areraLuce]);

  const risultatiGas = useMemo(() => {
    if (!showGas || !(dati.consumo_annuo_smc ?? 0)) return [];
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
  }, [showGas, dati, tipoCliente, clienteSeg, prezzoMateriaGas, quotaFissaGasAtt, ctes, parametriGas, prezziMercato]);

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

      // Upsert cliente dai campi del form (solo valori non-vuoti — anti-wipe)
      let clienteId: string | null = null;
      const cliRecord: Record<string, string> = {};
      if (nomeCliente.trim()) cliRecord.nome = nomeCliente.trim();
      if (cognomeCliente.trim()) cliRecord.cognome = cognomeCliente.trim();
      if (ragioneSocialeCliente.trim()) cliRecord.ragione_sociale = ragioneSocialeCliente.trim();
      if (telefonoCliente.trim()) cliRecord.telefono = telefonoCliente.trim();
      if (indirizzoCliente.trim()) cliRecord.indirizzo = indirizzoCliente.trim();
      if (comuneCliente.trim()) cliRecord.comune = comuneCliente.trim();
      if (capCliente.trim()) cliRecord.cap = capCliente.trim();
      if (provinciaCliente.trim()) cliRecord.provincia = provinciaCliente.trim();
      if (podCliente.trim()) cliRecord.pod = podCliente.trim();
      if (pdrCliente.trim()) cliRecord.pdr = pdrCliente.trim();
      if (fornitoreAttualeCliente.trim()) cliRecord.fornitore_attuale = fornitoreAttualeCliente.trim();
      if (offertaAttualeCliente.trim()) cliRecord.offerta_attuale = offertaAttualeCliente.trim();
      if (scadenzaOffertaCliente.trim()) cliRecord.scadenza_offerta = scadenzaOffertaCliente.trim();

      if (Object.keys(cliRecord).length > 0) {
        const telTrim = cliRecord.telefono ?? "";
        if (telTrim) {
          const { data: esistente } = await supabase
            .from("clienti")
            .select("id")
            .eq("telefono", telTrim)
            .limit(1)
            .maybeSingle();
          if (esistente) {
            clienteId = (esistente as { id: string }).id;
            await supabase.from("clienti").update(cliRecord).eq("id", clienteId);
          }
        }
        if (!clienteId) {
          const { data: nuovo } = await supabase
            .from("clienti")
            .insert({
              tenant_id: tenantId as string,
              ...cliRecord,
              segmento: isBusiness ? "business" : "residenziale",
            })
            .select("id")
            .single();
          if (nuovo) clienteId = (nuovo as { id: string }).id;
        }
      }

      const snapshot = [
        ...risultatiLuce.map((r) => ({ ...r, _util: "luce", prezzi_snapshot: prezziMercato })),
        ...risultatiGas.map((r) => ({ ...r, _util: "gas", prezzi_snapshot: prezziMercato })),
      ];
      const spesaTotale = spesaAnnuaLuce + spesaAnnuaGas;
      const { error: insertErr } = await supabase.from("simulazioni").insert({
        tenant_id: tenantId as string,
        cliente_id: clienteId,
        dati_input: {
          ...dati,
          prezzo_materia_luce: parseFloat(prezzoMateriaLuce) || undefined,
          quota_fissa_luce_mese: parseFloat(quotaFissaLuceAtt) || undefined,
          prezzo_materia_gas: parseFloat(prezzoMateriaGas) || undefined,
          quota_fissa_gas_mese: parseFloat(quotaFissaGasAtt) || undefined,
          prezzi_mercato: prezziMercato,
          nota_cliente: noteCliente.trim() || null,
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
          ? (() => {
              const rawArr = Array.isArray(ocrResult.raw)
                ? (ocrResult.raw as Array<{ source?: string }>)
                : [];
              const sources = [...new Set(rawArr.map((r) => r?.source).filter((s): s is string => !!s))];
              return { extracted: ocrResult.extracted, raw: ocrResult.raw, source: sources.join('+') || 'ocr', extracted_at: ocrResult.extractedAt };
            })()
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

  // ── Outlet context ────────────────────────────────────────────────────────────
  const ctx: AnalisiCtx = {
    dati,
    set,
    clienteSeg,
    setClienteSeg,
    residenzaSeg,
    setResidenzaSeg,
    isBusiness,
    potenze,
    potenzaCustom,
    setPotenzaCustom,
    prezzoMateriaLuce,
    setPrezzoMateriaLuce,
    quotaFissaLuceAtt,
    setQuotaFissaLuceAtt,
    prezzoMateriaGas,
    setPrezzoMateriaGas,
    quotaFissaGasAtt,
    setQuotaFissaGasAtt,
    showLuce,
    showGas,
    regione,
    setRegione,
    showAdvanced,
    setShowAdvanced,
    zones,
    zonaInfo,
    prezziMercato,
    ctes,
    canCalcola,
    loadingZona,
    nomeCliente, setNomeCliente,
    cognomeCliente, setCognomeCliente,
    ragioneSocialeCliente, setRagioneSocialeCliente,
    telefonoCliente, setTelefonoCliente,
    noteCliente, setNoteCliente,
    indirizzoCliente, setIndirizzoCliente,
    comuneCliente, setComuneCliente,
    capCliente, setCapCliente,
    provinciaCliente, setProvinciaCliente,
    podCliente, setPodCliente,
    pdrCliente, setPdrCliente,
    fornitoreAttualeCliente, setFornitoreAttualeCliente,
    offertaAttualeCliente, setOffertaAttualeCliente,
    scadenzaOffertaCliente, setScadenzaOffertaCliente,
    clienteDettaglioOpen, setClienteDettaglioOpen,
    handleOcrApply,
    handleOcrDone,
    goToOfferte: () => navigate("/board/analisi/offerte"),
    resetResults,
    risultatiLuce,
    risultatiGas,
    spesaAnnuaLuce,
    spesaAnnuaGas,
    haSpesaLuce,
    haSpesaGas,
    bestLuce,
    bestGas,
    totalRisparmio,
    clientMode,
    setClientMode,
    showProvvigioni,
    setShowProvvigioni,
    selectedCteId,
    setSelectedCteId,
    savingSimulazione,
    saveOk,
    saveError,
    handleSalvaSimulazione,
    trattativaOfferta,
    setTrattativaOfferta,
    parametriLuce,
    parametriGas,
  };

  // ── Render ────────────────────────────────────────────────────────────────────
  return (
    <div className="mx-auto px-4 sm:px-6 py-5 max-w-screen-xl">
      <AnalisiStepper
        hasRisultati={risultatiLuce.length > 0 || risultatiGas.length > 0}
        hasTrattativa={trattativaOfferta != null}
      />
      {showMaxi && isOnResults && (
        <MaxiTrattativaPanel
          luce={risultatiLuce}
          gas={risultatiGas}
          onClose={() => setShowMaxi(false)}
          revealMode={maxiRevealMode}
        />
      )}
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-text-base">Analisi Fornitura</h1>
        {isOnResults && (
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
              onClick={() => navigate(isPresenta ? "/board/analisi/offerte" : "/board/analisi/presenta")}
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-full border text-sm font-medium transition-all min-h-[44px]",
                isPresenta
                  ? "bg-brand text-brand-foreground border-brand shadow-sm"
                  : "bg-white text-text-base border-border-ui hover:bg-surface-subtle",
              )}
            >
              <Eye className="w-4 h-4" />
              {isPresenta ? "Modalità Presentazione" : "Presentazione"}
            </button>
            <button
              type="button"
              onClick={() => { setMaxiRevealMode(false); setShowMaxi(true); }}
              className="flex items-center gap-2 px-4 py-2 rounded-full border border-border-ui bg-white text-text-base text-sm font-medium hover:bg-surface-subtle transition-all min-h-[44px]"
            >
              <Maximize2 className="w-4 h-4" />
              Maxi
            </button>
            {totalRisparmio > 0 && (
              <button
                type="button"
                onClick={() => { setMaxiRevealMode(true); setShowMaxi(true); }}
                className="flex items-center gap-2 px-4 py-2 rounded-full border border-border-ui bg-white text-text-base text-sm font-medium hover:bg-surface-subtle transition-all min-h-[44px]"
              >
                <RotateCcw className="w-4 h-4" />
                Gira il tablet
              </button>
            )}
          </div>
        )}
      </div>

      <Outlet context={ctx} />
    </div>
  );
}
