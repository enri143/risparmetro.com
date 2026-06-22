import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

export interface CteRow {
  id: string;
  tenant_id: string;
  fornitore_id: string | null;
  nome: string;
  tipo_fornitura: "luce" | "gas" | "dual";
  tipo_prezzo: "fisso" | "variabile" | "indicizzato";
  segmento: "residenziale" | "business" | "entrambi";
  prezzo_energia_luce: number | null;
  spread_luce: number | null;
  quota_fissa_luce: number | null;
  prezzo_energia_gas: number | null;
  spread_gas: number | null;
  quota_fissa_gas: number | null;
  componenti_venditore: { label: string; valore: string }[];
  target_note: string | null;
  valida_da: string | null;
  valida_a: string | null;
  provvigione_override: number | null;
  provvigione_tipo: "fisso" | "percentuale" | null;
  priorita: number;
  attiva: boolean;
  created_at?: string;
  updated_at?: string;
  fornitori?: { nome: string; colore: string | null } | null;
}

export type CteFormPayload = Omit<CteRow, "id" | "tenant_id" | "created_at" | "updated_at" | "fornitori" | "componenti_venditore"> & {
  componenti_venditore?: { label: string; valore: string }[];
};

export interface FornitoreOption { id: string; nome: string; }

interface FormState {
  nome: string;
  fornitore_id: string | null;
  tipo_fornitura: "luce" | "gas";
  segmento: "residenziale" | "business";
  tipo_prezzo: "fisso" | "indicizzato";
  prezzo_energia_luce: number | null;
  spread_luce: number | null;
  quota_fissa_luce: number | null;
  prezzo_energia_gas: number | null;
  spread_gas: number | null;
  quota_fissa_gas: number | null;
  valida_a: string;
  target_note: string;
  provvigione_override: number | null;
  provvigione_tipo: "fisso" | "percentuale" | null;
  attiva: boolean;
}

const empty = (): FormState => ({
  nome: "", fornitore_id: null,
  tipo_fornitura: "luce", segmento: "residenziale",
  tipo_prezzo: "fisso",
  prezzo_energia_luce: null, spread_luce: null, quota_fissa_luce: null,
  prezzo_energia_gas: null, spread_gas: null, quota_fissa_gas: null,
  valida_a: "", target_note: "",
  provvigione_override: null, provvigione_tipo: null,
  attiva: true,
});

function fromRow(r: CteRow): FormState {
  return {
    nome: r.nome,
    fornitore_id: r.fornitore_id,
    tipo_fornitura: r.tipo_fornitura === "gas" ? "gas" : "luce",
    segmento: r.segmento === "business" ? "business" : "residenziale",
    tipo_prezzo: r.tipo_prezzo === "indicizzato" ? "indicizzato" : "fisso",
    prezzo_energia_luce: r.prezzo_energia_luce,
    spread_luce: r.spread_luce,
    quota_fissa_luce: r.quota_fissa_luce,
    prezzo_energia_gas: r.prezzo_energia_gas,
    spread_gas: r.spread_gas,
    quota_fissa_gas: r.quota_fissa_gas,
    valida_a: r.valida_a ?? "",
    target_note: r.target_note ?? "",
    provvigione_override: r.provvigione_override,
    provvigione_tipo: r.provvigione_tipo,
    attiva: r.attiva,
  };
}

function toPayload(f: FormState): CteFormPayload {
  const isLuce = f.tipo_fornitura === "luce";
  return {
    fornitore_id: f.fornitore_id,
    nome: f.nome,
    tipo_fornitura: f.tipo_fornitura,
    segmento: f.segmento,
    tipo_prezzo: f.tipo_prezzo,
    prezzo_energia_luce: isLuce && f.tipo_prezzo === "fisso" ? f.prezzo_energia_luce : null,
    spread_luce: isLuce && f.tipo_prezzo === "indicizzato" ? f.spread_luce : null,
    quota_fissa_luce: isLuce ? f.quota_fissa_luce : null,
    prezzo_energia_gas: !isLuce && f.tipo_prezzo === "fisso" ? f.prezzo_energia_gas : null,
    spread_gas: !isLuce && f.tipo_prezzo === "indicizzato" ? f.spread_gas : null,
    quota_fissa_gas: !isLuce ? f.quota_fissa_gas : null,
    target_note: f.target_note || null,
    valida_da: null,
    valida_a: f.valida_a || null,
    provvigione_override: f.provvigione_override,
    provvigione_tipo: f.provvigione_tipo,
    priorita: 0,
    attiva: f.attiva,
  };
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick}
      className={cn("px-3 py-1.5 text-sm rounded-md border", active ? "bg-primary text-primary-foreground border-primary" : "bg-background")}>
      {children}
    </button>
  );
}

export function CteFormModal({ open, onClose, onSave, initial, fornitori }: {
  open: boolean;
  onClose: () => void;
  onSave: (cte: CteFormPayload) => Promise<void>;
  initial?: CteRow | null;
  fornitori: FornitoreOption[];
}) {
  const [data, setData] = useState<FormState>(empty());
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setData(initial ? fromRow(initial) : empty());
  }, [initial, open]);

  const set = (p: Partial<FormState>) => setData((d) => ({ ...d, ...p }));

  const isLuce = data.tipo_fornitura === "luce";
  const prezzo = isLuce ? data.prezzo_energia_luce : data.prezzo_energia_gas;
  const spread = isLuce ? data.spread_luce : data.spread_gas;
  const quota = isLuce ? data.quota_fissa_luce : data.quota_fissa_gas;
  const unita = isLuce ? "kWh" : "Smc";

  const setPrezzo = (v: number | null) =>
    isLuce ? set({ prezzo_energia_luce: v }) : set({ prezzo_energia_gas: v });
  const setSpread = (v: number | null) =>
    isLuce ? set({ spread_luce: v }) : set({ spread_gas: v });
  const setQuota = (v: number | null) =>
    isLuce ? set({ quota_fissa_luce: v }) : set({ quota_fissa_gas: v });

  const numInput = (val: number | null, onChange: (v: number | null) => void, props?: React.InputHTMLAttributes<HTMLInputElement>) => (
    <Input
      type="number"
      value={val ?? ""}
      onChange={(e) => onChange(e.target.value === "" ? null : parseFloat(e.target.value))}
      {...props}
    />
  );

  const submit = async () => {
    if (!data.nome) return;
    setSaving(true);
    await onSave(toPayload(data));
    setSaving(false);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{initial ? "Modifica" : "Nuova"} offerta</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <Label>Nome offerta *</Label>
              <Input value={data.nome} onChange={(e) => set({ nome: e.target.value })} />
            </div>
            <div>
              <Label>Fornitore</Label>
              <select
                value={data.fornitore_id ?? ""}
                onChange={(e) => set({ fornitore_id: e.target.value || null })}
                className="w-full h-10 border rounded-md px-3 text-sm bg-background"
              >
                <option value="">— seleziona —</option>
                {fornitori.map((f) => <option key={f.id} value={f.id}>{f.nome}</option>)}
              </select>
            </div>
          </div>

          <div className="flex flex-wrap gap-4">
            <div>
              <Label className="text-xs">Tipo</Label>
              <div className="flex gap-1 mt-1">
                <Chip active={isLuce} onClick={() => set({ tipo_fornitura: "luce" })}>Luce</Chip>
                <Chip active={!isLuce} onClick={() => set({ tipo_fornitura: "gas" })}>Gas</Chip>
              </div>
            </div>
            <div>
              <Label className="text-xs">Segmento</Label>
              <div className="flex gap-1 mt-1">
                <Chip active={data.segmento === "residenziale"} onClick={() => set({ segmento: "residenziale" })}>Family</Chip>
                <Chip active={data.segmento === "business"} onClick={() => set({ segmento: "business" })}>Business</Chip>
              </div>
            </div>
            <div>
              <Label className="text-xs">Tipo prezzo</Label>
              <div className="flex gap-1 mt-1">
                <Chip active={data.tipo_prezzo === "fisso"} onClick={() => set({ tipo_prezzo: "fisso" })}>Fisso</Chip>
                <Chip active={data.tipo_prezzo === "indicizzato"} onClick={() => set({ tipo_prezzo: "indicizzato" })}>Indicizzato</Chip>
              </div>
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-3">
            {data.tipo_prezzo === "fisso" && (
              <div>
                <Label>Prezzo materia prima (€/{unita})</Label>
                {numInput(prezzo, setPrezzo, { step: "0.000001", placeholder: "es. 0.12" })}
              </div>
            )}
            {data.tipo_prezzo === "indicizzato" && (
              <div>
                <Label>Spread (€/{unita}) — su {isLuce ? "PUN" : "PSV"}</Label>
                {numInput(spread, setSpread, { step: "0.000001", placeholder: "es. 0.015" })}
              </div>
            )}
            <div>
              <Label>Quota fissa (€/mese)</Label>
              {numInput(quota, setQuota, { step: "0.01", placeholder: "es. 9.90" })}
            </div>
            <div>
              <Label>Valida fino al</Label>
              <Input type="date" value={data.valida_a} onChange={(e) => set({ valida_a: e.target.value })} />
            </div>
          </div>

          <div>
            <Label>Note</Label>
            <Textarea value={data.target_note} onChange={(e) => set({ target_note: e.target.value })} rows={2} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Annulla</Button>
          <Button onClick={submit} disabled={saving || !data.nome} className="bg-green-600 hover:bg-green-700 text-white">
            {saving ? "Salvo..." : "Salva"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
