import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { proiezione12Mesi } from "@/lib/board/proiezione";
import { eur } from "@/lib/board/formatters";

interface Props {
  spesaAnnua: number;
  costoOfferta: number;
  nomeOfferta?: string;
}

export function Proiezione12Mesi({ spesaAnnua, costoOfferta, nomeOfferta }: Props) {
  const risparmioTotale = spesaAnnua - costoOfferta;

  if (risparmioTotale <= 0) {
    return (
      <div className="bg-white border border-border-ui rounded-xl p-5">
        <p className="text-[10px] font-bold uppercase tracking-wider text-text-muted mb-1">
          Risparmio cumulato a 12 mesi
        </p>
        {nomeOfferta && (
          <p className="text-xs text-text-muted mb-3">{nomeOfferta}</p>
        )}
        <p className="text-sm text-text-muted">
          Nessun risparmio stimato per questa offerta.
        </p>
      </div>
    );
  }

  const punti = proiezione12Mesi(spesaAnnua, costoOfferta);

  return (
    <div className="bg-white border border-border-ui rounded-xl p-5">
      <div className="flex items-start justify-between mb-4">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-text-muted">
            Risparmio cumulato a 12 mesi
          </p>
          {nomeOfferta && (
            <p className="text-xs text-text-muted mt-0.5">{nomeOfferta}</p>
          )}
        </div>
        <div className="text-right shrink-0 ml-4">
          <p className="text-[10px] font-bold uppercase tracking-wider text-text-muted">
            Fine anno
          </p>
          <p className="text-2xl font-bold text-savings leading-tight tnum">
            +{eur(risparmioTotale)}
          </p>
        </div>
      </div>

      <ResponsiveContainer width="100%" height={160}>
        <AreaChart data={punti} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="savingsGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#22c55e" stopOpacity={0.12} />
              <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="#e5e7eb"
            vertical={false}
          />
          <XAxis
            dataKey="mese"
            tick={{ fontSize: 10, fill: "#9ca3af" }}
            tickLine={false}
            axisLine={false}
            tickFormatter={(v: number) => `M${v}`}
          />
          <YAxis
            tick={{ fontSize: 10, fill: "#9ca3af" }}
            tickLine={false}
            axisLine={false}
            width={48}
            tickFormatter={(v: number) => `${v}€`}
          />
          <Tooltip
            contentStyle={{
              fontSize: 12,
              border: "1px solid #e5e7eb",
              borderRadius: 8,
              boxShadow: "none",
              padding: "6px 10px",
            }}
            formatter={(value) => [`+${eur(Number(value))}`, "Risparmio"]}
            labelFormatter={(label) => `Mese ${label}`}
          />
          <Area
            type="monotone"
            dataKey="risparmioCumulato"
            stroke="#22c55e"
            strokeWidth={2}
            fill="url(#savingsGrad)"
            dot={false}
            activeDot={{ r: 4, strokeWidth: 0, fill: "#22c55e" }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
