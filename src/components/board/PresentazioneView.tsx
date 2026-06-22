import { useMemo, useState } from "react";
import { Flame, Lock, Zap } from "lucide-react";
import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Proiezione12Mesi } from "./analisi/Proiezione12Mesi";
import { cn } from "@/lib/utils";
import { eur } from "@/lib/board/formatters";
import {
  type DatiCliente,
  type ParametriRegolati,
  type RisultatoOfferta,
} from "@/lib/board/calcoloOfferte";

// ── Toggle switch ─────────────────────────────────────────────────────────────

function Toggle({ on, onToggle }: { on: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={onToggle}
      className={cn(
        "relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors",
        on ? "bg-brand" : "bg-border-ui",
      )}
    >
      <span
        className={cn(
          "inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform",
          on ? "translate-x-6" : "translate-x-1",
        )}
      />
    </button>
  );
}

// ── ConfrontoCard ─────────────────────────────────────────────────────────────

function ConfrontoCard({
  icon,
  title,
  nomeMigliorOfferta,
  spesaDisplay,
  costoDisplay,
  risparmioDisplay,
}: {
  icon: "luce" | "gas";
  title: string;
  nomeMigliorOfferta: string;
  spesaDisplay: number;
  costoDisplay: number;
  risparmioDisplay: number;
}) {
  const isLuce = icon === "luce";
  const barWidth = spesaDisplay > 0
    ? Math.min(100, Math.round((costoDisplay / spesaDisplay) * 100))
    : 100;

  return (
    <div className="bg-white border border-border-ui rounded-xl p-6 shadow-sm">
      <div className="flex items-center gap-3 mb-5">
        <div
          className={cn(
            "w-10 h-10 rounded-full flex items-center justify-center",
            isLuce
              ? "bg-yellow-50 border border-yellow-100"
              : "bg-orange-50 border border-orange-100",
          )}
        >
          {isLuce
            ? <Zap className="w-5 h-5 text-yellow-500" />
            : <Flame className="w-5 h-5 text-orange-500" />}
        </div>
        <h3 className="font-semibold text-lg text-text-base">{title}</h3>
        <span className="ml-auto text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-surface-subtle border border-border-ui text-text-muted">
          Attuale vs Offerta
        </span>
      </div>

      <div className="space-y-5">
        {/* Spesa attuale — barra rossa piena */}
        <div>
          <div className="flex justify-between text-xs mb-2 text-text-muted">
            <span>Spesa attuale stimata</span>
            <span className="font-bold text-text-base">{eur(spesaDisplay)}/anno</span>
          </div>
          <div className="h-4 bg-surface-subtle rounded-full overflow-hidden">
            <div className="h-full bg-spend-bar w-full rounded-full" />
          </div>
        </div>

        {/* Miglior offerta — barra verde proporzionale */}
        <div>
          <div className="flex justify-between text-xs mb-2 text-text-muted">
            <span>
              Miglior offerta trovata
              <span className="ml-1 font-medium text-brand">({nomeMigliorOfferta})</span>
            </span>
            <span className="font-bold text-savings">{eur(costoDisplay)}/anno</span>
          </div>
          <div className="h-4 bg-surface-subtle rounded-full overflow-hidden">
            <div
              className="h-full bg-savings-bar rounded-full"
              style={{ width: `${barWidth}%` }}
            />
          </div>
        </div>

        {/* Risparmio */}
        <div className="pt-4 border-t border-border-ui flex justify-between items-center">
          <span className="text-sm text-text-muted">Risparmio {title}:</span>
          <span className="font-bold text-xl text-savings">+{eur(risparmioDisplay)}</span>
        </div>
      </div>
    </div>
  );
}

// ── BeforeAfterCard ───────────────────────────────────────────────────────────

function BeforeAfterCard({
  spesaAnnua,
  costoOfferta,
  risparmioAnnuo,
  nomeOfferta,
  durataBloccoMesi,
}: {
  spesaAnnua: number;
  costoOfferta: number;
  risparmioAnnuo: number;
  nomeOfferta: string;
  durataBloccoMesi?: number;
}) {
  const data = [
    { name: "Attuale", valore: spesaAnnua },
    { name: nomeOfferta, valore: costoOfferta },
  ];
  const labelTrunc = (s: string) => s.length > 13 ? s.slice(0, 13) + "…" : s;
  const durataTotale = durataBloccoMesi ? risparmioAnnuo * (durataBloccoMesi / 12) : null;

  return (
    <div className="bg-white border border-border-ui rounded-xl p-5">
      <p className="text-[10px] font-bold uppercase tracking-wider text-text-muted mb-3">
        Prima / Dopo (annuo)
      </p>
      <ResponsiveContainer width="100%" height={96}>
        <BarChart data={data} layout="vertical" margin={{ top: 0, right: 56, left: 0, bottom: 0 }}>
          <XAxis type="number" hide />
          <YAxis
            type="category"
            dataKey="name"
            tick={{ fontSize: 11, fill: "#6b7280" }}
            tickLine={false}
            axisLine={false}
            width={96}
            tickFormatter={labelTrunc}
          />
          <Tooltip
            contentStyle={{ fontSize: 12, border: "1px solid #e5e7eb", borderRadius: 8, boxShadow: "none", padding: "6px 10px" }}
            formatter={(value: unknown) => [eur(Number(value)) + "/anno", ""]}
            labelFormatter={(label) => String(label)}
          />
          <Bar dataKey="valore" radius={[0, 4, 4, 0]} maxBarSize={28}>
            <Cell fill="#ef4444" />
            <Cell fill="#22c55e" />
          </Bar>
        </BarChart>
      </ResponsiveContainer>

      <div className="mt-3 pt-3 border-t border-border-ui">
        {durataTotale !== null ? (
          <div className="flex items-center gap-2 text-sm">
            <Lock className="w-3.5 h-3.5 text-brand shrink-0" />
            <span>
              <span className="font-medium text-text-base">Bloccato {durataBloccoMesi} mesi</span>
              <span className="text-text-muted"> — </span>
              <span className="font-bold text-savings">{eur(durataTotale)} risparmiati</span>
            </span>
          </div>
        ) : (
          <div className="flex items-center justify-between text-sm">
            <span className="text-text-muted">Risparmio a 12 mesi:</span>
            <span className="font-bold text-savings">+{eur(risparmioAnnuo)}</span>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Smart tips ────────────────────────────────────────────────────────────────

function computeTips(
  dati: DatiCliente,
  risultatiLuce: RisultatoOfferta[],
  risultatiGas: RisultatoOfferta[],
  spesaAnnuaLuce: number,
  spesaAnnuaGas: number,
): string[] {
  const tips: string[] = [];
  const bestLuce = risultatiLuce[0];
  const bestGas = risultatiGas[0];
  const risparmioLuce = (bestLuce?.risparmio_annuo ?? 0) > 0 ? (bestLuce?.risparmio_annuo ?? 0) : 0;
  const risparmioGas = (bestGas?.risparmio_annuo ?? 0) > 0 ? (bestGas?.risparmio_annuo ?? 0) : 0;
  const risparmioTotale = risparmioLuce + risparmioGas;
  const spesaTotale = spesaAnnuaLuce + spesaAnnuaGas;

  // Mesi equivalenti di bollette coperti dal risparmio
  if (risparmioTotale > 0 && spesaTotale > 0) {
    const mesiEquivalenti = Math.floor(risparmioTotale / (spesaTotale / 12));
    if (mesiEquivalenti >= 1) {
      tips.push(
        `Il risparmio stimato di ${eur(risparmioTotale)}/anno equivale a circa ${mesiEquivalenti} ${mesiEquivalenti === 1 ? "mese" : "mesi"} di bollette pagate dal fornitore.`,
      );
    }
  }

  // Riduzione potenza impegnata
  const potenza = dati.potenza_impegnata_kw ?? 3;
  const consumoKwh = dati.consumo_annuo_kwh ?? 0;
  if (potenza > 3 && consumoKwh > 0 && consumoKwh < potenza * 600) {
    const potenzaTarget = potenza > 4.5 ? "4,5" : "3";
    tips.push(
      `Con ${consumoKwh.toLocaleString("it-IT")} kWh/anno, la potenza disponibile di ${potenza} kW è superiore al fabbisogno tipico: ridurla a ${potenzaTarget} kW abbasserebbe ulteriormente la quota fissa del contatore.`,
    );
  }

  // Fasce orarie: suggerimento bioraria se F1 bassa
  if (consumoKwh > 0 && dati.fascia_f1_kwh !== undefined) {
    const f1Pct = (dati.fascia_f1_kwh / consumoKwh) * 100;
    if (f1Pct < 35) {
      tips.push(
        `Solo il ${Math.round(f1Pct)}% dei consumi cade in fascia di punta (F1 — lun/ven 8-19): spostare i carichi principali in fascia F3 (notte e domeniche) ridurrebbe ulteriormente il costo della materia prima con una tariffa bioraria.`,
      );
    }
  } else if (consumoKwh > 0) {
    tips.push(
      "Caricando la bolletta, il sistema rileva automaticamente la ripartizione F1/F2/F3 e affina il confronto con le tariffe biorarie — spesso più convenienti per i consumi domestici serali.",
    );
  }

  // Gas riscaldamento
  const consumoSmc = dati.consumo_annuo_smc ?? 0;
  if (dati.uso_gas === "riscaldamento" && consumoSmc > 500) {
    tips.push(
      `Con ${consumoSmc.toLocaleString("it-IT")} Smc/anno per il riscaldamento, l'installazione di valvole termostatiche intelligenti può ridurre i consumi del 10-15% in aggiunta al risparmio già calcolato sull'offerta.`,
    );
  }

  // Ultimo tip: rassicurazione sul cambio fornitore (sempre presente se ci sono altri)
  if (tips.length > 0) {
    tips.push(
      "Il cambio di fornitore non richiede interventi tecnici, interruzioni di servizio o sostituzione di contatori: avviene automaticamente entro 30-60 giorni dalla firma.",
    );
  }

  return tips.slice(0, 4);
}

// ── PresentazioneView ─────────────────────────────────────────────────────────

export function PresentazioneView({
  risultatiLuce,
  risultatiGas,
  spesaAnnuaLuce,
  spesaAnnuaGas,
  dati,
  parametriLuce,
  parametriGas,
  onVediDettagliati,
}: {
  risultatiLuce: RisultatoOfferta[];
  risultatiGas: RisultatoOfferta[];
  spesaAnnuaLuce: number;
  spesaAnnuaGas: number;
  dati: DatiCliente;
  parametriLuce: ParametriRegolati | null;
  parametriGas: ParametriRegolati | null;
  onVediDettagliati: () => void;
}) {
  const [includiIva, setIncludiIva] = useState(true);

  const ivaLuce = parametriLuce?.iva ?? 0.1;
  const ivaGas = parametriGas?.iva ?? 0.22;

  const bestLuce = risultatiLuce[0];
  const bestGas = risultatiGas[0];
  const risparmioLuceRaw = (bestLuce?.risparmio_annuo ?? 0) > 0 ? (bestLuce?.risparmio_annuo ?? 0) : 0;
  const risparmioGasRaw = (bestGas?.risparmio_annuo ?? 0) > 0 ? (bestGas?.risparmio_annuo ?? 0) : 0;

  // IVA divisori: quando toggle OFF, divido per (1 + ivaRate) per strippare l'IVA
  const luceDiv = includiIva ? 1 : 1 + ivaLuce;
  const gasDiv = includiIva ? 1 : 1 + ivaGas;

  const spesaLuceDisplay = spesaAnnuaLuce / luceDiv;
  const spesaGasDisplay = spesaAnnuaGas / gasDiv;
  const costoLuceDisplay = (bestLuce?.costo_annuo_totale ?? 0) / luceDiv;
  const costoGasDisplay = (bestGas?.costo_annuo_totale ?? 0) / gasDiv;
  const risparmioLuceDisplay = risparmioLuceRaw / luceDiv;
  const risparmioGasDisplay = risparmioGasRaw / gasDiv;
  const risparmioTotaleDisplay = risparmioLuceDisplay + risparmioGasDisplay;
  const spesaTotaleDisplay = spesaLuceDisplay + spesaGasDisplay;

  const rispPct = spesaTotaleDisplay > 0
    ? Math.round((risparmioTotaleDisplay / spesaTotaleDisplay) * 100)
    : 0;

  // Fasce orarie F1/F2/F3
  const consumoKwh = dati.consumo_annuo_kwh ?? 0;
  const hasFasceOcr = dati.fascia_f1_kwh !== undefined;
  const f1Kwh = dati.fascia_f1_kwh ?? consumoKwh * 0.35;
  const f2Kwh = dati.fascia_f2_kwh ?? consumoKwh * 0.40;
  const f3Kwh = dati.fascia_f3_kwh ?? consumoKwh * 0.25;
  const totFasce = f1Kwh + f2Kwh + f3Kwh || 1;
  const f1Pct = (f1Kwh / totFasce) * 100;
  const f2Pct = (f2Kwh / totFasce) * 100;
  const f3Pct = (f3Kwh / totFasce) * 100;
  const showFasce =
    consumoKwh > 0 &&
    (dati.tipo_fornitura === "luce" || dati.tipo_fornitura === "dual");

  const showLuceCard = !!bestLuce && spesaAnnuaLuce > 0 && risparmioLuceRaw > 0;
  const showGasCard = !!bestGas && spesaAnnuaGas > 0 && risparmioGasRaw > 0;

  const tips = useMemo(
    () => computeTips(dati, risultatiLuce, risultatiGas, spesaAnnuaLuce, spesaAnnuaGas),
    [dati, risultatiLuce, risultatiGas, spesaAnnuaLuce, spesaAnnuaGas],
  );

  return (
    <div className="space-y-5">

      {/* TOP ROW: IVA toggle + Fasce */}
      <div className={cn("grid gap-5", showFasce ? "md:grid-cols-2" : "")}>

        {/* IVA toggle card */}
        <div className="bg-white border border-border-ui rounded-xl p-5 shadow-sm flex items-center justify-between gap-4">
          <div>
            <div className="font-semibold text-sm text-text-base">Include IVA (22%)</div>
            <div className="text-xs text-text-muted mt-0.5">
              {includiIva ? "Importi comprensivi di IVA" : "Importi al netto dell'IVA"}
            </div>
          </div>
          <Toggle on={includiIva} onToggle={() => setIncludiIva((v) => !v)} />
        </div>

        {/* Fasce F1/F2/F3 */}
        {showFasce && (
          <div className="bg-white border border-border-ui rounded-xl p-5 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <div className="font-semibold text-sm text-text-base">
                Ripartizione Fasce
              </div>
              <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-surface-subtle border border-border-ui text-text-muted">
                {hasFasceOcr ? "da OCR" : "default"}
              </span>
            </div>
            {/* Segmented bar */}
            <div className="h-4 rounded-full overflow-hidden flex gap-px mb-3">
              <div className="bg-brand rounded-l-full" style={{ width: `${f1Pct}%` }} />
              <div className="bg-brand-subtle-foreground" style={{ width: `${f2Pct}%` }} />
              <div
                className="bg-text-placeholder rounded-r-full"
                style={{ width: `${f3Pct}%` }}
              />
            </div>
            <div className="flex items-center gap-5 text-xs text-text-muted flex-wrap">
              <span className="flex items-center gap-1.5">
                <span className="inline-block w-2.5 h-2.5 rounded-sm bg-brand shrink-0" />
                F1: {Math.round(f1Pct)}%
              </span>
              <span className="flex items-center gap-1.5">
                <span className="inline-block w-2.5 h-2.5 rounded-sm bg-brand-subtle-foreground shrink-0" />
                F2: {Math.round(f2Pct)}%
              </span>
              <span className="flex items-center gap-1.5">
                <span className="inline-block w-2.5 h-2.5 rounded-sm bg-text-placeholder shrink-0" />
                F3: {Math.round(f3Pct)}%
              </span>
            </div>
          </div>
        )}
      </div>

      {/* HERO — unica eccezione gradient approvata */}
      <div className="bg-savings-hero rounded-2xl p-10 text-center text-white relative overflow-hidden">
        <div className="absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 bg-white opacity-10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 -ml-16 -mb-16 w-48 h-48 bg-white opacity-10 rounded-full blur-2xl pointer-events-none" />

        <p className="text-[10px] font-bold uppercase tracking-widest opacity-80 mb-4">
          Risparmio Totale Stimato
        </p>
        <div className="text-5xl md:text-7xl font-extrabold tracking-tight mb-4 drop-shadow-sm">
          +{eur(risparmioTotaleDisplay)}
        </div>
        <div className="flex justify-center gap-4 mb-4 flex-wrap">
          <span className="bg-white/20 px-4 py-1.5 rounded-full text-sm font-semibold">
            +{eur(risparmioTotaleDisplay / 12)}/mese
          </span>
          {rispPct > 0 && (
            <span className="bg-white/20 px-4 py-1.5 rounded-full text-sm font-semibold">
              -{rispPct}% vs attuale
            </span>
          )}
        </div>
        <p className="text-base opacity-80">all'anno sulle bollette di luce e gas</p>
        <p className="text-xs opacity-50 mt-5 italic">
          * Risparmio calcolato sulla Materia Prima, esente IVA
        </p>
      </div>

      {/* Attuale vs Offerta */}
      {(showLuceCard || showGasCard) && (
        <div className="grid md:grid-cols-2 gap-5">
          {showLuceCard && (
            <ConfrontoCard
              icon="luce"
              title="Luce"
              nomeMigliorOfferta={bestLuce.nome}
              spesaDisplay={spesaLuceDisplay}
              costoDisplay={costoLuceDisplay}
              risparmioDisplay={risparmioLuceDisplay}
            />
          )}
          {showGasCard && (
            <ConfrontoCard
              icon="gas"
              title="Gas"
              nomeMigliorOfferta={bestGas.nome}
              spesaDisplay={spesaGasDisplay}
              costoDisplay={costoGasDisplay}
              risparmioDisplay={risparmioGasDisplay}
            />
          )}
        </div>
      )}

      {/* Before/After Recharts + Durata bloccata */}
      {(showLuceCard || showGasCard) && (
        <div className={cn("grid gap-5", showLuceCard && showGasCard ? "md:grid-cols-2" : "")}>
          {showLuceCard && (
            <BeforeAfterCard
              spesaAnnua={spesaAnnuaLuce}
              costoOfferta={bestLuce.costo_annuo_totale}
              risparmioAnnuo={risparmioLuceRaw}
              nomeOfferta={bestLuce.nome}
              durataBloccoMesi={bestLuce.durata_blocco_mesi}
            />
          )}
          {showGasCard && (
            <BeforeAfterCard
              spesaAnnua={spesaAnnuaGas}
              costoOfferta={bestGas.costo_annuo_totale}
              risparmioAnnuo={risparmioGasRaw}
              nomeOfferta={bestGas.nome}
              durataBloccoMesi={bestGas.durata_blocco_mesi}
            />
          )}
        </div>
      )}

      {/* Proiezione 12 mesi — miglior offerta per utility */}
      {(showLuceCard || showGasCard) && (
        <div className={cn("grid gap-5", showLuceCard && showGasCard ? "md:grid-cols-2" : "")}>
          {showLuceCard && (
            <Proiezione12Mesi
              spesaAnnua={spesaAnnuaLuce}
              costoOfferta={bestLuce.costo_annuo_totale}
              nomeOfferta={bestLuce.nome}
            />
          )}
          {showGasCard && (
            <Proiezione12Mesi
              spesaAnnua={spesaAnnuaGas}
              costoOfferta={bestGas.costo_annuo_totale}
              nomeOfferta={bestGas.nome}
            />
          )}
        </div>
      )}

      {/* SMART TIPS */}
      {tips.length > 0 && (
        <div className="bg-white border border-border-ui rounded-xl p-5 shadow-sm">
          <h3 className="text-[10px] font-bold uppercase tracking-wider text-text-muted mb-4">
            Smart Tips — Consigli basati sui tuoi dati
          </h3>
          <ol className="space-y-4">
            {tips.map((tip, i) => (
              <li key={i} className="flex gap-3 text-sm text-text-base leading-relaxed">
                <span className="text-xs font-bold text-brand mt-0.5 shrink-0 w-4 select-none">
                  {i + 1}.
                </span>
                <span>{tip}</span>
              </li>
            ))}
          </ol>
        </div>
      )}

      {/* CTA */}
      <div className="flex justify-center pb-2">
        <button
          type="button"
          onClick={onVediDettagliati}
          className="flex items-center gap-2 h-12 px-8 rounded-xl bg-brand text-brand-foreground text-sm font-semibold hover:bg-brand-hover transition-colors shadow-sm"
        >
          Vedi Offerte Dettagliate
          <span aria-hidden="true" className="ml-1 text-base font-light">›</span>
        </button>
      </div>
    </div>
  );
}
