import { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import type { RisultatoOfferta } from "@/lib/board/calcoloOfferte";
import { eur } from "@/lib/board/formatters";
import { cn } from "@/lib/utils";

interface Props {
  luce: RisultatoOfferta[];
  gas: RisultatoOfferta[];
  onClose: () => void;
}

export function MaxiTrattativaPanel({ luce, gas, onClose }: Props) {
  const top = useMemo(() => {
    const base = luce.length > 0 ? luce : gas;
    return base.filter((r) => r.risparmio_annuo > 0).slice(0, 5);
  }, [luce, gas]);

  const [idx, setIdx] = useState(0);
  const [showBreakdown, setShowBreakdown] = useState(false);
  const touchStartX = useRef<number | null>(null);

  useEffect(() => { setIdx(0); }, [top.length]);

  useEffect(() => {
    if (!showBreakdown) return;
    const t = window.setTimeout(() => setShowBreakdown(false), 2200);
    return () => window.clearTimeout(t);
  }, [showBreakdown]);

  const prev = () => setIdx((i) => (i - 1 + top.length) % top.length);
  const next = () => setIdx((i) => (i + 1) % top.length);

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null) return;
    const delta = touchStartX.current - e.changedTouches[0].clientX;
    if (Math.abs(delta) > 50 && top.length > 1) {
      delta > 0 ? next() : prev();
    }
    touchStartX.current = null;
  };

  const current = top[idx];

  if (!current) {
    return (
      <div className="fixed inset-0 z-50 bg-gradient-to-br from-primary/95 via-primary to-black text-primary-foreground flex flex-col items-center justify-center p-6">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 min-w-[44px] min-h-[44px] rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center"
          aria-label="Chiudi"
        >
          <X className="w-6 h-6" />
        </button>
        <p className="text-2xl font-medium opacity-90">Nessuna offerta in risparmio da mostrare.</p>
        <button
          onClick={onClose}
          className="mt-6 px-6 py-3 min-h-[44px] rounded-lg bg-white text-primary font-semibold"
        >
          Torna alla classifica
        </button>
      </div>
    );
  }

  const risparmioAnno = current.risparmio_annuo;
  const risparmioMese = risparmioAnno / 12;
  const quotaFissaAnnua = current.quota_fissa_annua;
  const nuovoFissoMese = quotaFissaAnnua / 12;
  const materiaContributo = Math.max(0, risparmioAnno - quotaFissaAnnua);

  return (
    <div
      className="fixed inset-0 z-50 bg-gradient-to-br from-primary/95 via-primary to-black text-primary-foreground overflow-hidden"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      <button
        onClick={onClose}
        className="absolute top-4 right-4 min-w-[44px] min-h-[44px] rounded-full bg-white/15 hover:bg-white/25 flex items-center justify-center z-10"
        aria-label="Chiudi"
      >
        <X className="w-7 h-7" />
      </button>

      {top.length > 1 && (
        <>
          <button
            onClick={prev}
            className="absolute left-3 top-1/2 -translate-y-1/2 min-w-[64px] min-h-[64px] rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center z-10"
            aria-label="Offerta precedente"
          >
            <ChevronLeft className="w-8 h-8" />
          </button>
          <button
            onClick={next}
            className="absolute right-3 top-1/2 -translate-y-1/2 min-w-[64px] min-h-[64px] rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center z-10"
            aria-label="Offerta successiva"
          >
            <ChevronRight className="w-8 h-8" />
          </button>
        </>
      )}

      <div className="h-full w-full flex flex-col items-center justify-center px-8 py-12 text-center">
        <div className="text-xs sm:text-sm uppercase tracking-[0.3em] opacity-70 mb-4">
          Risparmio annuo · Offerta {idx + 1} di {top.length}
        </div>

        <button
          onClick={() => setShowBreakdown(true)}
          className="relative leading-none"
          aria-label="Mostra breakdown risparmio"
        >
          <span
            className="block font-extrabold tabular-nums text-green-300 drop-shadow-[0_4px_24px_rgba(0,0,0,0.4)]"
            style={{ fontSize: "clamp(5rem, 16vw, 11rem)" }}
          >
            +{eur(Math.round(risparmioAnno))}
          </span>
          <AnimatePresence>
            {showBreakdown && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                className="absolute left-1/2 -translate-x-1/2 mt-2 px-4 py-2 rounded-xl bg-black/40 backdrop-blur text-sm font-medium whitespace-nowrap"
              >
                Materia prima: −{eur(Math.round(materiaContributo))} · Quota fissa: −{eur(Math.round(quotaFissaAnnua))}
              </motion.div>
            )}
          </AnimatePresence>
        </button>

        <div className="w-full max-w-3xl border-t border-white/20 my-10" />

        <div className="grid grid-cols-2 gap-10 w-full max-w-3xl">
          <div>
            <div
              className="font-extrabold tabular-nums text-green-200"
              style={{ fontSize: "clamp(1.8rem, 5vw, 3rem)" }}
            >
              {eur(risparmioMese)}/mese
            </div>
            <div className="text-base opacity-70 mt-1">risparmio</div>
          </div>
          <div>
            <div
              className="font-extrabold tabular-nums"
              style={{ fontSize: "clamp(1.8rem, 5vw, 3rem)" }}
            >
              {eur(nuovoFissoMese)}/mese
            </div>
            <div className="text-base opacity-70 mt-1">nuovo fisso</div>
          </div>
        </div>

        <div className="w-full max-w-3xl border-t border-white/20 my-10" />

        <div
          className="font-bold uppercase tracking-wider"
          style={{ fontSize: "clamp(1rem, 2.4vw, 1.6rem)" }}
        >
          {current.fornitore_nome} · {current.nome}
        </div>

        {top.length > 1 && (
          <div className="flex gap-2 mt-6">
            {top.map((_, i) => (
              <button
                key={i}
                onClick={() => setIdx(i)}
                className={cn(
                  "w-2 h-2 rounded-full transition-all",
                  i === idx ? "bg-white scale-125" : "bg-white/30",
                )}
                aria-label={`Offerta ${i + 1}`}
              />
            ))}
          </div>
        )}

        <button
          onClick={onClose}
          className={cn(
            "mt-10 inline-flex items-center gap-2 px-8 py-4 min-h-[56px] rounded-2xl",
            "bg-white text-primary font-semibold shadow-xl hover:bg-white/90 transition",
          )}
        >
          <ChevronLeft className="w-5 h-5" />
          Torna alla classifica
        </button>
      </div>
    </div>
  );
}
