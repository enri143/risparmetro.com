import { useState } from "react";
import { cn } from "@/lib/utils";
import { COMPLIANCE } from "@/lib/board/copilotContent";

export function CompliancePanel() {
  const [checked, setChecked] = useState<boolean[]>(() =>
    COMPLIANCE.map(() => false),
  );

  const completati = checked.filter(Boolean).length;
  const totale = COMPLIANCE.length;
  const tuttiOk = completati === totale;

  const toggle = (i: number) =>
    setChecked((prev) => prev.map((v, idx) => (idx === i ? !v : v)));

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-text-muted uppercase tracking-wide">
          Verificati
        </span>
        <span
          className={cn(
            "text-sm font-bold tabular-nums",
            tuttiOk ? "text-savings" : "text-text-base",
          )}
        >
          {completati} / {totale}
        </span>
      </div>

      {tuttiOk && (
        <div className="rounded-xl bg-savings-subtle border border-savings px-3 py-2 text-xs font-medium text-savings">
          Tutti i requisiti di compliance verificati.
        </div>
      )}

      <div className="space-y-1.5">
        {COMPLIANCE.map((item, i) => (
          <button
            key={i}
            type="button"
            onClick={() => toggle(i)}
            className={cn(
              "w-full flex items-start gap-3 px-3 py-3 rounded-xl border text-left text-sm transition-colors min-h-[52px]",
              checked[i]
                ? "border-savings bg-savings-subtle text-savings-subtle-foreground"
                : "border-border-ui bg-white text-text-base hover:bg-surface-subtle",
            )}
          >
            <span
              className={cn(
                "mt-0.5 w-5 h-5 shrink-0 rounded border-2 flex items-center justify-center transition-colors",
                checked[i]
                  ? "border-savings bg-savings"
                  : "border-border-ui bg-white",
              )}
            >
              {checked[i] && (
                <svg viewBox="0 0 10 8" className="w-3 h-3">
                  <path d="M1 4l3 3 5-6" stroke="white" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
            </span>
            <span className={cn(checked[i] && "line-through opacity-60")}>{item}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
