import { Fragment, useState } from "react";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Search, User, Zap, Flame, Info, Lightbulb } from "lucide-react";
import { cn } from "@/lib/utils";
import type { DatiCliente, Segmento } from "@/lib/board/types";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { UploadBollettaButton, raccomandaFasce } from "./UploadBollettaButton";
import { useDraftAutosave } from "@/hooks/useDraftAutosave";

interface Props {
  dati: DatiCliente;
  onChange: (d: DatiCliente) => void;
  onSubmit: () => void;
}

function Seg<T extends string>({ value, options, onChange }: { value: T; options: { v: T; l: string }[]; onChange: (v: T) => void }) {
  return (
    <div className="inline-flex rounded-lg border bg-muted p-1 gap-1">
      {options.map((o) => (
        <button
          key={o.v}
          type="button"
          onClick={() => onChange(o.v)}
          className={cn(
            "px-3 py-2 min-h-[44px] text-sm rounded-md transition-colors cursor-pointer",
            value === o.v ? "bg-background text-foreground shadow-sm font-medium" : "text-muted-foreground hover:text-foreground"
          )}
        >
          {o.l}
        </button>
      ))}
    </div>
  );
}

function Gauge({ value, max, levels }: { value: number; max: number; levels: { lo: number; hi: number; label: string; color: string }[] }) {
  const lvl = levels.find((l) => value >= l.lo && value < l.hi) ?? levels[levels.length - 1];
  const pct = Math.min(100, (value / max) * 100);
  return (
    <div className="mt-2">
      <div className="h-2 rounded-full bg-muted overflow-hidden">
        <div className={cn("h-full transition-all", lvl.color)} style={{ width: `${pct}%` }} />
      </div>
      <div className="text-xs text-muted-foreground mt-1">Consumo: <span className="font-medium text-foreground">{lvl.label}</span></div>
    </div>
  );
}

export function ClienteForm({ dati, onChange, onSubmit }: Props) {
  const set = (patch: Partial<DatiCliente>) => onChange({ ...dati, ...patch });
  const [potenzaCustom, setPotenzaCustom] = useState(![3, 4.5, 6].includes(dati.potenzaKw));
  const [consumiFasceOcr, setConsumiFasceOcr] = useState<{ f1: number; f2: number; f3: number } | null>(null);
  useDraftAutosave(dati);

  const raccomandazione = consumiFasceOcr
    ? raccomandaFasce(consumiFasceOcr.f1, consumiFasceOcr.f2, consumiFasceOcr.f3)
    : null;

  const handleOcrApply = (patch: Partial<DatiCliente>, extracted: any) => {
    onChange({ ...dati, ...patch });
    const cf = extracted?.luce?.consumi_fasce_annui;
    if (cf) setConsumiFasceOcr({ f1: cf.f1_kwh, f2: cf.f2_kwh, f3: cf.f3_kwh });
    else setConsumiFasceOcr(null);
  };

  return (
    <Card className="p-5 sm:p-6 space-y-6">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <User className="w-5 h-5 text-primary" />
          <h2 className="text-lg font-semibold">Dati bolletta cliente</h2>
        </div>
        <UploadBollettaButton dati={dati} onApply={handleOcrApply} />
      </div>

      <div className="space-y-3">
        <Label>Tipo utenza</Label>
        <Seg<Segmento>
          value={dati.segmento}
          options={[{ v: "family", l: "Domestico" }, { v: "business", l: "Business P.IVA" }]}
          onChange={(v) => set({ segmento: v })}
        />
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Potenza contatore (kW)</Label>
          <div className="flex flex-wrap items-center gap-2">
            {(dati.segmento === "family" ? [3, 4.5, 6] : [6, 10, 15, 30]).map((p) => (
              <button key={p} type="button" onClick={() => { set({ potenzaKw: p }); setPotenzaCustom(false); }}
                className={cn("px-3 py-2 min-h-[44px] text-sm rounded-md border cursor-pointer", !potenzaCustom && dati.potenzaKw === p ? "bg-primary text-primary-foreground border-primary" : "bg-background")}>
                {p}
              </button>
            ))}
            <button type="button" onClick={() => setPotenzaCustom(true)}
              className={cn("px-3 py-2 min-h-[44px] text-sm rounded-md border cursor-pointer", potenzaCustom ? "bg-primary text-primary-foreground border-primary" : "bg-background")}>
              Altro
            </button>
            {potenzaCustom && (
              <Input type="number" step="0.1" value={dati.potenzaKw} onChange={(e) => set({ potenzaKw: parseFloat(e.target.value) || 0 })} className="w-24" />
            )}
          </div>
        </div>
        {dati.segmento === "family" && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>Residente</Label>
              <Switch checked={dati.residente} onCheckedChange={(v) => set({ residente: v })} />
            </div>
            {dati.residente && (
              <div className="flex items-center justify-between">
                <Label>Canone RAI</Label>
                <Switch checked={dati.canoneRai} onCheckedChange={(v) => set({ canoneRai: v })} />
              </div>
            )}
          </div>
        )}
      </div>

      {/* LUCE */}
      <div className="rounded-lg border border-yellow-200 bg-yellow-50/50 p-4 space-y-4">
        <div className="flex items-center gap-2">
          <Zap className="w-5 h-5 text-yellow-500" />
          <h3 className="font-semibold">Energia elettrica</h3>
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label>Consumo annuo (kWh)</Label>
            <Input type="number" value={dati.consumoLuce} onChange={(e) => set({ consumoLuce: parseInt(e.target.value) || 0 })} className="w-28 text-right" />
          </div>
          <Slider value={[dati.consumoLuce]} min={0} max={15000} step={100} onValueChange={([v]) => set({ consumoLuce: v })} className="[&_[role=slider]]:h-6 [&_[role=slider]]:w-6" />
          <Gauge value={dati.consumoLuce} max={15000} levels={[
            { lo: 0, hi: 1500, label: "Basso", color: "bg-green-500" },
            { lo: 1500, hi: 3000, label: "Medio", color: "bg-yellow-500" },
            { lo: 3000, hi: 99999, label: "Alto", color: "bg-red-500" },
          ]} />
        </div>

        {/* Toggle Monorario / Fasce */}
        <div className="space-y-2">
          <Label>Tipo contatore</Label>
          <Seg<"mono" | "fasce">
            value={dati.usaFasce ? "fasce" : "mono"}
            options={[{ v: "mono", l: "Monorario F0" }, { v: "fasce", l: "Fasce F1/F2/F3" }]}
            onChange={(v) => set({ usaFasce: v === "fasce" })}
          />
        </div>

        {dati.usaFasce && (
          <FascePanel dati={dati} set={set} />
        )}

        {!dati.usaFasce ? (
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <div className="flex items-center gap-1.5">
                <Label>Prezzo energia attuale (€/kWh)</Label>
                <Tooltip>
                  <TooltipTrigger asChild><Info className="w-3.5 h-3.5 text-muted-foreground cursor-help" /></TooltipTrigger>
                  <TooltipContent className="max-w-xs">Inserisci il prezzo della materia prima dalla bolletta del cliente, sezione "Spesa per la materia energia". È già comprensivo delle perdite di rete.</TooltipContent>
                </Tooltip>
              </div>
              <Input type="number" step="0.001" value={dati.prezzoLuce} onChange={(e) => set({ prezzoLuce: parseFloat(e.target.value) || 0 })} placeholder="es. 0,17" />
            </div>
            <div className="space-y-2">
              <Label>Costo fisso attuale (€/mese)</Label>
              <Input type="number" step="0.01" value={dati.fissoLuceMese} onChange={(e) => set({ fissoLuceMese: parseFloat(e.target.value) || 0 })} />
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="grid sm:grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Prezzo F1 (€/kWh)</Label>
                <Input type="number" step="0.001" value={dati.prezzoF1 ?? 0} onChange={(e) => set({ prezzoF1: parseFloat(e.target.value) || 0 })} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Prezzo F2 (€/kWh)</Label>
                <Input type="number" step="0.001" value={dati.prezzoF2 ?? 0} onChange={(e) => set({ prezzoF2: parseFloat(e.target.value) || 0 })} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Prezzo F3 (€/kWh)</Label>
                <Input type="number" step="0.001" value={dati.prezzoF3 ?? 0} onChange={(e) => set({ prezzoF3: parseFloat(e.target.value) || 0 })} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Costo fisso attuale (€/mese)</Label>
              <Input type="number" step="0.01" value={dati.fissoLuceMese} onChange={(e) => set({ fissoLuceMese: parseFloat(e.target.value) || 0 })} />
            </div>
            <button type="button" onClick={() => set({ usaFasce: false })} className="text-xs text-primary underline">
              Non conosco i prezzi per fascia → usa monorario
            </button>
          </div>
        )}
      </div>

      {/* GAS */}
      <div className="rounded-lg border border-orange-200 bg-orange-50/50 p-4 space-y-4">
        <div className="flex items-center gap-2">
          <Flame className="w-5 h-5 text-orange-500" />
          <h3 className="font-semibold">Gas naturale</h3>
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label>Consumo annuo (Smc)</Label>
            <Input type="number" value={dati.consumoGas} onChange={(e) => set({ consumoGas: parseInt(e.target.value) || 0 })} className="w-28 text-right" />
          </div>
          <Slider value={[dati.consumoGas]} min={0} max={5000} step={50} onValueChange={([v]) => set({ consumoGas: v })} className="[&_[role=slider]]:h-6 [&_[role=slider]]:w-6" />
          <Gauge value={dati.consumoGas} max={5000} levels={[
            { lo: 0, hi: 500, label: "Basso", color: "bg-green-500" },
            { lo: 500, hi: 1200, label: "Medio", color: "bg-yellow-500" },
            { lo: 1200, hi: 99999, label: "Alto", color: "bg-red-500" },
          ]} />
        </div>
        <div className="grid sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Prezzo gas attuale (€/Smc)</Label>
            <Input type="number" step="0.001" value={dati.prezzoGas} onChange={(e) => set({ prezzoGas: parseFloat(e.target.value) || 0 })} />
          </div>
          <div className="space-y-2">
            <Label>Costo fisso attuale (€/mese)</Label>
            <Input type="number" step="0.01" value={dati.fissoGasMese} onChange={(e) => set({ fissoGasMese: parseFloat(e.target.value) || 0 })} />
          </div>
        </div>
      </div>

      {raccomandazione && (
        <div
          className={cn(
            "rounded-lg border p-3 flex items-start gap-3",
            raccomandazione.severity === "success"
              ? "border-green-300 bg-green-50"
              : "border-blue-300 bg-blue-50",
          )}
        >
          <Lightbulb className={cn("w-5 h-5 mt-0.5 shrink-0", raccomandazione.severity === "success" ? "text-green-600" : "text-blue-600")} />
          <div className="flex-1 text-sm">
            <div className="font-semibold mb-1">Suggerimento fasce orarie</div>
            <p className="text-muted-foreground">{raccomandazione.messaggio}</p>
          </div>
          {raccomandazione.tipo !== "indifferente" && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => set({ usaFasce: raccomandazione.tipo === "fasce" })}
            >
              Applica
            </Button>
          )}
        </div>
      )}

      <Button size="lg" className="w-full bg-green-600 hover:bg-green-700 text-white" onClick={onSubmit}>
        <Search className="w-5 h-5 mr-2" /> Trova offerta migliore
      </Button>

    </Card>
  );
}

function FascePanel({ dati, set }: { dati: DatiCliente; set: (p: Partial<DatiCliente>) => void }) {
  const f1 = dati.percF1 ?? 33;
  const f2 = dati.percF2 ?? 24;
  const f3 = dati.percF3 ?? 43;
  const consumo = dati.consumoLuce;

  const rebalance = (which: "f1" | "f2" | "f3", newVal: number) => {
    const v = Math.max(0, Math.min(100, newVal));
    const others: Array<"f1" | "f2" | "f3"> = (["f1", "f2", "f3"] as const).filter((k) => k !== which);
    const cur = { f1, f2, f3 };
    const remain = 100 - v;
    const sumOthers = cur[others[0]] + cur[others[1]];
    let a: number, b: number;
    if (sumOthers <= 0.0001) { a = remain / 2; b = remain / 2; }
    else { a = (cur[others[0]] / sumOthers) * remain; b = (cur[others[1]] / sumOthers) * remain; }
    const next = { ...cur, [which]: v, [others[0]]: a, [others[1]]: b };
    set({ percF1: Math.round(next.f1), percF2: Math.round(next.f2), percF3: Math.round(next.f3) });
  };

  const FasciaRow = ({ id, color, label, val }: { id: "f1" | "f2" | "f3"; color: string; label: string; val: number }) => (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-sm">
        <span className="flex items-center gap-2">
          <span className={cn("w-3 h-3 rounded-full", color)} />
          <span className="font-medium">{label}</span>
        </span>
        <span className="font-mono text-xs text-muted-foreground">
          {Math.round(val)}% · {Math.round(consumo * val / 100)} kWh/anno
        </span>
      </div>
      <Slider value={[val]} min={0} max={100} step={1} onValueChange={([v]) => rebalance(id, v)} className="[&_[role=slider]]:h-6 [&_[role=slider]]:w-6" />
    </div>
  );

  return (
    <div className="rounded-md border bg-background p-3 space-y-4">
      <div className="space-y-3">
        <FasciaRow id="f1" color="bg-orange-500" label="F1 (Lun-Ven 8-19) — ore piene" val={f1} />
        <FasciaRow id="f2" color="bg-yellow-400" label="F2 (Lun-Ven 7-8/19-23, Sab 7-23) — intermedie" val={f2} />
        <FasciaRow id="f3" color="bg-blue-500" label="F3 (Notti, Dom, Festivi) — ore vuote" val={f3} />
      </div>
      <WeeklyClock />
    </div>
  );
}

const HOUR_BANDS: Array<{ rows: string; cells: ("f1" | "f2" | "f3")[] }> = [
  { rows: "0-7",   cells: ["f3","f3","f3","f3","f3","f3","f3"] },
  { rows: "7-8",   cells: ["f2","f2","f2","f2","f2","f2","f3"] },
  { rows: "8-19",  cells: ["f1","f1","f1","f1","f1","f2","f3"] },
  { rows: "19-23", cells: ["f2","f2","f2","f2","f2","f2","f3"] },
  { rows: "23-24", cells: ["f3","f3","f3","f3","f3","f3","f3"] },
];
const FASCIA_BG: Record<"f1" | "f2" | "f3", string> = { f1: "bg-orange-500", f2: "bg-yellow-400", f3: "bg-blue-500" };

function WeeklyClock() {
  const days = ["Lun", "Mar", "Mer", "Gio", "Ven", "Sab", "Dom"];
  return (
    <div className="space-y-2">
      <div className="text-xs text-muted-foreground">Schema settimanale ARERA</div>
      <div className="grid gap-px text-[10px]" style={{ gridTemplateColumns: "auto repeat(7, minmax(0,1fr))" }}>
        <div></div>
        {days.map((d) => <div key={d} className="text-center font-medium text-muted-foreground">{d}</div>)}
        {HOUR_BANDS.map((b) => (
          <Fragment key={b.rows}>
            <div className="text-right pr-1 text-muted-foreground">{b.rows}</div>
            {b.cells.map((c, i) => (
              <div key={b.rows + i} className={cn("h-4 rounded-sm", FASCIA_BG[c])} title={c.toUpperCase()} />
            ))}
          </Fragment>
        ))}
      </div>
      <div className="flex flex-wrap gap-3 text-[11px] text-muted-foreground">
        <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-orange-500" /> F1 piene</span>
        <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-yellow-400" /> F2 intermedie</span>
        <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-blue-500" /> F3 vuote</span>
      </div>
    </div>
  );
}
