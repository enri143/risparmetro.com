import { useState, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Upload, FileText, X, Bot, Save, Loader2 } from "lucide-react";
import { fileToBase64, type CTEEstratta } from "@/lib/board/claude";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { BOARD_PWD_KEY } from "@/pages/BoardLogin";

type Stato = "idle" | "analizzando" | "ok" | "errore";
interface Estratto { dati: CTEEstratta; conferma: boolean; }
interface Riga { file: File; stato: Stato; estratti: Estratto[]; errore?: string; }

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
    const password = sessionStorage.getItem(BOARD_PWD_KEY) ?? "";
    if (!password) {
      toast.error("Sessione scaduta — effettua di nuovo il login");
      return;
    }
    setRighe((r) => r.map((x) => x.stato === "ok" ? x : { ...x, stato: "analizzando" }));
    for (let i = 0; i < righe.length; i++) {
      if (righe[i].stato === "ok") continue;
      try {
        const b64 = await fileToBase64(righe[i].file);
        const { data, error } = await supabase.functions.invoke("analyze-cte", { body: { password, pdfBase64: b64 } });
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
    const { normalizzaCodiceSG } = await import("@/lib/board/sgCodice");
    const payload = righe
      .filter((r) => r.stato === "ok")
      .flatMap((r) => {
        const baseNome = r.file.name.replace(/\.[a-z0-9]{1,5}$/i, "");
        const codiceFromFile = normalizzaCodiceSG(r.file.name);
        return r.estratti.filter((e) => e.conferma).map((e) => {
          const out = { ...e.dati, attiva: true } as CTEEstratta & { attiva: boolean; codice_offerta?: string | null };
          if (!out.codice_offerta && /sg\s*energia/i.test(String(e.dati.fornitore ?? ""))) {
            out.codice_offerta = normalizzaCodiceSG(String(e.dati.nome ?? "")) ?? codiceFromFile ?? baseNome;
          }
          return out;
        });
      });
    if (!payload.length) return;
    setSalvando(true);
    const { error } = await supabase.from("cte").insert(payload);
    setSalvando(false);
    if (error) { toast.error("Errore salvataggio: " + error.message); return; }
    toast.success(`${payload.length} offerte salvate`);
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
                      Offerta {j + 1} — {e.dati.tipo}
                    </div>
                    <Input placeholder="Nome" value={e.dati.nome ?? ""} onChange={(ev) => aggiornaCampo(i, j, "nome", ev.target.value)} />
                    <Input placeholder="Fornitore" value={e.dati.fornitore ?? ""} onChange={(ev) => aggiornaCampo(i, j, "fornitore", ev.target.value)} />
                    <Input placeholder="Comm. annua" type="number" value={e.dati.commercializzazione_anno ?? 0} onChange={(ev) => aggiornaCampo(i, j, "commercializzazione_anno", parseFloat(ev.target.value) || 0)} />
                    <Input placeholder="Validità" value={e.dati.validita ?? ""} onChange={(ev) => aggiornaCampo(i, j, "validita", ev.target.value)} />
                    <div className="sm:col-span-2 text-xs text-muted-foreground">
                      {e.dati.tipo} · {e.dati.segmento} · {e.dati.tipo_prezzo}
                      {e.dati.tipo_prezzo === "fisso" ? ` · ${e.dati.prezzo_fisso} €` : ` · ${e.dati.indice} + ${e.dati.spread}`}
                    </div>
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
