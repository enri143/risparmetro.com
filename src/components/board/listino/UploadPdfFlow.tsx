import { useState, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Upload, FileText, X, Bot, Save, Loader2 } from "lucide-react";
import { fileToBase64, type CTEEstratta } from "@/lib/board/claude";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { matchFornitore } from "@/lib/board/matchFornitore";

type Stato = "idle" | "analizzando" | "ok" | "errore";
interface Estratto { dati: CTEEstratta; conferma: boolean; }
interface Riga { file: File; stato: Stato; estratti: Estratto[]; errore?: string; }

function parseScadenza(s: string | null): string | null {
  if (!s) return null;
  const m = s.match(/(\d{2})\/(\d{2})\/(\d{4})/);
  if (!m) return null;
  return `${m[3]}-${m[2]}-${m[1]}`;
}


export function UploadPdfFlow({ open, onClose, onSaved }: { open: boolean; onClose: () => void; onSaved: () => void }) {
  const [righe, setRighe] = useState<Riga[]>([]);
  const [salvando, setSalvando] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const aggiungiFile = (files: FileList | null) => {
    if (!files) return;
    const nuove: Riga[] = Array.from(files).slice(0, 10 - righe.length).map((f) => ({ file: f, stato: "idle", estratti: [] }));
    setRighe((r) => [...r, ...nuove]);
  };

  const rimuovi = (i: number) => setRighe((r) => r.filter((_, idx) => idx !== i));

  const analizzaTutti = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { toast.error("Sessione scaduta — effettua di nuovo il login"); return; }
    setRighe((r) => r.map((x) => x.stato === "ok" ? x : { ...x, stato: "analizzando" }));
    for (let i = 0; i < righe.length; i++) {
      if (righe[i].stato === "ok") continue;
      try {
        const b64 = await fileToBase64(righe[i].file);
        const { data, error } = await supabase.functions.invoke("analyze-cte", { body: { pdfBase64: b64 } });
        if (error) throw error;
        if (data?.error) throw new Error(data.error);
        const lista = (data?.items ?? []) as CTEEstratta[];
        setRighe((r) => r.map((x, idx) => idx === i ? { ...x, stato: "ok", estratti: lista.map((d) => ({ dati: d, conferma: true })) } : x));
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Errore sconosciuto";
        setRighe((r) => r.map((x, idx) => idx === i ? { ...x, stato: "errore", errore: msg } : x));
      }
    }
  };

  const aggiornaCampo = (i: number, j: number, campo: keyof CTEEstratta, val: unknown) => {
    setRighe((r) => r.map((x, idx) => idx !== i ? x : {
      ...x,
      estratti: x.estratti.map((e, ej) => ej !== j ? e : { ...e, dati: { ...e.dati, [campo]: val } }),
    }));
  };

  const toggleConferma = (i: number, j: number, val: boolean) => {
    setRighe((r) => r.map((x, idx) => idx !== i ? x : {
      ...x,
      estratti: x.estratti.map((e, ej) => ej !== j ? e : { ...e, conferma: val }),
    }));
  };

  const salva = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { toast.error("Sessione scaduta — effettua di nuovo il login"); return; }

    const { data: membership } = await supabase
      .from("tenant_members")
      .select("tenant_id")
      .eq("user_id", user.id)
      .limit(1)
      .maybeSingle();
    if (!membership?.tenant_id) { toast.error("Tenant non trovato per questo utente"); return; }
    const tenantId = membership.tenant_id;

    const { data: fornitori } = await supabase.from("fornitori").select("id, nome");

    async function resolveFornitoreId(nome?: string): Promise<string | null> {
      if (!nome?.trim()) return null;
      const matched = matchFornitore(nome, fornitori ?? []);
      if (matched) return matched;
      const slug = nome.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
      const { data } = await supabase
        .from("fornitori")
        .upsert({ slug, nome: nome.trim(), attivo: true }, { onConflict: "slug" })
        .select("id")
        .single();
      return data?.id ?? null;
    }

    const payload = await Promise.all(
      righe
        .filter((r) => r.stato === "ok")
        .flatMap((r) =>
          r.estratti.filter((e) => e.conferma).map(async (e) => {
            const d = e.dati;
            const isLuce = d.tipo === "luce";
            const tipoPrezzo = d.tipo_prezzo === "index" ? "indicizzato" : "fisso";
            return {
              tenant_id: tenantId,
              fornitore_id: await resolveFornitoreId(d.fornitore),
            nome: d.nome,
            tipo_fornitura: d.tipo,
            segmento: d.segmento === "business" ? "business" : "residenziale",
            tipo_prezzo: tipoPrezzo,
            prezzo_energia_luce: isLuce ? d.prezzo_materia_prima : null,
            spread_luce: isLuce ? d.spread : null,
            quota_fissa_luce: isLuce ? (d.quota_fissa_mese ?? null) : null,
            prezzo_energia_gas: !isLuce ? d.prezzo_materia_prima : null,
            spread_gas: !isLuce ? d.spread : null,
            quota_fissa_gas: !isLuce ? (d.quota_fissa_mese ?? null) : null,
            durata_blocco_mesi: d.durata_mesi ?? null,
            valida_a: parseScadenza(d.scadenza_sottoscrizione),
            componenti_venditore: d.componenti_venditore ?? [],
            target_note: d.note || null,
            attiva: true,
          };
          })
        )
    );

    if (!payload.length) return;
    setSalvando(true);
    const { error } = await supabase.from("cte").insert(payload);
    setSalvando(false);
    if (error) { toast.error("Errore salvataggio: " + error.message); return; }
    toast.success(`${payload.length} offert${payload.length === 1 ? "a salvata" : "e salvate"}`);
    setRighe([]);
    onSaved();
    onClose();
  };

  const confermate = righe.flatMap((r) => r.estratti).filter((e) => e.conferma).length;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Carica PDF — Analisi AI</DialogTitle></DialogHeader>

        <div
          className="border-2 border-dashed rounded-lg p-6 text-center cursor-pointer hover:bg-muted/50"
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => { e.preventDefault(); aggiungiFile(e.dataTransfer.files); }}
          onClick={() => inputRef.current?.click()}
        >
          <Upload className="w-8 h-8 mx-auto text-muted-foreground" />
          <p className="text-sm mt-2">Trascina i PDF qui o clicca per selezionare</p>
          <p className="text-xs text-muted-foreground mt-1">Max 10 file</p>
          <input ref={inputRef} type="file" accept=".pdf" multiple className="hidden" onChange={(e) => aggiungiFile(e.target.files)} />
        </div>

        {righe.length > 0 && (
          <div className="space-y-2">
            {righe.map((r, i) => (
              <div key={i} className="border rounded-lg p-3 space-y-2">
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm flex-1 truncate">{r.file.name}</span>
                  <span className="text-xs text-muted-foreground">{(r.file.size / 1024).toFixed(0)} KB</span>
                  {r.stato === "analizzando" && <Loader2 className="w-4 h-4 animate-spin" />}
                  {r.stato === "ok" && <span className="text-xs text-green-600">✓ {r.estratti.length} offerta{r.estratti.length > 1 ? "e" : ""}</span>}
                  {r.stato === "errore" && <span className="text-xs text-red-600">Errore</span>}
                  <Button variant="ghost" size="icon" onClick={() => rimuovi(i)}><X className="w-4 h-4" /></Button>
                </div>
                {r.errore && <p className="text-xs text-red-600">{r.errore}</p>}
                {r.estratti.map((e, j) => (
                  <div key={j} className="grid sm:grid-cols-2 gap-2 pt-2 border-t">
                    <div className="sm:col-span-2 text-xs font-semibold uppercase text-muted-foreground">
                      Offerta {j + 1} — {e.dati.tipo} · {e.dati.tipo_prezzo}
                    </div>
                    <Input placeholder="Nome" value={e.dati.nome ?? ""} onChange={(ev) => aggiornaCampo(i, j, "nome", ev.target.value)} />
                    <Input placeholder="Fornitore" value={e.dati.fornitore ?? ""} onChange={(ev) => aggiornaCampo(i, j, "fornitore", ev.target.value)} />
                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <label className="block text-[10px] uppercase tracking-wide text-muted-foreground">
                          {e.dati.tipo_prezzo === "fisso"
                            ? `Prezzo fisso €/${e.dati.tipo === "luce" ? "kWh" : "Smc"}`
                            : `Spread €/${e.dati.tipo === "luce" ? "kWh" : "Smc"}`}
                        </label>
                        <Input
                          type="number"
                          step="0.0001"
                          value={
                            e.dati.tipo_prezzo === "fisso"
                              ? e.dati.prezzo_materia_prima ?? ""
                              : e.dati.spread ?? ""
                          }
                          onChange={(ev) =>
                            aggiornaCampo(
                              i,
                              j,
                              e.dati.tipo_prezzo === "fisso" ? "prezzo_materia_prima" : "spread",
                              ev.target.value === "" ? null : parseFloat(ev.target.value)
                            )
                          }
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="block text-[10px] uppercase tracking-wide text-muted-foreground">
                          Quota fissa €/mese
                        </label>
                        <Input
                          type="number"
                          step="0.01"
                          value={e.dati.quota_fissa_mese ?? ""}
                          onChange={(ev) =>
                            aggiornaCampo(i, j, "quota_fissa_mese", ev.target.value === "" ? null : parseFloat(ev.target.value))
                          }
                        />
                      </div>
                    </div>
                    <Input
                      placeholder="Scadenza sottoscrizione (GG/MM/AAAA)"
                      value={e.dati.scadenza_sottoscrizione ?? ""}
                      onChange={(ev) => aggiornaCampo(i, j, "scadenza_sottoscrizione", ev.target.value || null)}
                    />
                    <div className="sm:col-span-2 text-xs text-muted-foreground space-y-0.5">
                      <div>
                        {e.dati.segmento} ·{" "}
                        {e.dati.tipo_prezzo === "fisso"
                          ? `${e.dati.prezzo_materia_prima} €/${e.dati.tipo === "luce" ? "kWh" : "Smc"} fisso`
                          : e.dati.tipo_prezzo === "hybrid"
                            ? `≤soglia: ${e.dati.prezzo_materia_prima} €/${e.dati.tipo === "luce" ? "kWh" : "Smc"} · eccedenza: ${e.dati.indice}×${e.dati.moltiplicatore_indice ?? 1}+${e.dati.spread}`
                            : `${e.dati.indice}×${e.dati.moltiplicatore_indice ?? 1} + ${e.dati.spread} €/${e.dati.tipo === "luce" ? "kWh" : "Smc"}`}
                        {e.dati.durata_mesi ? ` · ${e.dati.durata_mesi}m` : ""}
                      </div>
                      {e.dati.dispacciamento_extra_kwh != null && (
                        <div className="text-orange-600">Disp. venditore: +{e.dati.dispacciamento_extra_kwh} €/kWh</div>
                      )}
                    </div>
                    {(e.dati.componenti_venditore?.length ?? 0) > 0 && (
                      <details className="sm:col-span-2 text-xs">
                        <summary className="cursor-pointer text-muted-foreground hover:text-foreground select-none">
                          Dettaglio venditore ({e.dati.componenti_venditore.length})
                        </summary>
                        <div className="mt-1 space-y-0.5 pl-2 border-l border-border">
                          {e.dati.componenti_venditore.map((v, vi) => (
                            <div key={vi} className="flex gap-2">
                              <span className="font-medium min-w-0">{v.label}:</span>
                              <span className="text-muted-foreground">{v.valore}</span>
                            </div>
                          ))}
                        </div>
                      </details>
                    )}
                    {e.dati.note && <div className="sm:col-span-2 text-xs italic text-muted-foreground">{e.dati.note}</div>}
                    <label className="flex items-center gap-2 text-sm sm:col-span-2">
                      <input type="checkbox" checked={e.conferma} onChange={(ev) => toggleConferma(i, j, ev.target.checked)} />
                      Conferma e salva nel listino
                    </label>
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}

        <DialogFooter className="flex-col sm:flex-row gap-2">
          {righe.length > 0 && righe.some((r) => r.stato !== "ok") && (
            <Button onClick={analizzaTutti} variant="default" className="gap-2">
              <Bot className="w-4 h-4" /> Analizza con Claude
            </Button>
          )}
          <Button onClick={salva} disabled={!confermate || salvando} className="bg-green-600 hover:bg-green-700 text-white gap-2">
            <Save className="w-4 h-4" /> Salva {confermate} offerte
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
