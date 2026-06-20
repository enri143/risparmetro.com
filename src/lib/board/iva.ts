import type { DatiCliente, Impostazioni } from "./types";

/** Restituisce l'aliquota IVA decimale corretta per il cliente. */
export function aliquotaIvaCliente(dati: DatiCliente, imp: Impostazioni): number {
  if (dati.segmento === "business") return imp.iva_bus;
  // family
  return dati.residente ? imp.iva_dom : imp.iva_bus;
}

export function applicaIva(valoreNetto: number, aliquota: number): number {
  return valoreNetto * (1 + aliquota);
}

export function etichettaIva(aliquota: number): string {
  return `IVA incl. (${Math.round(aliquota * 100)}%)`;
}
