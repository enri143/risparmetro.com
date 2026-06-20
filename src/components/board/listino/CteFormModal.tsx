import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import type { CTE } from "@/lib/board/types";

const empty = (): Partial<CTE> => ({
  nome: "", fornitore: "", tipo: "luce", segmento: "family", tipo_prezzo: "fisso",
  prezzo_fisso: null, indice: null, spread: null, commercializzazione_anno: 0,
  cvv_variabile: 0, dispacciamento_kwh: 0, penale_recesso: false, validita: "", note: "", attiva: true, tipo_pun: "monorario",
  energia_verde: false, provvigione_una_tantum: 0, provvigione_ricorrente_per_1000: 0, codice_offerta: null,
});

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick}
      className={cn("px-3 py-1.5 text-sm rounded-md border", active ? "bg-primary text-primary-foreground border-primary" : "bg-background")}>
      {children}
    </button>
  );
}

export function CteFormModal({ open, onClose, onSave, initial, fornitori }: {
  open: boolean; onClose: () => void; onSave: (cte: Partial<CTE>) => Promise<void>;
  initial?: CTE | null; fornitori: string[];
}) {
  const [data, setData] = useState<Partial<CTE>>(empty());
  const [saving, setSaving] = useState(false);
  useEffect(() => { setData(initial ?? empty()); }, [initial, open]);

  const set = (p: Partial<CTE>) => setData((d) => ({ ...d, ...p }));

  const submit = async () => {
    if (!data.nome || !data.fornitore) return;
    setSaving(true);
    // Auto-fill codice_offerta SG da nome se fornitore SG e campo vuoto
    let payload = data;
    if (!payload.codice_offerta && /sg\s*energia/i.test(payload.fornitore ?? "")) {
      const { normalizzaCodiceSG } = await import("@/lib/board/sgCodice");
      const codice = normalizzaCodiceSG(payload.nome);
      if (codice) payload = { ...payload, codice_offerta: codice };
    }
    await onSave(payload);
    setSaving(false);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{initial ? "Modifica" : "Nuova"} offerta</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="grid sm:grid-cols-2 gap-3">
            <div><Label>Nome offerta *</Label><Input value={data.nome ?? ""} onChange={(e) => set({ nome: e.target.value })} /></div>
            <div>
              <Label>Fornitore *</Label>
              <Input list="fornitori-list" value={data.fornitore ?? ""} onChange={(e) => set({ fornitore: e.target.value })} />
              <datalist id="fornitori-list">{fornitori.map((f) => <option key={f} value={f} />)}</datalist>
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            <div>
              <Label className="text-xs">Tipo</Label>
              <div className="flex gap-1 mt-1">
                <Chip active={data.tipo === "luce"} onClick={() => set({ tipo: "luce" })}>⚡ Luce</Chip>
                <Chip active={data.tipo === "gas"} onClick={() => set({ tipo: "gas" })}>🔥 Gas</Chip>
              </div>
            </div>
            <div>
              <Label className="text-xs">Segmento</Label>
              <div className="flex gap-1 mt-1">
                <Chip active={data.segmento === "family"} onClick={() => set({ segmento: "family" })}>Family</Chip>
                <Chip active={data.segmento === "business"} onClick={() => set({ segmento: "business" })}>Business</Chip>
              </div>
            </div>
            <div>
              <Label className="text-xs">Tipo prezzo</Label>
              <div className="flex gap-1 mt-1">
                <Chip active={data.tipo_prezzo === "fisso"} onClick={() => set({ tipo_prezzo: "fisso", indice: null, spread: null })}>Fisso</Chip>
                <Chip active={data.tipo_prezzo === "index"} onClick={() => set({ tipo_prezzo: "index", prezzo_fisso: null })}>Index</Chip>
              </div>
            </div>
          </div>

          {data.tipo_prezzo === "fisso" && (
            <div>
              <Label>Prezzo fisso (€/{data.tipo === "luce" ? "kWh" : "Smc"})</Label>
              <Input type="number" step="0.000001" value={data.prezzo_fisso ?? ""} onChange={(e) => set({ prezzo_fisso: parseFloat(e.target.value) || 0 })} />
            </div>
          )}

          {data.tipo_prezzo === "index" && (
            <div className="space-y-3">
              <div className="grid sm:grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Indice</Label>
                  <div className="flex gap-1 mt-1">
                    <Chip active={data.indice === "PUN"} onClick={() => set({ indice: "PUN" })}>PUN</Chip>
                    <Chip active={data.indice === "PSV"} onClick={() => set({ indice: "PSV" })}>PSV</Chip>
                  </div>
                </div>
                <div>
                  <Label>Spread (€/{data.tipo === "luce" ? "kWh" : "Smc"})</Label>
                  <Input type="number" step="0.000001" value={data.spread ?? ""} onChange={(e) => set({ spread: parseFloat(e.target.value) || 0 })} />
                </div>
              </div>
              {data.tipo === "luce" && (
                <div>
                  <Label className="text-xs">Tipo PUN</Label>
                  <div className="flex gap-1 mt-1">
                    <Chip active={(data.tipo_pun ?? "monorario") === "monorario"} onClick={() => set({ tipo_pun: "monorario" })}>PUN monorario (F0)</Chip>
                    <Chip active={data.tipo_pun === "fasce"} onClick={() => set({ tipo_pun: "fasce" })}>PUN per fasce (F1/F2/F3)</Chip>
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <Label>Commercializzazione (€/anno) *</Label>
              <Input type="number" step="0.01" value={data.commercializzazione_anno ?? 0} onChange={(e) => set({ commercializzazione_anno: parseFloat(e.target.value) || 0 })} />
            </div>
            <div>
              <Label>CVV variabile (€/{data.tipo === "luce" ? "kWh" : "Smc"})</Label>
              <Input type="number" step="0.000001" value={data.cvv_variabile ?? 0} onChange={(e) => set({ cvv_variabile: parseFloat(e.target.value) || 0 })} />
            </div>
            {data.tipo === "luce" && (
              <div className="sm:col-span-2">
                <Label>Dispacciamento/TIDE (€/kWh)</Label>
                <Input type="number" step="0.000001" placeholder="es. 0.01155" value={data.dispacciamento_kwh ?? 0} onChange={(e) => set({ dispacciamento_kwh: parseFloat(e.target.value) || 0 })} />
                <p className="text-xs text-muted-foreground mt-1">Inserisci il valore SOLO se la CTE indica un importo specifico di TIDE o dispacciamento. Se dice solo "si applica il CDISPD ARERA" senza un numero, lascia 0.</p>
              </div>
            )}
            <div>
              <Label>Validità</Label>
              <Input value={data.validita ?? ""} onChange={(e) => set({ validita: e.target.value })} placeholder="DD/MM/YYYY" />
            </div>
            <div className="flex items-center gap-3 pt-6">
              <Switch checked={!!data.penale_recesso} onCheckedChange={(v) => set({ penale_recesso: v })} />
              <Label>Penale recesso</Label>
            </div>
            <div className="flex items-center gap-3 pt-6 sm:col-span-2">
              <Switch checked={!!data.energia_verde} onCheckedChange={(v) => set({ energia_verde: v })} />
              <Label>🌿 Energia verde 100%</Label>
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-3 rounded-lg border bg-muted/30 p-3">
            <div className="sm:col-span-2 text-xs font-medium text-muted-foreground">💶 Provvigioni agente</div>
            <div className="sm:col-span-2">
              <Label className="text-xs">Codice offerta SG (opzionale)</Label>
              <Input placeholder="es. IMFL00_E000A_901" value={data.codice_offerta ?? ""} onChange={(e) => set({ codice_offerta: e.target.value || null })} />
              <p className="text-[10px] text-muted-foreground mt-1">Se compilato, le provvigioni vengono lette dal piano SG e calcolate sullo scaglione del consumo cliente (ignora i campi sotto).</p>
            </div>
            <div>
              <Label className="text-xs">Una tantum (€) — fallback</Label>
              <Input type="number" step="0.01" placeholder="es. 45" value={data.provvigione_una_tantum ?? ""} onChange={(e) => set({ provvigione_una_tantum: e.target.value === "" ? null : parseFloat(e.target.value) })} />
            </div>
            <div>
              <Label className="text-xs">Ricorrente (€ per 1000 {data.tipo === "luce" ? "kWh" : "Smc"}) — fallback</Label>
              <Input type="number" step="0.01" placeholder="es. 2" value={data.provvigione_ricorrente_per_1000 ?? ""} onChange={(e) => set({ provvigione_ricorrente_per_1000: e.target.value === "" ? null : parseFloat(e.target.value) })} />
            </div>
          </div>

          <div>
            <Label>Note</Label>
            <Textarea value={data.note ?? ""} onChange={(e) => set({ note: e.target.value })} rows={2} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Annulla</Button>
          <Button onClick={submit} disabled={saving} className="bg-green-600 hover:bg-green-700 text-white">{saving ? "Salvo..." : "Salva"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
