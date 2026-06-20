import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts";
import type { CTE, DatiCliente, SimulazioneBolletta } from "@/lib/board/types";
import { eur } from "@/lib/board/formatters";

const COLORS = { materia: "#f97316", trasporto: "#22c55e", oneri: "#3b82f6", imposte: "#475569", rai: "#a855f7" };

export function SimulazioneBollettaView({ sim, cte, dati }: { sim: SimulazioneBolletta; cte: CTE; dati: DatiCliente }) {
  const isLuce = cte.tipo === "luce";
  const data = [
    { name: "Materia", value: sim.spesaMateria, color: COLORS.materia },
    { name: "Trasporto", value: sim.spesaTrasporto, color: COLORS.trasporto },
    { name: "Oneri", value: sim.spesaOneri, color: COLORS.oneri },
    { name: "Imposte", value: sim.spesaImposte, color: COLORS.imposte },
  ];
  if (sim.canoneRaiMediaMese && sim.canoneRaiMediaMese > 0) {
    data.push({ name: "Canone RAI", value: sim.canoneRaiMediaMese, color: COLORS.rai });
  }

  const Row = ({ label, value, sub, color }: { label: string; value: number; sub?: boolean; color?: string }) => (
    <div className={`flex justify-between gap-2 text-sm ${sub ? "text-muted-foreground pl-4 text-xs" : ""}`}>
      <span className="flex items-center gap-2 min-w-0 break-words">
        {color && !sub && <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: color }} />}
        <span className="break-words">{label}</span>
      </span>
      <span className={`shrink-0 tabular-nums ${sub ? "" : "font-medium"}`}>{eur(value)}</span>
    </div>
  );

  return (
    <div className="mt-3 pt-3 border-t space-y-3">
      <div className="text-xs text-muted-foreground text-center">Simulazione bolletta mensile media</div>
      <div className="relative w-full h-44">
        <ResponsiveContainer>
          <PieChart>
            <Pie data={data} dataKey="value" innerRadius={50} outerRadius={75} paddingAngle={2}>
              {data.map((d, i) => <Cell key={i} fill={d.color} />)}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <div className="text-xs text-muted-foreground">Totale mese</div>
          <div className="font-bold text-lg">{eur(sim.totaleMese)}</div>
        </div>
      </div>
      <div className="space-y-1.5">
        <Row label="Spesa materia energia" value={sim.spesaMateria} color={COLORS.materia} />
        <Row label={`Quota fissa fornitore`} value={sim.dettaglioMateria.quotaFissaFornitore} sub />
        {sim.dettaglioMateria.corrispettiviFasce ? (
          <>
            <Row label={`Corrispettivo F1 (${Math.round(sim.dettaglioMateria.corrispettiviFasce.kwhF1)} kWh × ${sim.dettaglioMateria.corrispettiviFasce.prezzoF1.toFixed(4)})`} value={sim.dettaglioMateria.corrispettiviFasce.f1} sub />
            <Row label={`Corrispettivo F2 (${Math.round(sim.dettaglioMateria.corrispettiviFasce.kwhF2)} kWh × ${sim.dettaglioMateria.corrispettiviFasce.prezzoF2.toFixed(4)})`} value={sim.dettaglioMateria.corrispettiviFasce.f2} sub />
            <Row label={`Corrispettivo F3 (${Math.round(sim.dettaglioMateria.corrispettiviFasce.kwhF3)} kWh × ${sim.dettaglioMateria.corrispettiviFasce.prezzoF3.toFixed(4)})`} value={sim.dettaglioMateria.corrispettiviFasce.f3} sub />
          </>
        ) : (
          <Row label={`Corrispettivo${isLuce ? " × perdite" : ""}`} value={sim.dettaglioMateria.corrispettivo} sub />
        )}

        <Row label="Trasporto e gestione contatore" value={sim.spesaTrasporto} color={COLORS.trasporto} />
        <Row label="Quota fissa rete" value={sim.dettaglioTrasporto.quotaFissa} sub />
        {isLuce && sim.dettaglioTrasporto.quotaPotenza !== undefined && (
          <Row label={`Quota potenza (${dati.potenzaKw} kW)`} value={sim.dettaglioTrasporto.quotaPotenza} sub />
        )}
        <Row label="Quota variabile" value={sim.dettaglioTrasporto.quotaVariabile} sub />

        <Row label="Oneri di sistema" value={sim.spesaOneri} color={COLORS.oneri} />

        <Row label="Imposte" value={sim.spesaImposte} color={COLORS.imposte} />
        <Row label="Accise" value={sim.dettaglioImposte.accise} sub />
        <Row label="IVA" value={sim.dettaglioImposte.iva} sub />

        {sim.canoneRaiMediaMese && sim.canoneRaiMediaMese > 0 && (
          <Row label="Canone RAI (media mensile)" value={sim.canoneRaiMediaMese} color={COLORS.rai} />
        )}
      </div>
      <div className="pt-2 border-t flex justify-between font-semibold">
        <span>Totale annuo stimato</span>
        <span>{eur(sim.totaleAnno)}</span>
      </div>
    </div>
  );
}
