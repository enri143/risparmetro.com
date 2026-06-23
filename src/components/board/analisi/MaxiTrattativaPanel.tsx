import { useEffect, useMemo, useRef, useState } from "react";
import { useMotionValue, animate, motion, AnimatePresence } from "motion/react";
import confetti from "canvas-confetti";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import type { RisultatoOfferta } from "@/lib/board/calcoloOfferte";
import { eur } from "@/lib/board/formatters";
import { cn } from "@/lib/utils";
import { useTenantBranding } from "@/hooks/useTenantBranding";

// ── Types ──────────────────────────────────────────────────────────────────────

interface Props {
  luce: RisultatoOfferta[];
  gas: RisultatoOfferta[];
  onClose: () => void;
  revealMode?: boolean;
}

const SAVINGS_COLOR = "#16a34a";

// ── Confetti ───────────────────────────────────────────────────────────────────

function lighten(hex: string): string {
  const n = parseInt(hex.replace("#", ""), 16);
  const r = Math.min(255, ((n >> 16) & 0xff) + 60);
  const g = Math.min(255, ((n >> 8) & 0xff) + 60);
  const b = Math.min(255, (n & 0xff) + 60);
  return `#${[r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("")}`;
}

function fireConfetti(color: string) {
  confetti({
    particleCount: 130,
    spread: 80,
    origin: { y: 0.55 },
    colors: [color, "#ffffff", lighten(color)],
    gravity: 1.2,
  });
}

// ── Component ─────────────────────────────────────────────────────────────────

export function MaxiTrattativaPanel({ luce, gas, onClose, revealMode = false }: Props) {
  const top = useMemo(() => {
    const base = luce.length > 0 ? luce : gas;
    return base.filter((r) => r.risparmio_annuo > 0).slice(0, 5);
  }, [luce, gas]);

  // ── Carousel state ──────────────────────────────────────────────────────────
  const [idx, setIdx] = useState(0);
  const [showBreakdown, setShowBreakdown] = useState(false);
  const touchStartX = useRef<number | null>(null);

  // ── Reveal state ────────────────────────────────────────────────────────────
  const [step, setStep] = useState<"agent" | "reveal" | "maxi">(
    revealMode ? "agent" : "maxi",
  );
  const [displayCount, setDisplayCount] = useState(eur(0));
  const { branding } = useTenantBranding();
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);
  const count = useMotionValue(0);

  // Wake lock when client-reveal is active
  useEffect(() => {
    if (step !== "reveal") return;
    const acquire = async () => {
      try {
        wakeLockRef.current = await navigator.wakeLock.request("screen");
      } catch { /* not supported or permission denied — silent */ }
    };
    acquire();
    return () => {
      wakeLockRef.current?.release().catch(() => {});
      wakeLockRef.current = null;
    };
  }, [step]);

  // Count-up animation when entering reveal
  useEffect(() => {
    if (step !== "reveal" || !top[0]) return;
    const target = top[0].risparmio_annuo;
    const accentColor = branding?.accent_color ?? SAVINGS_COLOR;
    const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (prefersReduced) {
      setDisplayCount(eur(Math.round(target)));
      return;
    }

    let mounted = true;
    count.set(0);
    setDisplayCount(eur(0));

    const unsub = count.on("change", (v) => {
      if (mounted) setDisplayCount(eur(Math.round(v)));
    });

    const controls = animate(count, target, { duration: 2.5, ease: "easeOut" });

    controls.then(
      () => {
        if (!mounted) return;
        setDisplayCount(eur(Math.round(target)));
        fireConfetti(accentColor);
      },
      () => {},
    );

    return () => {
      mounted = false;
      controls.stop();
      unsub();
    };
  }, [step, top, branding?.accent_color, count]);

  // ── Existing carousel effects ───────────────────────────────────────────────
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
    if (Math.abs(delta) > 50 && top.length > 1) delta > 0 ? next() : prev();
    touchStartX.current = null;
  };

  const handleClose = () => {
    wakeLockRef.current?.release().catch(() => {});
    onClose();
  };

  const accentColor = branding?.accent_color ?? SAVINGS_COLOR;

  // ── Phase 1: Agente ─────────────────────────────────────────────────────────
  if (step === "agent") {
    return (
      <div className="fixed inset-0 z-50 bg-gradient-to-br from-primary/95 via-primary to-black text-primary-foreground flex flex-col items-center justify-center p-6">
        <button
          onClick={handleClose}
          className="absolute top-4 right-4 min-w-[44px] min-h-[44px] rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center"
          aria-label="Chiudi"
        >
          <X className="w-6 h-6" />
        </button>

        {top.length === 0 ? (
          <div className="text-center space-y-4">
            <p className="text-xl opacity-80">
              Nessuna offerta in risparmio da mostrare.
            </p>
            <button
              onClick={handleClose}
              className="px-6 py-3 min-h-[48px] rounded-xl bg-white text-primary font-semibold"
            >
              Torna alla classifica
            </button>
          </div>
        ) : (
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 14 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ duration: 0.3, ease: "easeOut" }}
            className="w-full max-w-sm bg-white/10 backdrop-blur border border-white/20 rounded-3xl p-8 text-center space-y-6"
          >
            <div className="text-6xl select-none leading-none">🔄</div>
            <div>
              <h2 className="text-2xl sm:text-3xl font-bold tracking-tight leading-tight">
                ORA GIRA IL TABLET
              </h2>
              <p className="mt-3 text-sm sm:text-base opacity-70 leading-relaxed">
                Poi tocca il bottone per rivelare il risparmio al cliente
              </p>
            </div>
            <button
              onClick={() => setStep("reveal")}
              className="w-full min-h-[56px] rounded-2xl bg-white font-bold text-lg shadow-xl hover:bg-white/90 transition-all active:scale-95"
              style={{ color: accentColor }}
            >
              Mostra il risparmio
            </button>
          </motion.div>
        )}
      </div>
    );
  }

  // ── Phase 2: Cliente ────────────────────────────────────────────────────────
  if (step === "reveal") {
    return (
      <div className="fixed inset-0 z-[100] bg-white flex flex-col items-center justify-center overflow-hidden select-none">
        {/* Logo tenant */}
        <div className="absolute top-8 inset-x-0 flex justify-center px-6">
          {branding?.logo_url ? (
            <img
              src={branding.logo_url}
              alt={branding?.brand_name ?? ""}
              className="max-h-16 max-w-[180px] object-contain"
              draggable={false}
            />
          ) : (
            <div
              className="w-12 h-12 rounded-full"
              style={{ backgroundColor: accentColor }}
            />
          )}
        </div>

        {/* Hero number con spring entrance */}
        <motion.div
          initial={{ scale: 0.5, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 220, damping: 24 }}
          className="text-center px-4"
        >
          <div
            className="font-extrabold tabular-nums leading-none"
            style={{
              fontSize: "clamp(4.5rem, 18vw, 13rem)",
              color: accentColor,
            }}
          >
            +{displayCount}
          </div>
          <div
            className="mt-5 text-xl sm:text-2xl font-medium tracking-wide"
            style={{ color: accentColor, opacity: 0.6 }}
          >
            di risparmio all'anno
          </div>
        </motion.div>

        {/* Continua (discreto) */}
        <button
          onClick={handleClose}
          className="absolute bottom-8 px-10 py-3 min-h-[48px] rounded-full border border-gray-200 text-sm font-medium text-gray-400 hover:text-gray-600 hover:border-gray-300 transition-colors"
        >
          Continua →
        </button>
      </div>
    );
  }

  // ── Maxi carousel esistente ─────────────────────────────────────────────────
  const current = top[idx];

  if (!current) {
    return (
      <div className="fixed inset-0 z-50 bg-gradient-to-br from-primary/95 via-primary to-black text-primary-foreground flex flex-col items-center justify-center p-6">
        <button
          onClick={handleClose}
          className="absolute top-4 right-4 min-w-[44px] min-h-[44px] rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center"
          aria-label="Chiudi"
        >
          <X className="w-6 h-6" />
        </button>
        <p className="text-2xl font-medium opacity-90">
          Nessuna offerta in risparmio da mostrare.
        </p>
        <button
          onClick={handleClose}
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
        onClick={handleClose}
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
          onClick={handleClose}
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
