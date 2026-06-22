// =============================================================================
// calcoloOfferte.test.ts — Golden test Motore contendibile (A2)
//
// Tutti i numeri sono NETTO IVA (il motore non applica IVA).
// Tolleranza: toBeCloseTo(x, 2) = ±0.005 (1 centesimo).
// Valori verificati a mano — vedi commenti inline.
// =============================================================================

import { describe, it, expect } from 'vitest';
import {
  calcolaConfrontoOfferte,
  type DatiCliente,
  type CTE,
  type ParametriRegolati,
  type PrezzoMercato,
} from './calcoloOfferte';

// ── Parametri ARERA comuni (perdite_rete 1.10, resto da default mappaImpostazioni) ──

const PARAM_LUCE_1_10: ParametriRegolati = {
  perdite_rete: 1.10,
  accise: 0,
  iva: 0,
};

const PARAM_GAS: ParametriRegolati = {
  accise: 0,
  iva: 0,
};

// ─────────────────────────────────────────────────────────────────────────────
// Caso 1 — Wekiwi reale (gold standard, validato contro bolletta vera)
// ─────────────────────────────────────────────────────────────────────────────

describe('Caso 1 — Wekiwi reale', () => {
  // spesaAttuale = 0.22258 × 1278 + 6.43 × 12 = 284.458 + 77.16 = 361.62
  const cliente: DatiCliente = {
    tipo_fornitura: 'luce',
    tipo_cliente: 'domestico_residente',
    residente: true,
    potenza_impegnata_kw: 3,
    consumo_annuo_kwh: 1278,
    prezzo_materia_luce: 0.222580,
    quota_fissa_luce_mese: 6.43,
  };

  const cteAceaFix: CTE = {
    id: 'acea-fix', nome: 'Acea Fix Casa', fornitore_nome: 'Acea',
    tipo_fornitura: 'luce', tipo_prezzo: 'fisso',
    prezzo_energia_luce: 0.135, quota_fissa_luce: 12,
    priorita: 0,
  };

  const cteAceaFlex: CTE = {
    id: 'acea-flex', nome: 'Acea Flex Casa', fornitore_nome: 'Acea',
    tipo_fornitura: 'luce', tipo_prezzo: 'indicizzato',
    spread_luce: 0.03, quota_fissa_luce: 9,
    priorita: 0,
  };

  const pm: PrezzoMercato = { pun_medio: 0.119466, psv_medio: 0.5 };

  const risultati = calcolaConfrontoOfferte(
    cliente, [cteAceaFix, cteAceaFlex], PARAM_LUCE_1_10, null, pm,
  );

  it('restituisce 2 risultati', () => {
    expect(risultati).toHaveLength(2);
  });

  it('Acea Fix — costo e risparmio corretti', () => {
    const r = risultati.find(x => x.cte_id === 'acea-fix')!;
    // costo = 0.135 × 1278 + 12 × 12 = 172.53 + 144 = 316.53
    expect(r.costo_annuo_totale).toBeCloseTo(316.53, 2);
    // risparmio = 361.62 − 316.53 = 45.09
    expect(r.risparmio_annuo).toBeCloseTo(45.09, 2);
    // risparmio% = 45.09 / 361.62 × 100 ≈ 12.5
    expect(r.risparmio_percentuale).toBeCloseTo(12.5, 0);
  });

  it('Acea Flex indicizzato — costo con PUN × perdite + spread', () => {
    const r = risultati.find(x => x.cte_id === 'acea-flex')!;
    // prezzoLordo = 0.119466 × 1.10 + 0.03 = 0.131413 + 0.03 = 0.161413
    // costo = 0.161413 × 1278 + 9 × 12 = 206.29 + 108 = 314.29
    expect(r.costo_annuo_totale).toBeCloseTo(314.29, 2);
    // risparmio = 361.62 − 314.29 = 47.33
    expect(r.risparmio_annuo).toBeCloseTo(47.33, 2);
  });

  it('Flex precede Fix in classifica (risparmio maggiore)', () => {
    expect(risultati[0].cte_id).toBe('acea-flex');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Caso 2 — Domestico residente, consumo medio italiano, luce fissa
// ─────────────────────────────────────────────────────────────────────────────

describe('Caso 2 — Domestico residente, luce fissa, consumo medio', () => {
  // spesaAttuale = 0.18 × 2700 + 10 × 12 = 486 + 120 = 606
  const cliente: DatiCliente = {
    tipo_fornitura: 'luce',
    tipo_cliente: 'domestico_residente',
    residente: true,
    potenza_impegnata_kw: 3,
    consumo_annuo_kwh: 2700,
    prezzo_materia_luce: 0.18,
    quota_fissa_luce_mese: 10,
  };

  const cte: CTE = {
    id: 'fisso-medio', nome: 'Offerta Fissa Media', fornitore_nome: 'Test',
    tipo_fornitura: 'luce', tipo_prezzo: 'fisso',
    prezzo_energia_luce: 0.13, quota_fissa_luce: 9,
    priorita: 0,
  };

  const pm: PrezzoMercato = { pun_medio: 0.12, psv_medio: 0.5 };
  const risultati = calcolaConfrontoOfferte(cliente, [cte], PARAM_LUCE_1_10, null, pm);

  it('costo offerta corretto', () => {
    // costo = 0.13 × 2700 + 9 × 12 = 351 + 108 = 459
    expect(risultati[0].costo_annuo_totale).toBeCloseTo(459, 2);
  });

  it('risparmio corretto', () => {
    // risparmio = 606 − 459 = 147
    expect(risultati[0].risparmio_annuo).toBeCloseTo(147, 2);
    // % = 147 / 606 × 100 ≈ 24.3
    expect(risultati[0].risparmio_percentuale).toBeCloseTo(24.3, 0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Caso 3 — Business, consumo grande, luce indicizzata
// ─────────────────────────────────────────────────────────────────────────────

describe('Caso 3 — Business indicizzato, consumo industriale', () => {
  // spesaAttuale = 0.16 × 30000 + 25 × 12 = 4800 + 300 = 5100
  const cliente: DatiCliente = {
    tipo_fornitura: 'luce',
    tipo_cliente: 'business',
    residente: false,
    potenza_impegnata_kw: 15,
    consumo_annuo_kwh: 30000,
    prezzo_materia_luce: 0.16,
    quota_fissa_luce_mese: 25,
  };

  const cte: CTE = {
    id: 'biz-index', nome: 'Offerta Business Index', fornitore_nome: 'Test',
    tipo_fornitura: 'luce', tipo_prezzo: 'indicizzato',
    spread_luce: 0.02, quota_fissa_luce: 20,
    priorita: 0,
  };

  const pm: PrezzoMercato = { pun_medio: 0.12, psv_medio: 0.5 };
  const risultati = calcolaConfrontoOfferte(cliente, [cte], PARAM_LUCE_1_10, null, pm);

  it('costo offerta indicizzato con perdite su PUN, spread al contatore', () => {
    // prezzoLordo = 0.12 × 1.10 + 0.02 = 0.132 + 0.02 = 0.152
    // costo = 0.152 × 30000 + 20 × 12 = 4560 + 240 = 4800
    expect(risultati[0].costo_annuo_totale).toBeCloseTo(4800, 2);
  });

  it('risparmio corretto', () => {
    // risparmio = 5100 − 4800 = 300
    expect(risultati[0].risparmio_annuo).toBeCloseTo(300, 2);
    // % = 300 / 5100 × 100 ≈ 5.9
    expect(risultati[0].risparmio_percentuale).toBeCloseTo(5.9, 0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Caso 4 — Gas only, nessuna perdita di rete (invariante)
// ─────────────────────────────────────────────────────────────────────────────

describe('Caso 4 — Gas only, nessuna perdita di rete', () => {
  // spesaAttuale = 0.45 × 1200 + 8 × 12 = 540 + 96 = 636
  const cliente: DatiCliente = {
    tipo_fornitura: 'gas',
    tipo_cliente: 'domestico_residente',
    consumo_annuo_smc: 1200,
    prezzo_materia_gas: 0.45,
    quota_fissa_gas_mese: 8,
  };

  const cteFisso: CTE = {
    id: 'gas-fisso', nome: 'Gas Fisso', fornitore_nome: 'Test',
    tipo_fornitura: 'gas', tipo_prezzo: 'fisso',
    prezzo_energia_gas: 0.40, quota_fissa_gas: 7,
    priorita: 0,
  };

  const pm: PrezzoMercato = { pun_medio: 0.12, psv_medio: 0.5 };
  const risultati = calcolaConfrontoOfferte(cliente, [cteFisso], null, PARAM_GAS, pm);

  it('costo gas senza applicazione perdite_rete', () => {
    // costo = 0.40 × 1200 + 7 × 12 = 480 + 84 = 564 (NO × 1.10)
    expect(risultati[0].costo_annuo_totale).toBeCloseTo(564, 2);
  });

  it('risparmio corretto', () => {
    // risparmio = 636 − 564 = 72
    expect(risultati[0].risparmio_annuo).toBeCloseTo(72, 2);
    // % = 72 / 636 × 100 ≈ 11.3
    expect(risultati[0].risparmio_percentuale).toBeCloseTo(11.3, 0);
  });

  it('perdite_rete non applicate: costo_materia_energia = prezzo × consumo esatto', () => {
    // Se perdite fossero applicate: 0.40 × 1200 × 1.10 = 528 ≠ 480
    expect(risultati[0].costo_materia_energia).toBeCloseTo(480, 2);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Caso 5 — Dual (luce + gas), offerta unica
// ─────────────────────────────────────────────────────────────────────────────

describe('Caso 5 — Dual luce + gas', () => {
  // spesaAttuale = (0.18×2700 + 10×12) + (0.45×1200 + 8×12) = 606 + 636 = 1242
  const cliente: DatiCliente = {
    tipo_fornitura: 'dual',
    tipo_cliente: 'domestico_residente',
    residente: true,
    potenza_impegnata_kw: 3,
    consumo_annuo_kwh: 2700,
    prezzo_materia_luce: 0.18,
    quota_fissa_luce_mese: 10,
    consumo_annuo_smc: 1200,
    prezzo_materia_gas: 0.45,
    quota_fissa_gas_mese: 8,
  };

  const cteDual: CTE = {
    id: 'dual-1', nome: 'Dual Casa', fornitore_nome: 'Test',
    tipo_fornitura: 'dual', tipo_prezzo: 'fisso',
    prezzo_energia_luce: 0.13, quota_fissa_luce: 9,
    prezzo_energia_gas: 0.40, quota_fissa_gas: 7,
    priorita: 0,
  };

  const pm: PrezzoMercato = { pun_medio: 0.12, psv_medio: 0.5 };
  const risultati = calcolaConfrontoOfferte(
    cliente, [cteDual], PARAM_LUCE_1_10, PARAM_GAS, pm,
  );

  it('costo totale dual = somma luce + gas', () => {
    // luce: 0.13×2700 + 9×12 = 351+108 = 459
    // gas:  0.40×1200 + 7×12 = 480+84  = 564
    // totale: 459 + 564 = 1023
    expect(risultati[0].costo_annuo_totale).toBeCloseTo(1023, 2);
  });

  it('risparmio dual corretto', () => {
    // risparmio = 1242 − 1023 = 219
    expect(risultati[0].risparmio_annuo).toBeCloseTo(219, 2);
    // % = 219 / 1242 × 100 ≈ 17.6
    expect(risultati[0].risparmio_percentuale).toBeCloseTo(17.6, 0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Caso 6 — Hard stop: cliente senza prezzo materia → 0 risultati
// ─────────────────────────────────────────────────────────────────────────────

describe('Caso 6 — Hard stop senza dati cliente', () => {
  const clienteSenzaPrezzo: DatiCliente = {
    tipo_fornitura: 'luce',
    tipo_cliente: 'domestico_residente',
    consumo_annuo_kwh: 2700,
    // prezzo_materia_luce: undefined — mancante intenzionalmente
  };

  const cte: CTE = {
    id: 'qualsiasi', nome: 'Offerta X', fornitore_nome: 'Test',
    tipo_fornitura: 'luce', tipo_prezzo: 'fisso',
    prezzo_energia_luce: 0.13, quota_fissa_luce: 9,
    priorita: 0,
  };

  const pm: PrezzoMercato = { pun_medio: 0.12, psv_medio: 0.5 };
  const risultati = calcolaConfrontoOfferte(
    clienteSenzaPrezzo, [cte], PARAM_LUCE_1_10, null, pm,
  );

  it('nessun risultato se prezzo_materia mancante', () => {
    expect(risultati).toHaveLength(0);
  });

  it('stesso comportamento con prezzo_materia = 0', () => {
    const clienteZero: DatiCliente = {
      ...clienteSenzaPrezzo,
      prezzo_materia_luce: 0,
    };
    const r = calcolaConfrontoOfferte(clienteZero, [cte], PARAM_LUCE_1_10, null, pm);
    expect(r).toHaveLength(0);
  });
});
