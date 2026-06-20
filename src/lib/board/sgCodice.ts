/**
 * Estrae il codice offerta SG da un nome file/offerta.
 * Esempi:
 *   IMFL00_E000C_2606_901.pdf  → IMFL00_E000C_901
 *   IMFL00_E000A_2606_901      → IMFL00_E000A_901
 *   IMFL00_E000A_901           → IMFL00_E000A_901
 *   CAFL00_G000B_901           → CAFL00_G000B_901
 */
export function normalizzaCodiceSG(input: string | null | undefined): string | null {
  if (!input) return null;
  let s = input.trim();
  // togli estensione (qualsiasi)
  s = s.replace(/\.[a-z0-9]{1,5}$/i, "");
  // pattern: PREFISSO_(SUFF)_(\d{3,4})_(\d{3,4}) → PREFISSO_SUFF_ultimo
  // gestisce il segmento data nel mezzo (es. _2606_)
  const m = s.match(/^([A-Z]{4,8}\d{2,4}_[EG]\d{3}[A-Z])(?:_\d{3,4})?_(\d{3,4})$/i);
  if (m) return `${m[1]}_${m[2]}`.toUpperCase();
  return s.toUpperCase();
}
