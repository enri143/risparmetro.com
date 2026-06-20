import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import type { CTE, RisultatoOfferta } from "@/lib/board/types";
import { RotateCcw } from "lucide-react";

export type ChipTipo = "tutte" | "fisso" | "index";
export type ChipFlag = "verde" | "noPenale" | "scadenza12" | "top3";

export interface Filtri {
  tipo: ChipTipo;
  flags: ChipFlag[];
}

const DEFAULT: Filtri = { tipo: "tutte", flags: [] };

function key(tipo: "luce" | "gas") { return `board_filters_${tipo}`; }

export function useFiltriRapidi(tipo: "luce" | "gas") {
  const [filtri, setFiltri] = useState<Filtri>(() => {
    try {
      const raw = localStorage.getItem(key(tipo));
      if (!raw) return DEFAULT;
      const p = JSON.parse(raw) as Filtri;
      return { tipo: p.tipo ?? "tutte", flags: Array.isArray(p.flags) ? p.flags : [] };
    } catch { return DEFAULT; }
  });

  useEffect(() => {
    try { localStorage.setItem(key(tipo), JSON.stringify(filtri)); } catch { /* noop */ }
  }, [filtri, tipo]);

  return { filtri, setFiltri };
}

function parseMesiValidita(v?: string | null): number | null {
  if (!v) return null;
  // accetta DD/MM/YYYY o "12 mesi" o "24 mesi"
  const m1 = v.match(/(\d+)\s*mes/i);
  if (m1) return parseInt(m1[1], 10);
  const m2 = v.match(/(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})/);
  if (m2) {
    const day = parseInt(m2[1], 10);
    const month = parseInt(m2[2], 10) - 1;
    let year = parseInt(m2[3], 10);
    if (year < 100) year += 2000;
    const target = new Date(year, month, day).getTime();
    const diff = target - Date.now();
    return diff > 0 ? Math.round(diff / (1000 * 60 * 60 * 24 * 30)) : 0;
  }
  return null;
}

export function applicaFiltri(items: RisultatoOfferta[], f: Filtri): RisultatoOfferta[] {
  let out = items;
  if (f.tipo === "fisso") out = out.filter((r) => r.cte.tipo_prezzo === "fisso");
  if (f.tipo === "index") out = out.filter((r) => r.cte.tipo_prezzo === "index");
  if (f.flags.includes("verde")) out = out.filter((r) => isVerde(r.cte));
  if (f.flags.includes("noPenale")) out = out.filter((r) => !r.cte.penale_recesso);
  if (f.flags.includes("scadenza12")) out = out.filter((r) => {
    const m = parseMesiValidita(r.cte.validita);
    return m == null || m > 12;
  });
  if (f.flags.includes("top3")) out = out.slice(0, 3);
  return out;
}

export function isVerde(cte: CTE): boolean {
  const ev = (cte as CTE & { energia_verde?: boolean | null }).energia_verde;
  if (ev) return true;
  return /\b(verde|green|100%\s*rinnov|eco)\b/i.test(`${cte.nome} ${cte.note ?? ""}`);
}

interface Props {
  tipo: "luce" | "gas";
  filtri: Filtri;
  onChange: (f: Filtri) => void;
  total: number;
  shown: number;
}

const TIPI: { v: ChipTipo; l: string }[] = [
  { v: "tutte", l: "Tutte" },
  { v: "fisso", l: "⚡ Solo fisso" },
  { v: "index", l: "📈 Solo index" },
];
const FLAGS: { v: ChipFlag; l: string }[] = [
  { v: "verde", l: "🌿 Solo verde" },
  { v: "noPenale", l: "✅ Senza penale" },
  { v: "scadenza12", l: "⏱ Scadenza > 12m" },
  { v: "top3", l: "💰 Top 3 risparmio" },
];

export function FiltriRapidiChips({ filtri, onChange, total, shown }: Props) {
  const attivi = filtri.tipo !== "tutte" || filtri.flags.length > 0;

  const toggleFlag = (v: ChipFlag) => {
    const has = filtri.flags.includes(v);
    onChange({ ...filtri, flags: has ? filtri.flags.filter((x) => x !== v) : [...filtri.flags, v] });
  };

  return (
    <div className="space-y-2">
      <div
        className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1"
        style={{ maskImage: "linear-gradient(90deg, transparent, #000 12px, #000 calc(100% - 12px), transparent)" }}
      >
        {TIPI.map((o) => (
          <button
            key={o.v}
            onClick={() => onChange({ ...filtri, tipo: o.v })}
            className={cn(
              "shrink-0 min-h-[44px] px-4 rounded-full text-sm font-medium border-2 transition-colors",
              filtri.tipo === o.v
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-background border-border text-muted-foreground hover:text-foreground",
            )}
          >
            {o.l}
          </button>
        ))}
        <div className="shrink-0 w-px bg-border mx-1 self-stretch" />
        {FLAGS.map((o) => {
          const active = filtri.flags.includes(o.v);
          return (
            <button
              key={o.v}
              onClick={() => toggleFlag(o.v)}
              className={cn(
                "shrink-0 min-h-[44px] px-4 rounded-full text-sm font-medium border-2 transition-colors",
                active
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-background border-border text-muted-foreground hover:text-foreground",
              )}
            >
              {o.l}
            </button>
          );
        })}
      </div>
      <div className="flex items-center justify-between text-xs text-muted-foreground px-1">
        <span>Mostro <strong className="text-foreground">{shown}</strong> di {total} offerte</span>
        {attivi && (
          <button onClick={() => onChange(DEFAULT)} className="flex items-center gap-1 hover:text-foreground min-h-[32px]">
            <RotateCcw className="w-3 h-3" /> Reset filtri
          </button>
        )}
      </div>
    </div>
  );
}

export const DEFAULT_FILTRI = DEFAULT;
