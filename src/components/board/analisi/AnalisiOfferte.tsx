import {
  CheckCircle2,
  Flame,
  Save,
  TrendingUp,
  Zap,
} from "lucide-react";
import { useEffect } from "react";
import { useOutletContext, useNavigate } from "react-router-dom";
import { Proiezione12Mesi } from "./Proiezione12Mesi";
import { cn } from "@/lib/utils";
import { eur } from "@/lib/board/formatters";
import { type RisultatoOfferta } from "@/lib/board/calcoloOfferte";
import type { AnalisiCtx } from "../AnalisiCockpit";

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

// ── AnalisiOfferte ─────────────────────────────────────────────────────────────

export function AnalisiOfferte() {
  const navigate = useNavigate();
  const {
    risultatiLuce,
    risultatiGas,
    spesaAnnuaLuce,
    spesaAnnuaGas,
    showLuce,
    showGas,
    haSpesaLuce,
    haSpesaGas,
    bestLuce,
    bestGas,
    totalRisparmio,
    selectedCteId,
    setSelectedCteId,
    savingSimulazione,
    saveOk,
    saveError,
    handleSalvaSimulazione,
    setTrattativaOfferta,
  } = useOutletContext<AnalisiCtx>();

  useEffect(() => {
    if (risultatiLuce.length === 0 && risultatiGas.length === 0) {
      navigate("/board/analisi/dati", { replace: true });
    }
  }, [risultatiLuce, risultatiGas, navigate]);

  return (
    <>
      {/* Summary bar */}
      <div data-testid="analisi-offerte" className="grid md:grid-cols-3 gap-4 bg-surface-subtle border border-border-ui rounded-xl p-5">
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
              onClick={() => { setTrattativaOfferta(off); navigate("../chiudi", { viewTransition: true }); }}
              className="flex items-center gap-2 h-10 px-4 rounded-xl border border-brand text-sm font-semibold text-brand hover:bg-brand-subtle transition-all min-h-[44px]"
            >
              <TrendingUp className="w-4 h-4" />
              Trattativa
            </button>
          ) : null;
        })()}
        {saveError && <p className="text-xs text-spend">{saveError}</p>}
      </div>

      {/* Proiezione 12 mesi — offerta selezionata */}
      {selectedCteId && (() => {
        const sel =
          risultatiLuce.find((r) => r.cte_id === selectedCteId) ??
          risultatiGas.find((r) => r.cte_id === selectedCteId);
        if (!sel) return null;
        const spesaPerProiezione = risultatiLuce.some((r) => r.cte_id === selectedCteId)
          ? spesaAnnuaLuce
          : spesaAnnuaGas;
        return (
          <Proiezione12Mesi
            costoOfferta={sel.costo_annuo_totale}
            spesaAnnua={spesaPerProiezione}
            nomeOfferta={sel.nome}
          />
        );
      })()}

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
            onClick={() => navigate("../dettaglio", { viewTransition: true })}
            className="flex items-center gap-2 h-10 px-4 rounded-xl border border-border-ui text-sm font-medium text-text-muted hover:text-text-base hover:bg-surface-subtle transition-colors"
          >
            Confronto Tecnico Dettagliato →
          </button>
        </div>
      )}
    </>
  );
}
