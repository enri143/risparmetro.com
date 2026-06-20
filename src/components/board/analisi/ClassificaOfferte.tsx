import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { TrendingUp, Lock, Calendar, ShieldCheck, AlertTriangle, ChevronDown, BarChart3, Share2, Save, Loader2, FileDown, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { CTE, DatiCliente, Impostazioni, NoteCliente, RisultatoOfferta } from "@/lib/board/types";
import { classificaCTE, simulaBollettaGas, simulaBollettaLuce } from "@/lib/board/calcoli";
import { eur, eur4, pct } from "@/lib/board/formatters";
import { generaImmagineRisultati, condividiOScarica, generaPDF } from "@/lib/board/share";
import logoUrl from "@/assets/logo-new.png";
import { SimulazioneBollettaView } from "./SimulazioneBolletta";
import { ConfrontoModal } from "./ConfrontoModal";
import { Proiezione12Mesi } from "./Proiezione12Mesi";
import { FiltriRapidiChips, applicaFiltri, useFiltriRapidi, isVerde } from "./FiltriRapidiChips";
import { useNegotiationDiscount } from "@/hooks/useNegotiationDiscount";
import { useShowIva } from "@/hooks/useShowIva";
import { aliquotaIvaCliente, applicaIva, etichettaIva } from "@/lib/board/iva";
import { clearDraft } from "@/hooks/useDraftAutosave";
import { BOARD_AUTH_KEY, BOARD_PWD_KEY } from "@/pages/BoardLogin";
import { Link } from "react-router-dom";
import { useSgProvvigioni, calcolaProvvigioneSg } from "@/hooks/useSgProvvigioni";

const MEDAL_BORDERS = ["border-l-green-500 bg-green-50/40", "border-l-blue-500", "border-l-orange-500"];
const MEDALS = ["🥇", "🥈", "🥉"];

/** Clona una CTE applicando lo sconto trattativa (in memoria, no DB). */
function applyDiscountToCte(cte: CTE, discount: number): CTE {
  if (!discount || discount <= 0) return cte;
  const factor = 1 - discount / 100;
  return {
    ...cte,
    prezzo_fisso: cte.prezzo_fisso != null ? cte.prezzo_fisso * factor : cte.prezzo_fisso,
    spread: cte.spread != null ? cte.spread * factor : cte.spread,
  };
}

const leggiErroreFunzione = async (error: unknown) => {
  const context = (error as { context?: Response })?.context;
  if (context) {
    const body = await context.clone().json().catch(() => null) as { error?: string } | null;
    if (body?.error === "unauthorized") return "Sessione scaduta: effettua di nuovo l'accesso alla board";
    if (body?.error) return body.error;
  }
  return error instanceof Error ? error.message : "Errore sconosciuto";
};

function OffertaCard({ r, idx, dati, imp, selected, onToggleSelect, presentazione, debug, showProvvigioni, sgMap }: {
  r: RisultatoOfferta; idx: number; dati: DatiCliente; imp: Impostazioni;
  selected: boolean; onToggleSelect: () => void; presentazione?: boolean; debug?: boolean; showProvvigioni?: boolean;
  sgMap?: Record<string, import("@/hooks/useSgProvvigioni").SgScaglione[]>;
}) {
  const [open, setOpen] = useState(false);
  const [openProv, setOpenProv] = useState(false);
  const showIva = useShowIva();
  const isLuce = r.cte.tipo === "luce";
  const sim = useMemo(() => isLuce ? simulaBollettaLuce(r.cte, dati, imp) : simulaBollettaGas(r.cte, dati, imp), [r.cte, dati, imp, isLuce]);
  const negativo = r.risparmio < 0;
  const border = negativo ? "border-l-red-500 bg-red-50/40" : (MEDAL_BORDERS[idx] ?? "border-l-border");
  const verde = isVerde(r.cte);
  const aliq = aliquotaIvaCliente(dati, imp);
  const risparmioAbs = Math.abs(r.risparmio);
  const risparmioMostrato = showIva ? applicaIva(risparmioAbs, aliq) : risparmioAbs;
  const risparmioMeseMostrato = risparmioMostrato / 12;
  const consumoTot = isLuce ? dati.consumoLuce : dati.consumoGas;
  const provUna = Number(r.cte.provvigione_una_tantum ?? 0);
  const provRic = Number(r.cte.provvigione_ricorrente_per_1000 ?? 0);
  const provRicAnnua = provRic * (consumoTot / 1000);
  const hasProv = provUna > 0 || provRic > 0;
  const codice = r.cte.codice_offerta?.trim();
  const sgProv = useMemo(
    () => (codice && sgMap ? calcolaProvvigioneSg(sgMap[codice], consumoTot) : null),
    [codice, sgMap, consumoTot],
  );

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.05 }}>
      <Card className={cn("border-l-4 overflow-hidden", border)}>
        <div className="p-4 space-y-3">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-start gap-2 min-w-0">
              {!presentazione && <Checkbox checked={selected} onCheckedChange={onToggleSelect} className="mt-1" />}
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-lg">{!negativo && idx < 3 ? MEDALS[idx] : ""}</span>
                  <h4 className="font-semibold truncate">{r.cte.nome}</h4>
                  {verde && <span title="Energia verde 100%">🌿</span>}
                  <Badge variant="secondary" className={cn("text-[10px]", r.cte.tipo_prezzo === "index" ? "bg-blue-100 text-blue-700" : "bg-green-100 text-green-700")}>
                    {r.cte.tipo_prezzo === "index" ? <><TrendingUp className="w-3 h-3 mr-1" />INDEX</> : <><Lock className="w-3 h-3 mr-1" />FISSO</>}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">{r.cte.fornitore}</p>
              </div>
            </div>
          </div>
          {debug && (
            <div className="font-mono text-[10px] bg-muted/60 border rounded px-2 py-1 text-muted-foreground overflow-x-auto whitespace-nowrap">
              fisso: {r.cte.commercializzazione_anno.toFixed(2)} + materia: {((r.costoOfferta - r.cte.commercializzazione_anno - (r.cte.cvv_variabile ?? 0) * (isLuce ? dati.consumoLuce : dati.consumoGas))).toFixed(2)} + cvv: {((r.cte.cvv_variabile ?? 0) * (isLuce ? dati.consumoLuce : dati.consumoGas)).toFixed(2)} = {r.costoOfferta.toFixed(2)} € · perdite ×{imp.perdite_rete}
            </div>
          )}

          <div className="grid grid-cols-2 gap-2 text-sm">
            <div className="min-w-0">
              <div className="text-xs text-muted-foreground">Prezzo stimato</div>
              {r.prezziPerFascia ? (
                <div className="font-medium text-xs leading-tight break-words">
                  F1: {eur4(r.prezziPerFascia.f1)} · F2: {eur4(r.prezziPerFascia.f2)} · F3: {eur4(r.prezziPerFascia.f3)} €/kWh
                </div>
              ) : (
                <div className="font-medium break-words">{eur4(r.prezzoEffettivo)} €/{isLuce ? "kWh" : "Smc"}</div>
              )}
              {isLuce && (r.cte.dispacciamento_kwh ?? 0) > 0 && (
                <div className="text-[10px] text-muted-foreground mt-0.5 break-words">
                  Include TIDE: +{eur4(r.cte.dispacciamento_kwh ?? 0)} €/kWh
                </div>
              )}
            </div>
            <div className="min-w-0">
              <div className="text-xs text-muted-foreground">Fisso mensile</div>
              <div className="font-medium">{eur(r.cte.commercializzazione_anno / 12)}/mese</div>
            </div>
          </div>

          <div className={cn("rounded-lg p-3 space-y-1", negativo ? "bg-red-100/60" : "bg-green-100/40")}>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Costo annuo offerta</span>
              <span className="font-medium">{eur(r.costoOfferta)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Costo annuo cliente</span>
              <span className="font-medium">{eur(r.costoCliente)}</span>
            </div>
            <div className="flex items-center justify-between gap-2 pt-2 border-t border-border/60">
              <span className={cn("font-semibold shrink-0", negativo ? "text-red-700" : "text-green-700")}>
                {negativo ? "⛔ Costa di più" : "Risparmio annuo"}
              </span>
              <div className="text-right min-w-0 flex-1">
                <div className="flex items-baseline gap-1 justify-end flex-wrap">
                  <div className={cn("font-bold text-lg", negativo ? "text-red-700" : "text-green-700")}>
                    +{eur(risparmioMostrato)}
                  </div>
                  {showIva && (
                    <span className="text-[10px] text-muted-foreground font-normal">
                      {etichettaIva(aliq)}
                    </span>
                  )}
                </div>
                <div className={cn("text-xs", negativo ? "text-red-700" : "text-green-700")}>
                  {negativo ? "+" : "−"}{pct(Math.abs(r.risparmioPct))} · +{eur(risparmioMeseMostrato)}/mese
                </div>
                {showProvvigioni && !presentazione && (sgProv || hasProv) && (
                  <div className="mt-1 leading-tight text-right max-w-full">
                    {sgProv ? (
                      <>
                        <button
                          type="button"
                          onClick={() => setOpenProv((v) => !v)}
                          className="text-[10px] text-foreground/80 hover:text-foreground font-mono break-words whitespace-normal text-right w-full"
                          title={`Codice ${codice} · scaglione ${sgProv.scaglioneLabel}`}
                        >
                          💶 <strong>{eur(sgProv.acquisizione)} acq. + {eur(sgProv.sepa)} RID</strong> = {eur(sgProv.unaTantum)} una tantum
                          <span className="block text-[10px] opacity-90 break-words">
                            + ricorrente <strong>{eur(sgProv.ricorrenteAnnua)}/anno</strong> <span className="opacity-70">(sc. {sgProv.scaglioneLabel} · {consumoTot.toLocaleString("it-IT")} {isLuce ? "kWh" : "Smc"})</span>
                          </span>
                          {sgProv.integrativo > 0 && (
                            <span className="block text-[9px] opacity-60">+ integrativo {eur(sgProv.integrativo)} (non incluso)</span>
                          )}
                          <ChevronDown className={cn("inline w-3 h-3 ml-0.5 transition-transform", openProv && "rotate-180")} />
                        </button>
                        {openProv && sgProv.tuttiScaglioni.length > 1 && (
                          <div className="mt-1 rounded border bg-background/80 p-1.5 text-[9px] font-mono text-left overflow-x-auto">
                            <div className="text-muted-foreground mb-0.5">Tutti gli scaglioni ({codice}):</div>
                            {sgProv.tuttiScaglioni.map((s, i) => {
                              const una = (s.acquisizione ?? 0) + (s.sepa ?? 0);
                              const ricUnit = (s.variabile_anticipato ?? 0) + (s.variabile ?? 0);
                              const isApp = s === sgProv.scaglioneApplicato;
                              const da = s.scaglione_da ?? 0;
                              const a = s.scaglione_a == null || s.scaglione_a >= 1_000_000 || s.scaglione_a === 0 ? "∞" : s.scaglione_a.toLocaleString("it-IT");
                              return (
                                <div key={i} className={cn("flex justify-between gap-2 whitespace-nowrap", isApp && "text-foreground font-semibold")}>
                                  <span>{isApp ? "▶ " : "  "}{da.toLocaleString("it-IT")}–{a}</span>
                                  <span>{eur(una)} + {eur(ricUnit * consumoTot)} ric.</span>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </>
                    ) : (
                      <div className="text-[9px] text-muted-foreground font-mono break-words whitespace-normal" title="Provvigione agente: una tantum + ricorrente proporzionale al consumo">
                        💶 {provUna > 0 ? `${eur(provUna)} una tantum` : ""}
                        {provUna > 0 && provRic > 0 ? " + " : ""}
                        {provRic > 0 ? `${eur(provRic)}/1000 ${isLuce ? "kWh" : "Smc"} (≈${eur(provRicAnnua)}/anno)` : ""}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
            {r.cte.tipo_prezzo === "index" && <span className="flex items-center gap-1"><AlertTriangle className="w-3 h-3" />Prezzo variabile ({r.cte.indice})</span>}
            {r.cte.validita && <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />Val. {r.cte.validita}</span>}
            {!r.cte.penale_recesso && <span className="flex items-center gap-1 text-green-700"><ShieldCheck className="w-3 h-3" />Nessuna penale</span>}
            {r.cte.penale_recesso && <span className="flex items-center gap-1 text-orange-700"><AlertTriangle className="w-3 h-3" />Penale recesso</span>}
          </div>

          <Button variant="ghost" size="sm" onClick={() => setOpen(!open)} className="w-full">
            <ChevronDown className={cn("w-4 h-4 mr-1 transition-transform", open && "rotate-180")} />
            {open ? "Nascondi" : "Vedi"} simulazione bolletta
          </Button>

          <AnimatePresence initial={false}>
            {open && (
              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}>
                <SimulazioneBollettaView sim={sim} cte={r.cte} dati={dati} />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </Card>
    </motion.div>
  );
}

export function ClassificaOfferte({ ctes, dati, imp, noteCliente, onSaved, presentazione, filtroTipo = "entrambi", showProvvigioni }: { ctes: CTE[]; dati: DatiCliente; imp: Impostazioni; noteCliente: NoteCliente; onSaved?: () => void; presentazione?: boolean; filtroTipo?: "entrambi" | "luce" | "gas"; showProvvigioni?: boolean }) {
  const { discount, debug } = useNegotiationDiscount();
  const showIva = useShowIva();
  const sgMap = useSgProvvigioni();
  const aliqGlobal = aliquotaIvaCliente(dati, imp);
  const ctesAdj = useMemo(() => ctes.map((c) => applyDiscountToCte(c, discount)), [ctes, discount]);

  const luceFull = useMemo(() => filtroTipo === "gas" ? [] : classificaCTE(ctesAdj, dati, imp, "luce"), [ctesAdj, dati, imp, filtroTipo]);
  const gasFull = useMemo(() => filtroTipo === "luce" ? [] : classificaCTE(ctesAdj, dati, imp, "gas"), [ctesAdj, dati, imp, filtroTipo]);

  const { filtri: filtriLuce, setFiltri: setFiltriLuce } = useFiltriRapidi("luce");
  const { filtri: filtriGas, setFiltri: setFiltriGas } = useFiltriRapidi("gas");

  const luce = useMemo(() => applicaFiltri(luceFull, filtriLuce), [luceFull, filtriLuce]);
  const gas = useMemo(() => applicaFiltri(gasFull, filtriGas), [gasFull, filtriGas]);

  const [selected, setSelected] = useState<string[]>([]);
  const [confronto, setConfronto] = useState<RisultatoOfferta[] | null>(null);
  const [sharing, setSharing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [generatingPdf, setGeneratingPdf] = useState(false);

  const toggle = (id: string) => setSelected((s) => s.includes(id) ? s.filter(x => x !== id) : (s.length >= 2 ? [s[1], id] : [...s, id]));

  const apriConfronto = () => {
    const all = [...luce, ...gas];
    const sel = selected.map((id) => all.find((r) => r.cte.id === id)).filter(Boolean) as RisultatoOfferta[];
    if (sel.length === 2) setConfronto(sel);
  };

  const esportaPdf = async () => {
    setGeneratingPdf(true);
    try {
      await generaPDF(luce, gas, dati, noteCliente, logoUrl, imp);
      toast.success("PDF generato");
    } catch (e) {
      toast.error("Errore nella generazione del PDF");
      console.error(e);
    } finally {
      setGeneratingPdf(false);
    }
  };

  const condividi = async () => {
    setSharing(true);
    try {
      const blob = await generaImmagineRisultati(luce, gas, dati);
      const res = await condividiOScarica(blob, `confronto-offerte-${Date.now()}.png`);
      toast.success(res === "shared" ? "Condiviso!" : "Immagine scaricata");
    } catch (e) {
      toast.error("Errore nella generazione dell'immagine");
      console.error(e);
    } finally {
      setSharing(false);
    }
  };

  const salva = async () => {
    setSaving(true);
    try {
      const slim = (items: RisultatoOfferta[]) => items.slice(0, 5).map((r) => ({
        nome: r.cte.nome, fornitore: r.cte.fornitore, costoOfferta: r.costoOfferta,
        risparmio: r.risparmio, risparmioPct: r.risparmioPct, prezzoEffettivo: r.prezzoEffettivo,
      }));
      const password = sessionStorage.getItem(BOARD_PWD_KEY) ?? "";
      if (!password) {
        sessionStorage.removeItem(BOARD_AUTH_KEY);
        sessionStorage.removeItem(BOARD_PWD_KEY);
        window.location.assign("/board/login");
        return;
      }
      const row = {
        nome_cliente: noteCliente.nomeCliente || null,
        telefono: noteCliente.telefono || null,
        note: noteCliente.note || null,
        tipo_utenza: dati.segmento === "family" ? "domestico" : "business",
        consumo_luce_kwh: Math.round(Number(dati.consumoLuce) || 0),
        prezzo_luce_attuale: dati.prezzoLuce,
        fisso_luce_mese: dati.fissoLuceMese,
        consumo_gas_smc: Math.round(Number(dati.consumoGas) || 0),

        prezzo_gas_attuale: dati.prezzoGas,
        fisso_gas_mese: dati.fissoGasMese,
        potenza_kw: dati.potenzaKw,
        residente: dati.residente,
        classifica_luce: slim(luce),
        classifica_gas: slim(gas),
        miglior_risparmio_luce: luce[0]?.risparmio ?? 0,
        miglior_risparmio_gas: gas[0]?.risparmio ?? 0,
      };
      const { data, error } = await supabase.functions.invoke("board-storico", { body: { action: "insert", password, row } });
      if (error) throw new Error(await leggiErroreFunzione(error));
      if (data?.error) throw new Error(data.error);
      toast.success("Analisi salvata nello storico");
      clearDraft(dati.segmento);
      onSaved?.();
    } catch (e) {
      console.error("[salva storico]", e);
      const msg = e instanceof Error ? e.message : "Errore sconosciuto";
      toast.error(`Errore nel salvataggio: ${msg}`);
    } finally {

      setSaving(false);
    }
  };

  const [expandLuce, setExpandLuce] = useState(false);
  const [expandGas, setExpandGas] = useState(false);

  const renderSezione = (
    title: string,
    items: RisultatoOfferta[],
    fullCount: number,
    icon: string,
    expanded: boolean,
    setExpanded: (v: boolean) => void,
    tipo: "luce" | "gas",
    filtri: Parameters<typeof FiltriRapidiChips>[0]["filtri"],
    setFiltri: Parameters<typeof FiltriRapidiChips>[0]["onChange"],
  ) => {
    const best = items[0];
    const visible = expanded ? items : items.slice(0, 3);
    const extra = items.length - 3;
    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold flex items-center gap-2">{icon} Classifica {title}</h3>
          {best && best.risparmio > 0 && (
            <div className="text-right">
              <div className="text-xs text-muted-foreground">Migliore risparmio</div>
              <div className="text-xl font-bold text-green-600">{eur(best.risparmio)}/anno</div>
            </div>
          )}
        </div>
        <FiltriRapidiChips tipo={tipo} filtri={filtri} onChange={setFiltri} total={fullCount} shown={items.length} />
        {items.length === 0 && <p className="text-sm text-muted-foreground">Nessuna offerta {title} disponibile con i filtri correnti.</p>}
        <div className="space-y-3">
          {visible.map((r, i) => (
            <OffertaCard key={r.cte.id} r={r} idx={i} dati={dati} imp={imp}
              selected={selected.includes(r.cte.id)} onToggleSelect={() => toggle(r.cte.id)}
              presentazione={presentazione} debug={debug} showProvvigioni={showProvvigioni} sgMap={sgMap} />
          ))}
        </div>
        {best && (
          <Proiezione12Mesi tipo={tipo} cte={best.cte} dati={dati} imp={imp} classifica={items} />
        )}
        {extra > 0 && (
          <Button variant="outline" size="sm" className="w-full min-h-[44px]" onClick={() => setExpanded(!expanded)}>
            <ChevronDown className={cn("w-4 h-4 mr-1 transition-transform", expanded && "rotate-180")} />
            {expanded ? "Mostra solo top 3" : `Vedi altre ${extra} offerte ${title.toLowerCase()}`}
          </Button>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {showIva && (
        <div className="flex justify-end">
          <Link
            to="/board?tab=impostazioni"
            className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground bg-muted/60 hover:bg-muted px-2.5 py-1 rounded-full border"
            title="Cambia in Impostazioni"
          >
            👁 IVA inclusa ({Math.round(aliqGlobal * 100)}%)
          </Link>
        </div>
      )}

      {discount > 0 && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 flex items-center justify-between gap-2">
          <span className="text-sm font-medium text-amber-900">
            ⚠️ Anteprima con sconto trattativa −{discount}%
          </span>
          <Button size="sm" variant="outline" onClick={() => { try { localStorage.setItem("board_negotiation_discount", "0"); window.dispatchEvent(new Event("board:negotiation-change")); } catch { /* noop */ } }} className="gap-1 min-h-[40px]">
            <RotateCcw className="w-3.5 h-3.5" /> Reset
          </Button>
        </div>
      )}
      {!presentazione && (
        <div className="flex flex-wrap gap-2">
          <Button onClick={condividi} variant="outline" size="sm" disabled={sharing} className="gap-2">
            {sharing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Share2 className="w-4 h-4" />}
            Condividi risultato
          </Button>
          <Button onClick={esportaPdf} variant="outline" size="sm" disabled={generatingPdf} className="gap-2">
            {generatingPdf ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileDown className="w-4 h-4" />}
            Esporta PDF
          </Button>
          <Button onClick={salva} variant="outline" size="sm" disabled={saving} className="gap-2">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Salva analisi
          </Button>
        </div>
      )}
      {!presentazione && selected.length === 2 && (
        <Button onClick={apriConfronto} className="w-full" variant="default">
          <BarChart3 className="w-4 h-4 mr-2" /> Confronta le 2 offerte selezionate
        </Button>
      )}
      {filtroTipo !== "gas" && renderSezione("Luce", luce, luceFull.length, "⚡", expandLuce, setExpandLuce, "luce", filtriLuce, setFiltriLuce)}
      {filtroTipo !== "luce" && renderSezione("Gas", gas, gasFull.length, "🔥", expandGas, setExpandGas, "gas", filtriGas, setFiltriGas)}
      {confronto && <ConfrontoModal items={confronto} dati={dati} imp={imp} onClose={() => setConfronto(null)} />}
    </div>
  );
}
