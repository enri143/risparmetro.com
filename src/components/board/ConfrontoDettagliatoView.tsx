import { useMemo, useState } from "react";
import { ArrowLeft, CheckCircle2, ChevronDown, FileDown, Flame, Loader2, ShieldCheck, ShieldOff, Zap } from "lucide-react";
import { generateReport } from "@/lib/pdf/generateReport";
import { cn } from "@/lib/utils";
import { eur, eurUnit } from "@/lib/board/formatters";
import {
  type CTE,
  type ParametriRegolati,
  type PrezzoMercato,
  type RisultatoOfferta,
} from "@/lib/board/calcoloOfferte";

// ── Local helpers ─────────────────────────────────────────────────────────────

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

function BreakdownRow({ label, value, unit }: { label: string; value: number; unit: string }) {
  return (
    <div className="flex justify-between items-center text-xs">
      <span className="text-text-muted">{label}</span>
      <span className="font-medium text-text-base font-mono tabular-nums">
        {eurUnit(value)} €/{unit}
      </span>
    </div>
  );
}

// ── Tagged result — luce or gas ───────────────────────────────────────────────

type TaggedResult = RisultatoOfferta & { _util: "luce" | "gas" };

// ── OfferDettaglioCard ────────────────────────────────────────────────────────

function OfferDettaglioCard({
  r,
  idx,
  cte,
  mktPriceLuce,
  mktPriceGas,
  parametriLuce: _parametriLuce,
  parametriGas: _parametriGas,
  spesaAnnuaLuce,
  spesaAnnuaGas,
  clientMode,
  isSelected,
  onSelect,
}: {
  r: TaggedResult;
  idx: number;
  cte: CTE | undefined;
  mktPriceLuce: number;
  mktPriceGas: number;
  parametriLuce: ParametriRegolati | null;
  parametriGas: ParametriRegolati | null;
  spesaAnnuaLuce: number;
  spesaAnnuaGas: number;
  clientMode?: boolean;
  isSelected?: boolean;
  onSelect?: () => void;
}) {
  const [materiaExpanded, setMateriaExpanded] = useState(false);
  const [dettagliExpanded, setDettagliExpanded] = useState(false);

  const isLuce = r._util === "luce";
  const isBest = idx === 0 && r.risparmio_annuo > 0;
  const isNeg = r.risparmio_annuo < 0;

  const unit = isLuce ? "kWh" : "Smc";
  const marketLabel = isLuce ? "PUN" : "PSV";
  const mktPrice = isLuce ? mktPriceLuce : mktPriceGas;
  const spread = isLuce ? (cte?.spread_luce ?? null) : (cte?.spread_gas ?? null);
  const prezzoFisso = isLuce ? cte?.prezzo_energia_luce : cte?.prezzo_energia_gas;
  const quotaFissaMese = isLuce ? (cte?.quota_fissa_luce ?? 0) : (cte?.quota_fissa_gas ?? 0);
  const spesaAttuale = isLuce ? spesaAnnuaLuce : spesaAnnuaGas;

  const isFisso = r.tipo_prezzo === "fisso";
  const costoUnitario: number | undefined = isFisso
    ? prezzoFisso
    : mktPrice + (spread ?? 0);

  const ccv = quotaFissaMese * 12;

  const tariffaLabel = isFisso
    ? `Prezzo Fisso${r.durata_blocco_mesi ? ` ${r.durata_blocco_mesi} Mesi` : ""}`
    : `Prezzo Variabile ${marketLabel}`;

  return (
    <div
      className={cn(
        "bg-white border rounded-xl overflow-hidden shadow-sm",
        isBest ? "border-savings/40 ring-1 ring-savings/20" : "border-border-ui",
      )}
    >
      {/* Best badge */}
      {isBest && (
        <div className="bg-savings text-savings-foreground text-[10px] font-bold uppercase tracking-widest px-5 py-1.5">
          Offerta Consigliata
        </div>
      )}

      {/* Main grid */}
      <div className="p-5 lg:p-6 grid gap-5 lg:grid-cols-[2fr_2fr_1fr_1fr]">

        {/* 1 — Identity */}
        <div className="flex items-start gap-3">
          <FornitoreAvatar nome={r.fornitore_nome} colore={r.fornitore_colore} />
          <div>
            <div className="font-semibold text-sm text-text-base leading-snug">{r.nome}</div>
            <div className="text-xs text-text-muted mt-0.5">{tariffaLabel}</div>
            <div className="flex items-center gap-1 mt-2">
              {isLuce
                ? <Zap className="w-3 h-3 text-yellow-500" />
                : <Flame className="w-3 h-3 text-orange-500" />}
              <span className="text-[10px] text-text-muted">
                {isLuce ? "Elettricità" : "Gas Naturale"}
              </span>
            </div>
          </div>
        </div>

        {/* 2 — Costo materia prima, espandibile */}
        <div className="bg-surface-subtle border border-border-ui rounded-xl p-4">
          <div className="text-[10px] font-bold uppercase tracking-wider text-text-muted mb-2">
            Costo materia prima stimata
          </div>
          {costoUnitario !== undefined ? (
            <div className="text-2xl font-bold text-text-base tabular-nums">
              {eurUnit(costoUnitario)}{" "}
              <span className="text-sm font-normal text-text-muted">€/{unit}</span>
            </div>
          ) : (
            <div className="text-xl font-bold text-text-muted">—</div>
          )}
          <button
            type="button"
            onClick={() => setMateriaExpanded((v) => !v)}
            className="flex items-center gap-1 text-xs text-brand hover:text-brand-hover mt-2 transition-colors min-h-[32px]"
          >
            {materiaExpanded ? "Nascondi componenti" : "Vedi componenti"}
            <ChevronDown
              className={cn("w-3 h-3 transition-transform", materiaExpanded && "rotate-180")}
            />
          </button>

          {materiaExpanded && (
            <div className="mt-3 pt-3 border-t border-border-ui space-y-2">
              {isFisso ? (
                prezzoFisso !== undefined && (
                  <BreakdownRow label="Prezzo bloccato" value={prezzoFisso} unit={unit} />
                )
              ) : (
                <>
                  <BreakdownRow
                    label={`${marketLabel} (media 30 gg)`}
                    value={mktPrice}
                    unit={unit}
                  />
                  {spread !== null && (
                    <BreakdownRow label="Spread fornitore" value={spread} unit={unit} />
                  )}
                </>
              )}
            </div>
          )}
        </div>

        {/* 3 — CCV */}
        <div className="bg-surface-subtle border border-border-ui rounded-xl p-4">
          <div className="text-[10px] font-bold uppercase tracking-wider text-text-muted mb-2">
            CCV (Quota Fissa)
          </div>
          <div className="text-xl font-bold text-text-base">
            {eur(ccv)}
            <span className="text-sm font-normal text-text-muted">/anno</span>
          </div>
        </div>

        {/* 4 — Risparmio + toggle dettagli */}
        <div className="flex flex-col">
          <div className="text-[10px] font-bold uppercase tracking-wider text-text-muted mb-2">
            Risparmio Stimato Annuo
          </div>
          <div
            className={cn(
              "text-3xl font-bold leading-none",
              isNeg ? "text-spend" : "text-savings",
            )}
          >
            {isNeg ? "−" : "+"}
            {eur(Math.abs(r.risparmio_annuo))}
          </div>
          {r.risparmio_percentuale !== 0 && spesaAttuale > 0 && (
            <div className={cn("text-xs mt-1", isNeg ? "text-spend" : "text-savings")}>
              {isNeg ? "−" : "+"}
              {Math.abs(r.risparmio_percentuale).toFixed(1)}%
            </div>
          )}
          <button
            type="button"
            onClick={() => setDettagliExpanded((v) => !v)}
            className="text-xs text-brand underline text-left mt-3 hover:text-brand-hover transition-colors min-h-[32px]"
          >
            {dettagliExpanded ? "Nascondi Dettagli" : "Vedi Dettagli"}
          </button>
        </div>
      </div>

      {/* Selection footer */}
      {onSelect && (
        <div className="px-5 lg:px-6 pb-4 flex justify-end border-t border-border-ui pt-4">
          <button
            type="button"
            onClick={onSelect}
            className={cn(
              "flex items-center gap-2 h-10 px-4 rounded-xl border text-sm font-medium transition-all min-h-[44px]",
              isSelected
                ? "bg-savings-subtle border-savings text-savings-subtle-foreground"
                : "border-border-ui text-text-muted hover:bg-surface-subtle",
            )}
          >
            {isSelected ? (
              <>
                <CheckCircle2 className="w-4 h-4" />
                Offerta selezionata
              </>
            ) : (
              "Seleziona questa offerta"
            )}
          </button>
        </div>
      )}

      {/* Expanded detail */}
      {dettagliExpanded && (
        <div className="px-5 lg:px-6 pb-5 lg:pb-6">
          <div className="border-t border-border-ui pt-4">
            <h4 className="text-[10px] font-bold uppercase tracking-wider text-text-muted mb-3">
              Riepilogo Calcolo
            </h4>
            <div className="grid md:grid-cols-2 gap-5">

              {/* Cost summary */}
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-text-muted">Costo annuo stimato</span>
                  <span className="font-semibold text-text-base">{eur(r.costo_annuo_totale)}</span>
                </div>
                {ccv > 0 && (
                  <div className="flex justify-between">
                    <span className="text-text-muted ml-3">di cui CCV</span>
                    <span className="text-text-muted">{eur(ccv)}</span>
                  </div>
                )}
                {spesaAttuale > 0 && (
                  <div className="flex justify-between pt-2 border-t border-border-ui">
                    <span className="text-text-muted">Spesa attuale stimata</span>
                    <span className="font-semibold text-text-base">{eur(spesaAttuale)}</span>
                  </div>
                )}
                <div
                  className={cn(
                    "flex justify-between font-semibold pt-1",
                    isNeg ? "text-spend" : "text-savings",
                  )}
                >
                  <span>{isNeg ? "Costo aggiuntivo" : "Risparmio netto"}</span>
                  <span>
                    {isNeg ? "−" : "+"}
                    {eur(Math.abs(r.risparmio_annuo))}
                  </span>
                </div>
              </div>

              {/* Agent-only section — nascosta in clientMode */}
              {!clientMode && (r.provvigione !== undefined ||
                r.mesi_storno_rischio !== undefined ||
                r.durata_blocco_mesi !== undefined) && (
                <div className="bg-surface-subtle border border-border-ui rounded-xl p-4">
                  <h5 className="text-[10px] font-bold uppercase tracking-wider text-text-muted mb-2.5">
                    Condizioni Agente
                  </h5>
                  <div className="space-y-2 text-sm">
                    {r.provvigione !== undefined && (
                      <div className="flex justify-between">
                        <span className="text-text-muted">Provvigione</span>
                        <span className="font-medium text-text-base">
                          {r.provvigione_tipo === "percentuale"
                            ? `${r.provvigione}%`
                            : eur(r.provvigione)}
                        </span>
                      </div>
                    )}
                    {r.mesi_storno_rischio !== undefined && (
                      <div className="flex justify-between">
                        <span className="text-text-muted">Rischio storno</span>
                        <span className="font-medium text-text-base">
                          {r.mesi_storno_rischio} mesi
                        </span>
                      </div>
                    )}
                    {r.durata_blocco_mesi !== undefined && (
                      <div className="flex justify-between">
                        <span className="text-text-muted">Durata blocco</span>
                        <span className="font-medium text-text-base">
                          {r.durata_blocco_mesi} mesi
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── ConfrontoDettagliatoView ──────────────────────────────────────────────────

export function ConfrontoDettagliatoView({
  risultatiLuce,
  risultatiGas,
  ctes,
  prezziMercato,
  parametriLuce,
  parametriGas,
  spesaAnnuaLuce,
  spesaAnnuaGas,
  onBack,
  clientMode,
  onToggleClientMode,
  selectedCteId,
  onSelectCte,
}: {
  risultatiLuce: RisultatoOfferta[];
  risultatiGas: RisultatoOfferta[];
  ctes: CTE[];
  prezziMercato: PrezzoMercato;
  parametriLuce: ParametriRegolati | null;
  parametriGas: ParametriRegolati | null;
  spesaAnnuaLuce: number;
  spesaAnnuaGas: number;
  onBack: () => void;
  clientMode?: boolean;
  onToggleClientMode?: () => void;
  selectedCteId?: string | null;
  onSelectCte?: (id: string) => void;
}) {
  const allResults = useMemo<TaggedResult[]>(
    () =>
      [
        ...risultatiLuce.map((r) => ({ ...r, _util: "luce" as const })),
        ...risultatiGas.map((r) => ({ ...r, _util: "gas" as const })),
      ].sort((a, b) => b.risparmio_annuo - a.risparmio_annuo),
    [risultatiLuce, risultatiGas],
  );

  const cteMap = useMemo(() => new Map(ctes.map((c) => [c.id, c])), [ctes]);

  const offerteCount = allResults.length;
  const migliorRisparmio = allResults[0]?.risparmio_annuo ?? 0;

  const [generatingPdf, setGeneratingPdf] = useState(false);

  const handleGeneraPDF = async () => {
    setGeneratingPdf(true);
    try {
      await generateReport({ risultatiLuce, risultatiGas, spesaAnnuaLuce, spesaAnnuaGas });
    } finally {
      setGeneratingPdf(false);
    }
  };

  return (
    <div className="mx-auto px-4 sm:px-6 py-5 max-w-screen-xl pb-28">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <button
            type="button"
            onClick={onBack}
            className="flex items-center gap-1.5 text-sm text-text-muted hover:text-text-base transition-colors min-h-[44px]"
          >
            <ArrowLeft className="w-4 h-4" />
            Torna al riepilogo
          </button>
          {onToggleClientMode && (
            <button
              type="button"
              onClick={onToggleClientMode}
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
          )}
        </div>
        <h1 className="text-2xl font-bold text-text-base">Confronto Offerte Dettagliato</h1>
        <p className="text-sm text-text-muted mt-1">
          Analisi tecnica delle migliori tariffe disponibili sul mercato.
          {offerteCount > 0 && (
            <>
              {" "}·{" "}
              <span className="font-medium">
                {offerteCount} offert{offerteCount === 1 ? "a" : "e"}
              </span>{" "}
              — miglior risparmio{" "}
              <span
                className={cn(
                  "font-semibold",
                  migliorRisparmio >= 0 ? "text-savings" : "text-spend",
                )}
              >
                {migliorRisparmio >= 0 ? "+" : "−"}
                {eur(Math.abs(migliorRisparmio))}/anno
              </span>
            </>
          )}
        </p>
      </div>

      {/* Offer cards */}
      {allResults.length === 0 ? (
        <div className="rounded-xl border-2 border-dashed border-border-ui p-14 text-center text-text-muted text-sm">
          Nessuna offerta da confrontare. Torna al riepilogo e verifica i parametri.
        </div>
      ) : (
        <div className="space-y-4">
          {allResults.map((r, i) => (
            <OfferDettaglioCard
              key={`${r._util}-${r.cte_id}`}
              r={r}
              idx={i}
              cte={cteMap.get(r.cte_id)}
              mktPriceLuce={prezziMercato.pun_medio}
              mktPriceGas={prezziMercato.psv_medio}
              parametriLuce={parametriLuce}
              parametriGas={parametriGas}
              spesaAnnuaLuce={spesaAnnuaLuce}
              spesaAnnuaGas={spesaAnnuaGas}
              clientMode={clientMode}
              isSelected={selectedCteId === r.cte_id}
              onSelect={onSelectCte ? () => onSelectCte(r.cte_id) : undefined}
            />
          ))}
        </div>
      )}

      {/* Sticky footer */}
      <div className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-border-ui px-4 sm:px-6 py-4 flex items-center justify-between gap-4">
        <button
          type="button"
          onClick={onBack}
          className="flex items-center gap-2 h-11 px-5 rounded-xl border border-border-ui text-sm font-medium text-text-base bg-white hover:bg-surface-subtle transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Indietro al Riepilogo
        </button>
        <button
          type="button"
          onClick={handleGeneraPDF}
          disabled={generatingPdf}
          className="flex items-center gap-2 h-11 px-5 rounded-xl bg-brand text-brand-foreground text-sm font-medium hover:bg-brand-hover transition-colors shadow-sm disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {generatingPdf
            ? <Loader2 className="w-4 h-4 animate-spin" />
            : <FileDown className="w-4 h-4" />}
          {generatingPdf ? 'Generazione...' : 'Genera Report PDF'}
        </button>
      </div>
    </div>
  );
}
