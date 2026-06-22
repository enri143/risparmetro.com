export interface CTEEstratta {
  nome: string;
  fornitore: string;
  tipo: "luce" | "gas";
  segmento: "family" | "business";
  tipo_prezzo: "fisso" | "index" | "hybrid";
  prezzo_materia_prima: number | null;
  indice: "PUN" | "PSV" | null;
  moltiplicatore_indice: number;
  spread: number | null;
  quota_fissa_mese: number | null;
  dispacciamento_extra_kwh: number | null;
  durata_mesi: number | null;
  prezzo_dopo_durata: string | null;
  scadenza_sottoscrizione: string | null;
  componenti_venditore: { label: string; valore: string }[];
  note: string;
}

export async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const res = reader.result as string;
      const idx = res.indexOf(",");
      resolve(idx >= 0 ? res.slice(idx + 1) : res);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}


// NOTE: analisi CTE è stata spostata sull'edge function `analyze-cte` per non
// esporre la chiave Anthropic al browser. Vedi UploadPdfFlow.tsx.
