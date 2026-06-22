function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export interface PuntoProiezione {
  mese: number;
  spesaAttualeMese: number;
  spesaOffertaMese: number;
  risparmioCumulato: number;
}

export function proiezione12Mesi(
  spesaAnnua: number,
  costoOfferta: number,
): PuntoProiezione[] {
  const attualeMese = spesaAnnua / 12;
  const offertaMese = costoOfferta / 12;
  const risparmioMese = attualeMese - offertaMese;

  return Array.from({ length: 12 }, (_, i) => {
    const m = i + 1;
    return {
      mese: m,
      spesaAttualeMese: round2(attualeMese),
      spesaOffertaMese: round2(offertaMese),
      risparmioCumulato: round2(risparmioMese * m),
    };
  });
}
