import { describe, it, expect } from "vitest";
import { splitSnapshot, stripProvvigioni } from "./storico";
import type { RisultatoOfferta } from "./calcoloOfferte";

function makeOfferta(overrides: Partial<RisultatoOfferta> = {}): RisultatoOfferta {
  return {
    cte_id: "cte-1",
    nome: "Offerta Test",
    fornitore_nome: "Fornitore X",
    tipo_prezzo: "fisso",
    costo_materia_energia: 500,
    costo_trasporto: 0,
    costo_oneri: 0,
    costo_accise: 0,
    imponibile: 500,
    iva: 0,
    quota_fissa_annua: 60,
    sconti: 0,
    costo_annuo_totale: 560,
    risparmio_annuo: 100,
    risparmio_percentuale: 15,
    ...overrides,
  };
}

describe("splitSnapshot", () => {
  it("splits luce and gas by _util field", () => {
    const snapshot = [
      { ...makeOfferta({ nome: "L1" }), _util: "luce" },
      { ...makeOfferta({ nome: "L2" }), _util: "luce" },
      { ...makeOfferta({ nome: "G1" }), _util: "gas" },
    ];
    const { luce, gas } = splitSnapshot(snapshot);
    expect(luce.length).toBe(2);
    expect(gas.length).toBe(1);
  });

  it("returns empty arrays when snapshot is empty", () => {
    const { luce, gas } = splitSnapshot([]);
    expect(luce.length).toBe(0);
    expect(gas.length).toBe(0);
  });
});

describe("stripProvvigioni", () => {
  it("removes provvigione, provvigione_tipo, mesi_storno_rischio", () => {
    const r = makeOfferta({ provvigione: 50, provvigione_tipo: "fisso", mesi_storno_rischio: 12 });
    const stripped = stripProvvigioni(r);
    expect(Object.keys(stripped)).not.toContain("provvigione");
    expect(Object.keys(stripped)).not.toContain("provvigione_tipo");
    expect(Object.keys(stripped)).not.toContain("mesi_storno_rischio");
  });

  it("preserves costo_annuo_totale and risparmio_annuo", () => {
    const r = makeOfferta({ provvigione: 50 });
    const stripped = stripProvvigioni(r);
    expect(stripped.costo_annuo_totale).toBe(560);
    expect(stripped.risparmio_annuo).toBe(100);
  });
});
