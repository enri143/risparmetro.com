import { Zap, Flame, TrendingDown } from "lucide-react";
import { Card } from "@/components/ui/card";
import { eur } from "@/lib/board/formatters";
import type { RisultatoOfferta } from "@/lib/board/types";

function BarRow({
  label,
  Icon,
  costoCliente,
  costoOfferta,
  risparmio,
}: {
  label: string;
  Icon: React.ElementType;
  costoCliente: number;
  costoOfferta: number;
  risparmio: number;
}) {
  const max = Math.max(costoCliente, costoOfferta, 1);
  const pctAttuale = (costoCliente / max) * 100;
  const pctOfferta = (costoOfferta / max) * 100;

  return (
    <div className="space-y-2.5">
      <div className="flex items-center gap-2 text-sm font-semibold">
        <Icon className="w-4 h-4" />
        <span>{label}</span>
      </div>
      <div className="space-y-1.5">
        <div className="flex items-center gap-3">
          <div className="w-32 shrink-0 text-right text-xs text-muted-foreground">Spesa attuale</div>
          <div className="flex-1">
            <div className="h-9 rounded-lg bg-red-100 overflow-hidden">
              <div
                className="h-full bg-red-400 rounded-lg transition-all duration-500"
                style={{ width: `${pctAttuale}%` }}
              />
            </div>
          </div>
          <div className="w-24 shrink-0 text-right text-sm font-semibold">{eur(costoCliente)}</div>
        </div>
        <div className="flex items-center gap-3">
          <div className="w-32 shrink-0 text-right text-xs text-muted-foreground">Miglior offerta</div>
          <div className="flex-1">
            <div className="h-9 rounded-lg bg-green-100 overflow-hidden">
              <div
                className="h-full bg-green-400 rounded-lg transition-all duration-500"
                style={{ width: `${pctOfferta}%` }}
              />
            </div>
          </div>
          <div className="w-24 shrink-0 text-right text-sm font-semibold">{eur(costoOfferta)}</div>
        </div>
      </div>
      {risparmio > 0 && (
        <div className="flex items-center justify-end gap-1.5 text-sm text-green-700 font-semibold">
          <TrendingDown className="w-4 h-4" />
          <span>Risparmio: +{eur(risparmio)}/anno</span>
        </div>
      )}
    </div>
  );
}

interface Props {
  luce: RisultatoOfferta[];
  gas: RisultatoOfferta[];
}

export function BeforeAfterBar({ luce, gas }: Props) {
  const bestLuce = luce[0];
  const bestGas = gas[0];
  if (!bestLuce && !bestGas) return null;

  return (
    <Card className="p-4 sm:p-5 space-y-5">
      <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
        Spesa annua: prima e dopo
      </div>
      {bestLuce && (
        <BarRow
          label="Energia elettrica"
          Icon={Zap}
          costoCliente={bestLuce.costoCliente}
          costoOfferta={bestLuce.costoOfferta}
          risparmio={bestLuce.risparmio}
        />
      )}
      {bestLuce && bestGas && <div className="border-t" />}
      {bestGas && (
        <BarRow
          label="Gas naturale"
          Icon={Flame}
          costoCliente={bestGas.costoCliente}
          costoOfferta={bestGas.costoOfferta}
          risparmio={bestGas.risparmio}
        />
      )}
    </Card>
  );
}
