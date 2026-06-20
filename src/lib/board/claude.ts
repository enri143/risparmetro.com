export interface CTEEstratta {
  nome: string;
  fornitore: string;
  tipo: "luce" | "gas";
  segmento: "family" | "business";
  tipo_prezzo: "fisso" | "index";
  prezzo_fisso: number | null;
  indice: "PUN" | "PSV" | null;
  spread: number | null;
  tipo_pun?: "monorario" | "fasce" | null;
  commercializzazione_anno: number;
  cvv_variabile: number;
  dispacciamento_kwh?: number;
  penale_recesso: boolean;
  validita: string;
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
