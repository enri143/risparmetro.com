import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Camera, Upload, Loader2, FileText, AlertTriangle, CheckCircle2, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { DatiCliente } from "@/lib/board/types";
import { type Extracted, mergeExtracted, buildPatch } from "@/lib/board/ocrBolletta";

type StatoRiga = "idle" | "extracting" | "done" | "error";

export interface OcrDoneResult {
  extracted: Extracted;
  raw: unknown;
  filePath: string | null;
  extractedAt: string;
}

function mimeToExt(mime: string): string {
  if (mime === "image/jpeg") return ".jpg";
  if (mime === "image/png") return ".png";
  if (mime === "image/webp") return ".webp";
  if (mime === "application/pdf") return ".pdf";
  return ".bin";
}

interface Riga {
  file: File;
  preview: string | null;
  stato: StatoRiga;
  errore?: string;
  extracted?: Extracted;
  filePath?: string | null;
  ocrRaw?: unknown;
}

interface Props {
  dati: DatiCliente;
  onApply: (patch: Partial<DatiCliente>, extracted: Extracted) => void;
  onOcrDone?: (result: OcrDoneResult) => void;
}

const MAX_SIZE = 10 * 1024 * 1024;
const MAX_FILES = 5;

function fileToBase64(file: File): Promise<{ base64: string; mime: string }> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => {
      const s = String(r.result || "");
      const comma = s.indexOf(",");
      if (comma < 0) return reject(new Error("invalid data url"));
      resolve({ base64: s.slice(comma + 1), mime: file.type });
    };
    r.onerror = () => reject(r.error);
    r.readAsDataURL(file);
  });
}

export function UploadBollettaButton({ dati, onApply, onOcrDone }: Props) {
  const [open, setOpen] = useState(false);
  const [righe, setRighe] = useState<Riga[]>([]);
  const [working, setWorking] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const reset = () => {
    setRighe([]);
    setWorking(false);
  };

  const close = () => { setOpen(false); setTimeout(reset, 200); };

  const addFiles = (files: FileList | File[] | null) => {
    if (!files) return;
    const arr = Array.from(files);
    const nuove: Riga[] = [];
    for (const f of arr) {
      if (righe.length + nuove.length >= MAX_FILES) break;
      if (f.size > MAX_SIZE) {
        toast.error(`${f.name}: file troppo grande (max 10 MB).`);
        continue;
      }
      nuove.push({
        file: f,
        preview: f.type.startsWith("image/") ? URL.createObjectURL(f) : null,
        stato: "idle",
      });
    }
    setRighe((r) => [...r, ...nuove]);
  };

  const removeRiga = (idx: number) => {
    setRighe((r) => r.filter((_, i) => i !== idx));
  };

  const analizzaTutte = async () => {
    if (righe.length === 0) return;
    setWorking(true);
    setRighe((r) => r.map((x) => x.stato === "done" ? x : { ...x, stato: "extracting", errore: undefined }));

    const snap = righe;
    await Promise.all(snap.map(async (riga, i) => {
      if (riga.stato === "done") return;
      try {
        const { base64, mime } = await fileToBase64(riga.file);

        let filePath: string | null = null;
        try {
          const { data: tenantId } = await supabase.rpc("current_tenant_id");
          if (tenantId) {
            const path = `${tenantId}/${crypto.randomUUID()}${mimeToExt(mime)}`;
            const { error: uploadErr } = await supabase.storage
              .from("bollette")
              .upload(path, riga.file, { upsert: false });
            if (!uploadErr) filePath = path;
            else console.warn("[UploadBolletta] storage:", uploadErr.message);
          }
        } catch (upErr) {
          console.warn("[UploadBolletta] storage skip:", upErr);
        }

        const { data, error } = await supabase.functions.invoke("extract-bolletta-board", {
          body: { file_base64: base64, mime_type: mime },
        });

        if (error) {
          // Prova a leggere il corpo dell'errore HTTP dalla edge function
          let msg: string | undefined;
          try {
            const body = await (error as any).context?.json?.();
            msg = body?.error ?? body?.message;
          } catch { /* ignora */ }
          if (!msg) msg = error.message;
          console.error("[UploadBolletta] invoke error:", { error, data });
          throw new Error(msg && !msg.includes("non-2xx") ? msg : "Errore OCR: controlla i log (F12 → Console)");
        }

        if (!data?.ok) {
          console.error("[UploadBolletta] ok:false:", data);
          throw new Error(data?.error || "Errore OCR: controlla i log (F12 → Console)");
        }

        setRighe((r) => r.map((x, idx) =>
          idx === i
            ? { ...x, stato: "done", extracted: data.extracted as Extracted, filePath, ocrRaw: data.raw }
            : x
        ));
      } catch (e: any) {
        console.error("[UploadBolletta] catch:", e);
        const msg: string = e?.message || "Errore OCR: controlla i log (F12 → Console)";
        setRighe((r) => r.map((x, idx) => idx === i ? { ...x, stato: "error", errore: msg } : x));
      }
    }));
    setWorking(false);
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    addFiles(e.dataTransfer.files);
  };

  const apply = () => {
    const doneRighe = righe.filter((r) => r.stato === "done" && r.extracted);
    if (doneRighe.length === 0) return;
    const merged = mergeExtracted(doneRighe.map((r) => r.extracted!));
    onApply(buildPatch(merged, dati), merged);
    if (onOcrDone) {
      onOcrDone({
        extracted: merged,
        raw: doneRighe.map((r) => r.ocrRaw).filter(Boolean),
        filePath: doneRighe.find((r) => r.filePath != null)?.filePath ?? null,
        extractedAt: new Date().toISOString(),
      });
    }
    const pezzi: string[] = [];
    if (merged.luce?.consumo_annuo_kwh) pezzi.push(`${merged.luce.consumo_annuo_kwh} kWh/anno`);
    if (merged.gas?.consumo_annuo_smc) pezzi.push(`${merged.gas.consumo_annuo_smc} Smc/anno`);
    const cnt = doneRighe.length;
    toast.success(`✓ ${cnt} bolletta${cnt > 1 ? "e" : ""} importat${cnt > 1 ? "e" : "a"}${pezzi.length ? " · " + pezzi.join(" · ") : ""}`);
    close();
  };

  const doneList = righe.filter((r) => r.stato === "done" && r.extracted);
  const merged = doneList.length > 0 ? mergeExtracted(doneList.map((r) => r.extracted!)) : null;
  const conf = merged?.confidence ?? 0;
  const blockApply = !merged || conf < 0.4;
  const tuttiCompleti = righe.length > 0 && righe.every((r) => r.stato === "done");
  const daAnalizzare = righe.some((r) => r.stato === "idle" || r.stato === "error");

  return (
    <>
      <Button type="button" variant="outline" size="sm" onClick={() => setOpen(true)} className="gap-2">
        <Camera className="w-4 h-4" /> Carica bolletta (OCR)
      </Button>

      <Dialog open={open} onOpenChange={(o) => (o ? setOpen(true) : close())}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Carica bollette</DialogTitle>
            <DialogDescription>
              Puoi caricare più file insieme (es. luce + gas, fino a {MAX_FILES}). I dati verranno uniti automaticamente.
            </DialogDescription>
          </DialogHeader>

          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={onDrop}
            onClick={() => inputRef.current?.click()}
            className={cn(
              "border-2 border-dashed rounded-lg p-5 text-center cursor-pointer transition-colors",
              "hover:border-primary hover:bg-primary/5 border-muted-foreground/30",
            )}
          >
            <Upload className="w-7 h-7 mx-auto mb-2 text-muted-foreground" />
            <div className="text-sm font-medium">Trascina qui o tocca per caricare</div>
            <div className="text-xs text-muted-foreground mt-1">
              JPG, PNG o PDF · max 10 MB · fino a {MAX_FILES} file
            </div>
            <input
              ref={inputRef}
              type="file"
              accept="image/*,application/pdf"
              multiple
              className="hidden"
              onChange={(e) => {
                addFiles(e.target.files);
                e.currentTarget.value = "";
              }}
            />
          </div>

          {righe.length > 0 && (
            <div className="space-y-2">
              {righe.map((r, i) => (
                <div key={i} className="flex items-center gap-2 border rounded-md p-2">
                  {r.preview ? (
                    <img src={r.preview} alt="" className="w-10 h-10 rounded object-cover border shrink-0" />
                  ) : (
                    <div className="w-10 h-10 rounded border bg-muted flex items-center justify-center shrink-0">
                      <FileText className="w-5 h-5 text-muted-foreground" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="text-sm truncate">{r.file.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {(r.file.size / 1024).toFixed(0)} KB
                      {r.stato === "done" && r.extracted && (
                        <> · <span className="text-green-700">
                          {r.extracted.luce && r.extracted.gas ? "luce + gas" : r.extracted.luce ? "luce" : "gas"}
                          {r.extracted.fornitore_attuale ? ` · ${r.extracted.fornitore_attuale}` : ""}
                        </span></>
                      )}
                      {r.stato === "error" && <span className="text-destructive"> · {r.errore}</span>}
                    </div>
                  </div>
                  {r.stato === "extracting" && <Loader2 className="w-4 h-4 animate-spin text-primary" />}
                  {r.stato === "done" && <CheckCircle2 className="w-4 h-4 text-green-600" />}
                  {r.stato === "error" && <AlertTriangle className="w-4 h-4 text-destructive" />}
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => removeRiga(i)} disabled={working}>
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}

          {merged && tuttiCompleti && (
            <div className="space-y-2">
              {conf < 0.6 && conf >= 0.4 && (
                <div className="rounded-md border border-yellow-300 bg-yellow-50 p-2 text-xs text-yellow-900 flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                  <span>Estrazione incerta, verifica i campi prima di confermare.</span>
                </div>
              )}
              {conf < 0.4 && (
                <div className="rounded-md border border-destructive/40 bg-destructive/5 p-2 text-xs text-destructive flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                  <span>Estrazione poco affidabile. Riprova con file migliori.</span>
                </div>
              )}

              <div className="rounded-md border bg-muted/30 p-3 text-xs space-y-1 max-h-48 overflow-auto">
                <div className="font-semibold mb-1">Riepilogo unito (confidence {Math.round(conf * 100)}%)</div>
                {merged.luce && (
                  <>
                    <div><b>⚡ Luce</b> · {merged.luce.consumo_annuo_kwh ?? "?"} kWh/anno · {merged.luce.prezzo_materia_kwh ?? "?"} €/kWh · fisso {merged.luce.fisso_mese_eur ?? "?"} €/mese</div>
                    <div>Potenza {merged.luce.potenza_impegnata_kw ?? "?"} kW · {merged.luce.tipo_contatore}</div>
                    {merged.luce.consumi_fasce_annui && (
                      <div>Fasce: F1 {merged.luce.consumi_fasce_annui.f1_kwh} · F2 {merged.luce.consumi_fasce_annui.f2_kwh} · F3 {merged.luce.consumi_fasce_annui.f3_kwh}</div>
                    )}
                  </>
                )}
                {merged.gas && (
                  <div><b>🔥 Gas</b> · {merged.gas.consumo_annuo_smc ?? "?"} Smc/anno · {merged.gas.prezzo_materia_smc ?? "?"} €/Smc · fisso {merged.gas.fisso_mese_eur ?? "?"} €/mese</div>
                )}
                <div>Segmento: {merged.segmento} {merged.residente ? "· residente" : ""} {merged.canone_rai ? "· canone RAI" : ""}</div>
              </div>
            </div>
          )}

          <div className="flex gap-2 justify-end">
            <Button variant="ghost" onClick={close} disabled={working}>Annulla</Button>
            {daAnalizzare && (
              <Button onClick={analizzaTutte} disabled={working || righe.length === 0}>
                {working ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Lettura…</> : `Analizza ${righe.length} file`}
              </Button>
            )}
            {tuttiCompleti && (
              <Button onClick={apply} disabled={blockApply}>Applica al form</Button>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

export function raccomandaFasce(f1: number, f2: number, f3: number) {
  const tot = f1 + f2 + f3;
  if (tot === 0) return null;
  const pctF3 = (f3 / tot) * 100;
  const pctF1 = (f1 / tot) * 100;
  if (pctF3 >= 40) {
    return {
      tipo: "fasce" as const,
      messaggio: `Il cliente ha il ${Math.round(pctF3)}% dei consumi in F3 (notti/weekend). Conviene una tariffa a fasce con F3 scontata: risparmio potenziale +15-25% rispetto a una monoraria.`,
      severity: "success" as const,
    };
  }
  if (pctF1 >= 50) {
    return {
      tipo: "monorario" as const,
      messaggio: `Il cliente ha il ${Math.round(pctF1)}% dei consumi in F1 (ore piene). Una monoraria è solitamente più conveniente.`,
      severity: "info" as const,
    };
  }
  return {
    tipo: "indifferente" as const,
    messaggio: `Distribuzione consumi bilanciata (F1 ${Math.round(pctF1)}% · F3 ${Math.round(pctF3)}%). Confronta entrambe le tipologie per scegliere il meglio.`,
    severity: "info" as const,
  };
}
