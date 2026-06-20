import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ClienteForm } from "./ClienteForm";
import { ClassificaOfferte } from "./ClassificaOfferte";
import { StoricoTab } from "./StoricoTab";
import { HeroRisparmio } from "./HeroRisparmio";
import { BeforeAfterBar } from "./BeforeAfterBar";
import { useImpostazioni } from "../ImpostazioniContext";
import type { CTE, DatiCliente, Impostazioni, NoteCliente } from "@/lib/board/types";
import { classificaCTE } from "@/lib/board/calcoli";
import { Skeleton } from "@/components/ui/skeleton";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { ChevronDown, Eye, FileText, Calculator, History, TrendingUp, Phone } from "lucide-react";
import { cn } from "@/lib/utils";
import { MaxiTrattativaPanel } from "./MaxiTrattativaPanel";
import { DraftBanner } from "./DraftBanner";
import { loadDraft, clearDraft, type DraftPayload } from "@/hooks/useDraftAutosave";

const SG_ENERGIA_NAME = "SG Energia";

const DEFAULT_DATI: DatiCliente = {
  segmento: "family", potenzaKw: 3, residente: true, canoneRai: true,
  consumoLuce: 2700, prezzoLuce: 0.25, fissoLuceMese: 12,
  usaFasce: false, percF1: 33, percF2: 24, percF3: 43,
  prezzoF1: 0.27, prezzoF2: 0.25, prezzoF3: 0.22,
  consumoGas: 1400, prezzoGas: 0.90, fissoGasMese: 12,
};
const DEFAULT_NOTE: NoteCliente = { nomeCliente: "", telefono: "", note: "" };

function fmtDate(s?: string | null) {
  if (!s) return "—";
  try { return new Date(s).toLocaleDateString("it-IT", { day: "2-digit", month: "short", year: "numeric" }); }
  catch { return "—"; }
}

/** Crea una copia di impostazioni con PUN/PSV sostituiti dal futures del mese selezionato.
 *  Per i PUN per fascia applica gli stessi rapporti relativi (F1≈1.12×, F2≈1.04×, F3≈0.88×) come da spec. */
function applyFutures(imp: Impostazioni, mese: 1 | 2 | 3): Impostazioni {
  const pun = imp[`pun_futures_${mese}` as const] as number | null | undefined;
  const psv = imp[`psv_futures_${mese}` as const] as number | null | undefined;
  if (pun == null && psv == null) return imp;
  return {
    ...imp,
    pun_riferimento: pun ?? imp.pun_riferimento,
    pun_f1: pun != null ? pun * 1.12 : imp.pun_f1,
    pun_f2: pun != null ? pun * 1.04 : imp.pun_f2,
    pun_f3: pun != null ? pun * 0.88 : imp.pun_f3,
    psv_riferimento: psv ?? imp.psv_riferimento,
  };
}

export function AnalisiTab() {
  const { impostazioni, loading } = useImpostazioni();
  const [ctes, setCtes] = useState<CTE[]>([]);
  const [dati, setDati] = useState<DatiCliente>(DEFAULT_DATI);
  const [note, setNote] = useState<NoteCliente>(DEFAULT_NOTE);
  const [showResults, setShowResults] = useState(false);
  const [view, setView] = useState<"calcolo" | "storico">("calcolo");
  const [openNote, setOpenNote] = useState(false);
  const [futuresAttivo, setFuturesAttivo] = useState(false);
  const [futuresMese, setFuturesMese] = useState<1 | 2 | 3>(2);
  const [presentazione, setPresentazione] = useState(false);
  const [maxiMode, setMaxiMode] = useState<boolean>(() => {
    try { return localStorage.getItem("board_maxi_mode") === "1"; } catch { return false; }
  });
  const [includeSgEnergia, setIncludeSgEnergia] = useState<boolean>(() => {
    try { return localStorage.getItem("board_include_sg_energia") === "1"; } catch { return false; }
  });
  const [showProvvigioni, setShowProvvigioni] = useState<boolean>(() => {
    try { return localStorage.getItem("board_show_provvigioni") === "1"; } catch { return false; }
  });
  const [filtroTipo, setFiltroTipo] = useState<"entrambi" | "luce" | "gas">("entrambi");
  const [draft, setDraft] = useState<DraftPayload | null>(() => loadDraft(DEFAULT_DATI.segmento));
  const datiSnap = useMemo(() => JSON.stringify(dati), [dati]);
  const datiSnapInit = useRef(datiSnap);

  useEffect(() => {
    supabase.from("cte").select("*").eq("attiva", true).then(({ data }) => {
      if (data) setCtes(data as unknown as CTE[]);
    });
  }, []);

  const ctesFiltrate = useMemo(() => {
    if (includeSgEnergia) return ctes;
    return ctes.filter(o => !(o.fornitore ?? "").toLowerCase().includes(SG_ENERGIA_NAME.toLowerCase()));
  }, [ctes, includeSgEnergia]);

  const impEff = useMemo(() => {
    if (!impostazioni) return null;
    return futuresAttivo ? applyFutures(impostazioni, futuresMese) : impostazioni;
  }, [impostazioni, futuresAttivo, futuresMese]);

  const lucePresentazione = useMemo(
    () => (showResults && impEff && filtroTipo !== "gas" ? classificaCTE(ctesFiltrate, dati, impEff, "luce") : []),
    [ctesFiltrate, dati, impEff, showResults, filtroTipo],
  );
  const gasPresentazione = useMemo(
    () => (showResults && impEff && filtroTipo !== "luce" ? classificaCTE(ctesFiltrate, dati, impEff, "gas") : []),
    [ctesFiltrate, dati, impEff, showResults, filtroTipo],
  );

  // Persist Maxi mode
  useEffect(() => {
    try { localStorage.setItem("board_maxi_mode", maxiMode ? "1" : "0"); } catch { /* noop */ }
  }, [maxiMode]);

  // Persist SG Energia toggle
  useEffect(() => {
    try { localStorage.setItem("board_include_sg_energia", includeSgEnergia ? "1" : "0"); } catch { /* noop */ }
  }, [includeSgEnergia]);

  // Persist Provvigioni toggle
  useEffect(() => {
    try { localStorage.setItem("board_show_provvigioni", showProvvigioni ? "1" : "0"); } catch { /* noop */ }
  }, [showProvvigioni]);

  // Esci da Maxi quando l'agente cambia i dati cliente
  useEffect(() => {
    if (maxiMode && datiSnap !== datiSnapInit.current) {
      setMaxiMode(false);
      datiSnapInit.current = datiSnap;
    }
  }, [datiSnap, maxiMode]);

  // Aggiorna draft quando cambia segmento
  useEffect(() => {
    setDraft(loadDraft(dati.segmento));
  }, [dati.segmento]);

  if (loading || !impostazioni || !impEff) return <div className="p-6"><Skeleton className="h-96" /></div>;

  const ricaricaDaStorico = (d: DatiCliente, n: NoteCliente) => {
    setDati(d); setNote(n); setView("calcolo"); setShowResults(true); setOpenNote(true);
    setDraft(null);
  };

  const resumeDraft = () => {
    if (!draft) return;
    setDati(draft.dati);
    if (draft.modalita) setFiltroTipo(draft.modalita);
    setDraft(null);
    datiSnapInit.current = JSON.stringify(draft.dati);
  };
  const discardDraft = () => {
    clearDraft(dati.segmento);
    setDraft(null);
  };

  const hasFutures = !!(impostazioni.pun_futures_1 || impostazioni.pun_futures_2 || impostazioni.pun_futures_3);

  return (
    <div className="container mx-auto px-3 sm:px-4 py-4 sm:py-6 space-y-4 max-w-full overflow-x-hidden">
      <div className="inline-flex rounded-lg border bg-muted p-1 gap-1">
        {[{ v: "calcolo" as const, l: "Calcolo", icon: Calculator }, { v: "storico" as const, l: "Storico", icon: History }].map((o) => {
          const I = o.icon;
          return (
            <button key={o.v} onClick={() => setView(o.v)}
              className={cn("flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md transition-colors",
                view === o.v ? "bg-background text-foreground shadow-sm font-medium" : "text-muted-foreground hover:text-foreground")}>
              <I className="w-4 h-4" /> {o.l}
            </button>
          );
        })}
      </div>

      {view === "storico" ? (
        <StoricoTab onRicarica={ricaricaDaStorico} />
      ) : (
        <div className="grid lg:grid-cols-2 gap-6">
          <div className="space-y-4">
            {draft && (
              <DraftBanner draft={draft} onResume={resumeDraft} onDiscard={discardDraft} />
            )}
            <ClienteForm dati={dati} onChange={setDati} onSubmit={() => setShowResults(true)} />


            {/* Toggle Prezzo attuale / Futures */}
            <Card className="p-4 space-y-3">
              <div className="inline-flex rounded-lg border bg-muted p-1 gap-1">
                <button onClick={() => setFuturesAttivo(false)}
                  className={cn("px-3 py-1.5 text-sm rounded-md transition-colors",
                    !futuresAttivo ? "bg-background text-foreground shadow-sm font-medium" : "text-muted-foreground")}>
                  Prezzo attuale
                </button>
                <button onClick={() => setFuturesAttivo(true)} disabled={!hasFutures}
                  className={cn("flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md transition-colors",
                    futuresAttivo ? "bg-background text-foreground shadow-sm font-medium" : "text-muted-foreground",
                    !hasFutures && "opacity-40 cursor-not-allowed")}>
                  <TrendingUp className="w-3.5 h-3.5" /> Futures
                </button>
              </div>

              {futuresAttivo && hasFutures && (
                <>
                  <div className="flex flex-wrap gap-2">
                    {([1, 2, 3] as const).map((m) => {
                      const mese = impostazioni[`futures_mese_${m}` as const];
                      const pun = impostazioni[`pun_futures_${m}` as const];
                      const psv = impostazioni[`psv_futures_${m}` as const];
                      if (pun == null && psv == null) return null;
                      const active = futuresMese === m;
                      return (
                        <button key={m} onClick={() => setFuturesMese(m)}
                          className={cn("text-left px-3 py-2 rounded-md border text-xs transition-colors",
                            active ? "border-primary bg-primary/10" : "bg-background hover:bg-muted")}>
                          <div className="font-medium">{mese ?? `Mese +${m}`}</div>
                          <div className="font-mono text-[10px] text-muted-foreground mt-0.5">
                            PUN {pun != null ? Number(pun).toFixed(4) : "—"} · PSV {psv != null ? Number(psv).toFixed(4) : "—"}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                  <div className="rounded-md bg-blue-50 border border-blue-200 p-2 text-[11px] text-blue-900">
                    📈 Calcolo su previsioni futures {impostazioni[`futures_mese_${futuresMese}` as const] ?? `+${futuresMese} mesi`} — il contratto si attiva tra ~{futuresMese} mes{futuresMese === 1 ? "e" : "i"}.
                  </div>
                  <div className="text-[10px] text-muted-foreground">Aggiornato: {fmtDate(impostazioni.futures_updated_at)}</div>
                </>
              )}
              {futuresAttivo && !hasFutures && (
                <div className="text-[11px] text-muted-foreground">Nessun futures configurato. Vai in Impostazioni per inserire i valori previsti.</div>
              )}
            </Card>

            <Collapsible open={openNote} onOpenChange={setOpenNote}>
              <Card className="p-4">
                <CollapsibleTrigger className="flex items-center justify-between w-full">
                  <span className="flex items-center gap-2 font-medium text-sm"><FileText className="w-4 h-4" />📝 Dati cliente (opzionale)</span>
                  <ChevronDown className={cn("w-4 h-4 transition-transform", openNote && "rotate-180")} />
                </CollapsibleTrigger>
                <CollapsibleContent className="space-y-3 pt-3">
                  <div className="grid sm:grid-cols-2 gap-3">
                    <div><Label className="text-xs">Nome cliente</Label><Input value={note.nomeCliente} onChange={(e) => setNote({ ...note, nomeCliente: e.target.value })} /></div>
                    <div><Label className="text-xs">Telefono</Label><Input value={note.telefono} onChange={(e) => setNote({ ...note, telefono: e.target.value })} /></div>
                  </div>
                  <div>
                    <Label className="text-xs">Note</Label>
                    <Textarea value={note.note} onChange={(e) => setNote({ ...note, note: e.target.value })}
                      placeholder="es. Vuole pensarci, richiamare lunedì..." rows={3} />
                  </div>
                </CollapsibleContent>
              </Card>
            </Collapsible>
          </div>
          <div className="space-y-4">
            {showResults && (
              <div className="space-y-2">
                <div className="flex items-center justify-between rounded-lg border bg-muted/40 px-3 py-2">
                  <label htmlFor="toggle-presentazione" className="flex items-center gap-2 text-sm font-medium cursor-pointer select-none">
                    <Eye className="w-4 h-4 text-muted-foreground" />
                    Modalità presentazione
                  </label>
                  <Switch
                    id="toggle-presentazione"
                    checked={presentazione}
                    onCheckedChange={setPresentazione}
                  />
                </div>
                <div className="flex items-center justify-between rounded-lg border-2 border-primary/40 bg-primary/5 px-3 py-2">
                  <label htmlFor="toggle-maxi" className="flex items-center gap-2 text-base font-semibold cursor-pointer select-none">
                    <Phone className="w-5 h-5 text-primary" />
                    📞 Modalità Maxi
                  </label>
                  <Switch
                    id="toggle-maxi"
                    checked={maxiMode}
                    onCheckedChange={(v) => { setMaxiMode(v); if (v) datiSnapInit.current = datiSnap; }}
                    className="data-[state=checked]:bg-primary"
                  />
                </div>
                <div className="flex items-center justify-between rounded-lg border bg-muted/40 px-3 py-2">
                  <label htmlFor="toggle-sg-energia" className="flex items-center gap-2 text-sm font-medium cursor-pointer select-none">
                    <span className="text-xs font-bold text-primary bg-primary/10 px-1.5 py-0.5 rounded">SG</span>
                    Includi SG Energia
                  </label>
                  <Switch
                    id="toggle-sg-energia"
                    checked={includeSgEnergia}
                    onCheckedChange={setIncludeSgEnergia}
                  />
                </div>
                <div className="flex items-center justify-between rounded-lg border bg-muted/40 px-3 py-2">
                  <label htmlFor="toggle-provvigioni" className="flex items-center gap-2 text-sm font-medium cursor-pointer select-none">
                    <span className="text-xs">💶</span>
                    Mostra provvigioni
                  </label>
                  <Switch
                    id="toggle-provvigioni"
                    checked={showProvvigioni}
                    onCheckedChange={setShowProvvigioni}
                  />
                </div>
              </div>
            )}
            {showResults ? (
              <>
                <div className="inline-flex rounded-lg border bg-muted p-1 gap-1">
                  {([
                    { v: "entrambi" as const, l: "⚡ + 🔥 Entrambi" },
                    { v: "luce" as const, l: "⚡ Solo luce" },
                    { v: "gas" as const, l: "🔥 Solo gas" },
                  ]).map((o) => (
                    <button key={o.v} onClick={() => setFiltroTipo(o.v)}
                      className={cn("px-3 py-1.5 text-sm rounded-md transition-colors",
                        filtroTipo === o.v ? "bg-background text-foreground shadow-sm font-medium" : "text-muted-foreground hover:text-foreground")}>
                      {o.l}
                    </button>
                  ))}
                </div>
                {presentazione && (
                  <>
                    <HeroRisparmio luce={lucePresentazione} gas={gasPresentazione} />
                    <BeforeAfterBar luce={lucePresentazione} gas={gasPresentazione} />
                  </>
                )}
                <ClassificaOfferte ctes={ctesFiltrate} dati={dati} imp={impEff} noteCliente={note} presentazione={presentazione} filtroTipo={filtroTipo} showProvvigioni={showProvvigioni} />
              </>
            ) : (
              <div className="rounded-lg border-2 border-dashed p-8 text-center text-muted-foreground">
                Compila i dati e premi <strong>Trova offerta migliore</strong> per vedere la classifica.
              </div>
            )}
          </div>
        </div>
      )}
      {maxiMode && showResults && (
        <MaxiTrattativaPanel
          luce={lucePresentazione}
          gas={gasPresentazione}
          dati={dati}
          imp={impEff}
          onClose={() => setMaxiMode(false)}
        />
      )}
    </div>
  );
}
