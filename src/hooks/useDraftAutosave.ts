import { useEffect } from "react";
import type { DatiCliente } from "@/lib/board/types";

export interface DraftPayload {
  dati: DatiCliente;
  savedAt: string;
  modalita?: "entrambi" | "luce" | "gas";
}

function draftKey(segmento: string) {
  return `board_draft_${segmento}`;
}

export function loadDraft(segmento: string): DraftPayload | null {
  try {
    const raw = localStorage.getItem(draftKey(segmento));
    if (!raw) return null;
    return JSON.parse(raw) as DraftPayload;
  } catch {
    return null;
  }
}

export function clearDraft(segmento: string) {
  try {
    localStorage.removeItem(draftKey(segmento));
  } catch {
    // noop
  }
}

export function useDraftAutosave(dati: DatiCliente) {
  useEffect(() => {
    const payload: DraftPayload = { dati, savedAt: new Date().toISOString() };
    try {
      localStorage.setItem(draftKey(dati.segmento), JSON.stringify(payload));
    } catch {
      // noop
    }
  }, [dati]);
}
