import { useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown, LineChart as LineChartIcon } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, ReferenceDot } from "recharts";
import type { CTE, DatiCliente, Impostazioni, RisultatoOfferta } from "@/lib/board/types";
import { simulaBollettaLuce, simulaBollettaGas } from "@/lib/board/calcoli";
import { eur } from "@/lib/board/formatters";
import { cn } from "@/lib/utils";
import { useShowIva } from "@/hooks/useShowIva";
import { aliquotaIvaCliente, applicaIva, etichettaIva } from "@/lib/board/iva";

const MESI_IT = ["Gen", "Feb", "Mar", "Apr", "Mag", "Giu", "Lug", "Ago", "Set", "Ott", "Nov", "Dic"];

interface Props {
  tipo: "luce" | "gas";
  cte: CTE;
  dati: DatiCliente;
  imp: Impostazioni;
  classifica: RisultatoOfferta[];
}

function mesiDaValidita(v?: string | null): number | null {
  if (!v) return null;
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

export function Proiezione12Mesi({ tipo, cte, dati, imp, classifica }: Props) {
  const [open, setOpen] = useState(false);
  const showIva = useShowIva();
  const aliq = aliquotaIvaCliente(dati, imp);
  const ris = classifica.find((r) => r.cte.id === cte.id) ?? classifica[0];

  const data = useMemo(() => {
    if (!ris) return [];
    const start = new Date();
    const mesiOff: { mese: string; year: number }[] = [];
    for (let i = 0; i < 12; i++) {
      const d = new Date(start.getFullYear(), start.getMonth() + i, 1);
      mesiOff.push({ mese: MESI_IT[d.getMonth()], year: d.getFullYear() });
    }

    const costoClienteMensile = ris.costoCliente / 12;
    const isIndex = cte.tipo_prezzo === "index";
    const futuresPun = [imp.pun_futures_1, imp.pun_futures_2, imp.pun_futures_3];
    const futuresPsv = [imp.psv_futures_1, imp.psv_futures_2, imp.psv_futures_3];
    const validitaMesi = mesiDaValidita(cte.validita);

    return mesiOff.map((m, i) => {
      let nuovo: number;
      let scadenza = false;

      if (isIndex) {
        const futPun = i < 3 ? futuresPun[i] : null;
        const futPsv = i < 3 ? futuresPsv[i] : null;
        const impMese: Impostazioni = {
          ...imp,
          pun_riferimento: futPun ?? imp.pun_riferimento,
          pun_f1: futPun != null ? futPun * 1.12 : imp.pun_f1,
          pun_f2: futPun != null ? futPun * 1.04 : imp.pun_f2,
          pun_f3: futPun != null ? futPun * 0.88 : imp.pun_f3,
          psv_riferimento: futPsv ?? imp.psv_riferimento,
        };
        nuovo = tipo === "luce"
          ? simulaBollettaLuce(cte, dati, impMese).totaleMese
          : simulaBollettaGas(cte, dati, impMese).totaleMese;
      } else {
        nuovo = ris.costoOfferta / 12;
        if (validitaMesi != null && i + 1 === validitaMesi) scadenza = true;
      }

      return {
        label: `${m.mese} '${String(m.year).slice(-2)}`,
        cliente: Math.round(costoClienteMensile),
        nuovo: Math.round(nuovo),
        scadenza,
        idx: i,
      };
    });
  }, [ris, cte, dati, imp, tipo]);

  const cumulato = useMemo(
    () => data.reduce((s, d) => s + (d.cliente - d.nuovo), 0),
    [data],
  );

  if (!ris) return null;
  const scadIdx = data.findIndex((d) => d.scadenza);

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <Card className="p-3">
        <CollapsibleTrigger className="w-full flex items-center justify-between min-h-[44px] px-2">
          <span className="flex items-center gap-2 font-medium text-sm">
            <LineChartIcon className="w-4 h-4 text-primary" />
            Proiezione 12 mesi · {cte.nome}
          </span>
          <ChevronDown className={cn("w-4 h-4 transition-transform", open && "rotate-180")} />
        </CollapsibleTrigger>
        <CollapsibleContent className="pt-3">
          <div style={{ width: "100%", height: 300 }}>
            <ResponsiveContainer>
              <LineChart data={data} margin={{ top: 10, right: 16, bottom: 0, left: 0 }}>
                <XAxis dataKey="label" tick={{ fontSize: 11 }} interval={0} angle={-25} textAnchor="end" height={50} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `€${v}`} width={56} />
                <Tooltip
                  formatter={(v, name) => [`€${v}`, name === "cliente" ? "Attuale" : "Nuova"]}
                  labelStyle={{ fontWeight: 600 }}
                />
                <Legend
                  wrapperStyle={{ fontSize: 12 }}
                  formatter={(v) => (v === "cliente" ? "Cliente attuale" : "Nuova offerta")}
                />
                <Line type="monotone" dataKey="cliente" stroke="hsl(var(--destructive))" strokeWidth={2.5} dot={{ r: 3 }} activeDot={{ r: 6 }} />
                <Line type="monotone" dataKey="nuovo" stroke="hsl(142 76% 36%)" strokeWidth={2.5} dot={{ r: 3 }} activeDot={{ r: 6 }} />
                {scadIdx >= 0 && (
                  <ReferenceDot x={data[scadIdx].label} y={data[scadIdx].nuovo} r={8} fill="hsl(var(--primary))" stroke="white" />
                )}
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 px-2 text-sm">
            <span className="text-muted-foreground">
              Risparmio cumulato 12 mesi:{" "}
              <strong className={cn(cumulato >= 0 ? "text-green-700" : "text-red-700")}>
                {cumulato >= 0 ? "+" : ""}{eur(Math.round(showIva ? applicaIva(cumulato, aliq) : cumulato))}
              </strong>
              {showIva && (
                <span className="ml-1 text-[10px] text-muted-foreground">{etichettaIva(aliq)}</span>
              )}
            </span>
            {scadIdx >= 0 && (
              <span className="text-xs text-primary font-medium">
                Scadenza condizioni: {data[scadIdx].label}
              </span>
            )}
            {cte.tipo_prezzo === "index" && !imp.pun_futures_1 && !imp.pun_futures_2 && !imp.pun_futures_3 && (
              <span className="text-xs text-muted-foreground italic">Stima PUN costante (nessun futures)</span>
            )}
          </div>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}
