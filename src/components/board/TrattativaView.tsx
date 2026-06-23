import { useState } from "react";
import { useOutletContext, useNavigate, Navigate } from "react-router-dom";
import { FileText, Loader2, X } from "lucide-react";
import { eur } from "@/lib/board/formatters";
import { useTenantBranding } from "@/hooks/useTenantBranding";
import { generateReport } from "@/lib/pdf/generateReport";
import { cn } from "@/lib/utils";
import { CopilotTrattativa } from "@/components/board/analisi/copilot/CopilotTrattativa";
import type { AnalisiCtx } from "./AnalisiCockpit";

export function TrattativaView() {
  const navigate = useNavigate();
  const {
    trattativaOfferta,
    setTrattativaOfferta,
    risultatiLuce,
    risultatiGas,
    spesaAnnuaLuce,
    spesaAnnuaGas,
  } = useOutletContext<AnalisiCtx>();
  const { branding } = useTenantBranding();
  const [generatingPdf, setGeneratingPdf] = useState(false);

  if (!trattativaOfferta) {
    return <Navigate to="../offerte" replace />;
  }

  const offerta = trattativaOfferta;

  const accentColor = branding?.accent_color ?? "#1D9E75";
  const VERDE = "#1D9E75";

  // Derived entirely from RisultatoOfferta — no recalculation
  const spesaAttuale = offerta.costo_annuo_totale + offerta.risparmio_annuo;
  const risparmioAnno = offerta.risparmio_annuo;
  const risparmioMese = risparmioAnno / 12;
  const rispPct =
    spesaAttuale > 0 ? Math.round((risparmioAnno / spesaAttuale) * 100) : 0;

  // Breakdown: solo componenti contendibili (materia + quota fissa)
  // Oneri sistema e trasporto si elidono nel confronto tra fornitori — non mostrati
  const materiaNuova = offerta.costo_materia_energia;
  const quotaFissaAnnua = offerta.quota_fissa_annua;
  const nuovoFissoMese = quotaFissaAnnua / 12;

  const handlePdf = async () => {
    setGeneratingPdf(true);
    try {
      await generateReport({
        risultatiLuce,
        risultatiGas,
        spesaAnnuaLuce,
        spesaAnnuaGas,
      });
    } finally {
      setGeneratingPdf(false);
    }
  };

  return (
    <div data-testid="analisi-chiudi" className="fixed inset-0 z-50 bg-white flex flex-col overflow-hidden">

      {/* ── HEADER ── */}
      <div
        className="shrink-0 flex items-center justify-between px-6 py-3.5 border-b border-border-ui"
      >
        <div className="flex items-center gap-3">
          {branding?.logo_url ? (
            <img
              src={branding.logo_url}
              alt={branding?.brand_name ?? "Logo"}
              className="h-8 max-w-[140px] object-contain"
            />
          ) : (
            <div
              className="w-8 h-8 rounded-md flex items-center justify-center text-white text-sm font-bold shrink-0"
              style={{ backgroundColor: accentColor }}
            >
              {(branding?.brand_name ?? "A").charAt(0).toUpperCase()}
            </div>
          )}
          {branding?.brand_name && (
            <span className="text-sm font-semibold text-text-base hidden sm:block">
              {branding?.brand_name}
            </span>
          )}
        </div>

        <button
          onClick={() => { setTrattativaOfferta(null); navigate("../offerte"); }}
          className="min-w-[44px] min-h-[44px] rounded-full border border-border-ui flex items-center justify-center hover:bg-surface-subtle transition-colors"
          aria-label="Chiudi"
        >
          <X className="w-5 h-5 text-text-muted" />
        </button>
      </div>

      {/* ── BODY ── */}
      <div className="flex-1 min-h-0 overflow-y-auto">
      <div className="flex flex-col items-center justify-evenly px-6 sm:px-12 py-6 gap-4 min-h-full">

        {/* HERO — risparmio annuo */}
        <div className="text-center shrink-0">
          <p
            className="text-[10px] font-bold uppercase tracking-[0.3em] mb-3"
            style={{ color: accentColor }}
          >
            Risparmio annuo stimato
          </p>
          <div
            className="font-extrabold tabular-nums leading-none"
            style={{ fontSize: "clamp(3.5rem, 11vw, 8rem)", color: VERDE }}
          >
            +{eur(Math.round(risparmioAnno))}
          </div>
          <div className="flex items-center justify-center gap-4 mt-4 flex-wrap">
            <span className="font-semibold" style={{ color: VERDE }}>
              +{eur(Math.round(risparmioMese))}
              <span className="text-sm font-normal text-text-muted">/mese</span>
            </span>
            {rispPct > 0 && (
              <span
                className="text-sm font-bold px-3 py-1 rounded-full"
                style={{ backgroundColor: `${VERDE}1A`, color: VERDE }}
              >
                −{rispPct}% vs attuale
              </span>
            )}
          </div>
        </div>

        {/* BEFORE / AFTER — due colonne flat Attio-style */}
        <div className="w-full max-w-3xl shrink-0">
          <div className="grid grid-cols-2 divide-x divide-border-ui border border-border-ui rounded-2xl overflow-hidden">

            {/* ATTUALE */}
            <div className="px-6 py-5 bg-surface-subtle">
              <p className="text-[10px] font-bold uppercase tracking-wider text-text-muted mb-2">
                Attuale
              </p>
              <p className="text-text-base tabular-nums" style={{ fontSize: "clamp(1.6rem, 4vw, 2.5rem)", fontWeight: 700 }}>
                {eur(Math.round(spesaAttuale))}
                <span className="text-sm font-normal text-text-muted">/anno</span>
              </p>
              <p className="text-xs text-text-muted mt-1.5">Contratto in corso</p>
            </div>

            {/* CONSIGLIATA */}
            <div className="px-6 py-5 bg-white relative">
              <div
                className="absolute top-0 left-0 right-0 h-[3px]"
                style={{ backgroundColor: VERDE }}
              />
              <p
                className="text-[10px] font-bold uppercase tracking-wider mb-2"
                style={{ color: accentColor }}
              >
                Consigliata
              </p>
              <p
                className="tabular-nums"
                style={{ fontSize: "clamp(1.6rem, 4vw, 2.5rem)", fontWeight: 700, color: VERDE }}
              >
                {eur(Math.round(offerta.costo_annuo_totale))}
                <span className="text-sm font-normal text-text-muted">/anno</span>
              </p>
              <p className="text-xs font-medium text-text-base mt-1.5 truncate">
                {offerta.fornitore_nome} · {offerta.nome}
              </p>
            </div>
          </div>
        </div>

        {/* BREAKDOWN — parti contendibili */}
        <div className="w-full max-w-3xl shrink-0">
          <p className="text-[10px] font-bold uppercase tracking-wider text-text-muted mb-2">
            Componenti nuova offerta (parti contendibili)
          </p>
          <div className="flex gap-3 flex-wrap">
            <div className="flex-1 min-w-[130px] bg-surface-subtle border border-border-ui rounded-xl px-4 py-3">
              <p className="text-[11px] text-text-muted">Materia energia</p>
              <p className="text-lg font-bold text-text-base mt-0.5 tabular-nums">
                {eur(Math.round(materiaNuova))}
                <span className="text-xs font-normal text-text-muted">/anno</span>
              </p>
            </div>
            <div className="flex-1 min-w-[130px] bg-surface-subtle border border-border-ui rounded-xl px-4 py-3">
              <p className="text-[11px] text-text-muted">Quota fissa</p>
              <p className="text-lg font-bold text-text-base mt-0.5 tabular-nums">
                {eur(Math.round(nuovoFissoMese))}
                <span className="text-xs font-normal text-text-muted">/mese</span>
              </p>
            </div>
          </div>
          <p className="text-[10px] text-text-muted mt-2">
            Oneri di sistema e trasporto (regolati ARERA) sono identici per tutti i fornitori — non inclusi nel confronto.
          </p>
        </div>
      </div>

      {/* ── CO-PILOT TRATTATIVA ── */}
      <div className="px-6 sm:px-12 pb-6">
        <CopilotTrattativa />
      </div>
      </div>

      {/* ── FOOTER CTA ── */}
      <div className="shrink-0 border-t border-border-ui px-6 sm:px-12 py-4 flex items-center justify-between gap-3">
        <button
          onClick={() => { setTrattativaOfferta(null); navigate("../offerte"); }}
          className="px-5 py-3 min-h-[48px] rounded-xl border border-border-ui text-sm font-medium text-text-muted hover:bg-surface-subtle transition-colors"
        >
          ← Torna al confronto
        </button>

        <button
          onClick={handlePdf}
          disabled={generatingPdf}
          className={cn(
            "flex items-center gap-2 px-7 py-3 min-h-[48px] rounded-xl text-sm font-semibold",
            "text-white transition-opacity",
            generatingPdf && "opacity-70 cursor-not-allowed",
          )}
          style={{ backgroundColor: accentColor }}
        >
          {generatingPdf ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <FileText className="w-4 h-4" />
          )}
          {generatingPdf ? "Generazione…" : "Genera PDF"}
        </button>
      </div>
    </div>
  );
}
