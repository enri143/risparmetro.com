import { Zap, Flame } from "lucide-react";
import { eur } from "@/lib/board/formatters";
import type { RisultatoOfferta } from "@/lib/board/types";

interface Props {
  luce: RisultatoOfferta[];
  gas: RisultatoOfferta[];
}

export function HeroRisparmio({ luce, gas }: Props) {
  const bestLuce = luce[0];
  const bestGas = gas[0];
  const rispLuce = bestLuce?.risparmio ?? 0;
  const rispGas = bestGas?.risparmio ?? 0;
  const totale = (rispLuce > 0 ? rispLuce : 0) + (rispGas > 0 ? rispGas : 0);

  if (totale <= 0) return null;

  return (
    <div className="rounded-2xl bg-gradient-to-br from-teal-700 via-teal-600 to-teal-500 text-white p-6 sm:p-8 shadow-xl space-y-4">
      <div className="text-xs sm:text-sm font-semibold text-teal-200 uppercase tracking-widest">
        Risparmio totale stimato
      </div>

      <div className="text-5xl sm:text-6xl lg:text-7xl font-bold tabular-nums leading-none">
        +{eur(totale)}/anno
      </div>

      <div className="text-lg sm:text-xl text-teal-100 font-medium">
        equivale a{" "}
        <span className="font-bold text-white">+{eur(totale / 12)}/mese</span>
      </div>

      {(rispLuce > 0 || rispGas > 0) && (
        <div className="grid grid-cols-2 gap-4 pt-3 border-t border-teal-400/40">
          {bestLuce && rispLuce > 0 && (
            <div className="space-y-0.5">
              <div className="flex items-center gap-1.5 text-teal-200 text-xs">
                <Zap className="w-3.5 h-3.5" /> Luce
              </div>
              <div className="text-xl font-bold">+{eur(rispLuce)}/anno</div>
              <div className="text-xs text-teal-200 truncate">{bestLuce.cte.nome}</div>
            </div>
          )}
          {bestGas && rispGas > 0 && (
            <div className="space-y-0.5">
              <div className="flex items-center gap-1.5 text-teal-200 text-xs">
                <Flame className="w-3.5 h-3.5" /> Gas
              </div>
              <div className="text-xl font-bold">+{eur(rispGas)}/anno</div>
              <div className="text-xs text-teal-200 truncate">{bestGas.cte.nome}</div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
