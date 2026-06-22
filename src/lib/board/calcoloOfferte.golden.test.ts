// I numeri negli snapshot sono il contratto frozen del motore.
// Se un refactor li cambia il test fallisce: è intenzionale. Aggiorna con
// `npm run test -- -u` solo dopo verifica manuale che la variazione sia corretta.

import { describe, it, expect } from 'vitest'
import {
  calcolaConfrontoOfferte,
  type DatiCliente,
  type CTE,
  type ParametriRegolati,
  type PrezzoMercato,
} from './calcoloOfferte'

// ── Parametri ARERA fissi (valori coerenti col seed II trimestre 2026) ────────

const PL_RESIDENTE: ParametriRegolati = {
  trasporto_gestione: 0.0424,
  oneri_sistema:      0.0287,
  accise:             0.0227, // domestico residente
  iva:                0.10,
}

const PL_NON_RESIDENTE: ParametriRegolati = {
  trasporto_gestione: 0.0424,
  oneri_sistema:      0.0287,
  accise:             0.0443, // domestico non residente (tariffa piena)
  iva:                0.10,
}

const PL_BUSINESS: ParametriRegolati = {
  trasporto_gestione: 0.0424,
  oneri_sistema:      0.0287,
  accise:             0.0125, // uso non domestico
  iva:                0.22,
}

const PG_RESIDENTE: ParametriRegolati = {
  trasporto_gestione: 0,      // non usato per gas (il motore usa .trasporto)
  oneri_sistema:      0,      // non usato per gas (il motore usa .oneri)
  trasporto:          0.1850,
  oneri:              0.0120,
  accise:             0,      // gas: le accise le calcola calcolaAcciseGas internamente
  iva:                0.10,
}

const PM: PrezzoMercato = { pun_medio: 0.115, psv_medio: 0.420 }

// ── Helper per estrarre i 3 campi chiave ─────────────────────────────────────

function key(r: ReturnType<typeof calcolaConfrontoOfferte>[0]) {
  return {
    costo_annuo_totale:    r.costo_annuo_totale,
    risparmio_annuo:       r.risparmio_annuo,
    risparmio_percentuale: r.risparmio_percentuale,
  }
}

// ─────────────────────────────────────────────────────────────────────────────

describe('calcolaConfrontoOfferte — golden tests', () => {

  it('caso 1 — luce only, domestico residente, prezzo fisso', () => {
    // consumo 2700 kWh/anno, spesa attuale 900 €
    // CTE fissa: 0.1350 €/kWh + 9.90 €/mese quota
    const cliente: DatiCliente = {
      tipo_fornitura: 'luce',
      tipo_cliente:   'domestico_residente',
      consumo_annuo_kwh: 2700,
      spesa_annua_luce:  900,
    }
    const cte: CTE = {
      id: 'c1', nome: 'Offerta Fisso Luce', fornitore_nome: 'Test Fornitore',
      tipo_fornitura: 'luce', tipo_prezzo: 'fisso',
      prezzo_energia_luce: 0.1350,
      quota_fissa_luce: 9.90,
    }
    const r = calcolaConfrontoOfferte(cliente, [cte], PL_RESIDENTE, null, PM)
    expect(key(r[0])).toMatchInlineSnapshot(`
      {
        "costo_annuo_totale": 798.34,
        "risparmio_annuo": 101.66,
        "risparmio_percentuale": 11.3,
      }
    `)
  })

  it('caso 2 — gas only, domestico residente, indicizzato PSV', () => {
    // consumo 600 Smc/anno, uso riscaldamento, spesa attuale 1200 €
    // CTE indicizzata: PSV + 0.050 €/Smc spread + 7.50 €/mese quota
    const cliente: DatiCliente = {
      tipo_fornitura: 'gas',
      tipo_cliente:   'domestico_residente',
      consumo_annuo_smc: 600,
      uso_gas:           'riscaldamento',
      spesa_annua_gas:   1200,
    }
    const cte: CTE = {
      id: 'c2', nome: 'Offerta Index Gas', fornitore_nome: 'Test Fornitore',
      tipo_fornitura: 'gas', tipo_prezzo: 'indicizzato',
      spread_gas: 0.050,
      quota_fissa_gas: 7.50,
    }
    const r = calcolaConfrontoOfferte(cliente, [cte], null, PG_RESIDENTE, PM)
    expect(key(r[0])).toMatchInlineSnapshot(`
      {
        "costo_annuo_totale": 627.77,
        "risparmio_annuo": 572.23,
        "risparmio_percentuale": 47.7,
      }
    `)
  })

  it('caso 3 — dual (luce + gas), domestico residente, entrambi fissi', () => {
    // luce 2700 kWh (spesa 900) + gas 600 Smc uso entrambi (spesa 1200) = 2100 €
    const cliente: DatiCliente = {
      tipo_fornitura: 'dual',
      tipo_cliente:   'domestico_residente',
      consumo_annuo_kwh: 2700,
      consumo_annuo_smc: 600,
      uso_gas:           'entrambi',
      spesa_annua_luce:  900,
      spesa_annua_gas:   1200,
    }
    const cte: CTE = {
      id: 'c3', nome: 'Offerta Dual Fisso', fornitore_nome: 'Test Fornitore',
      tipo_fornitura: 'dual', tipo_prezzo: 'fisso',
      prezzo_energia_luce: 0.1350, quota_fissa_luce: 9.90,
      prezzo_energia_gas:  0.5200, quota_fissa_gas:  9.00,
    }
    const r = calcolaConfrontoOfferte(cliente, [cte], PL_RESIDENTE, PG_RESIDENTE, PM)
    expect(key(r[0])).toMatchInlineSnapshot(`
      {
        "costo_annuo_totale": 1477.1,
        "risparmio_annuo": 622.9,
        "risparmio_percentuale": 29.7,
      }
    `)
  })

  it('caso 4 — luce only, domestico NON residente (accise più alte)', () => {
    // stesse condizioni del caso 1 ma accise non residente 0.0443
    const cliente: DatiCliente = {
      tipo_fornitura: 'luce',
      tipo_cliente:   'domestico_non_residente',
      consumo_annuo_kwh: 2700,
      spesa_annua_luce:  900,
    }
    const cte: CTE = {
      id: 'c4', nome: 'Offerta Fisso Luce NR', fornitore_nome: 'Test Fornitore',
      tipo_fornitura: 'luce', tipo_prezzo: 'fisso',
      prezzo_energia_luce: 0.1350,
      quota_fissa_luce: 9.90,
    }
    const r = calcolaConfrontoOfferte(cliente, [cte], PL_NON_RESIDENTE, null, PM)
    expect(key(r[0])).toMatchInlineSnapshot(`
      {
        "costo_annuo_totale": 862.49,
        "risparmio_annuo": 37.51,
        "risparmio_percentuale": 4.2,
      }
    `)
  })

  it('caso 5 — luce only, business (IVA 22%, accise ridotte)', () => {
    // consumo 10 000 kWh, spesa attuale 3000 €
    // CTE indicizzata: PUN + 0.010 €/kWh spread + 20 €/mese quota
    const cliente: DatiCliente = {
      tipo_fornitura: 'luce',
      tipo_cliente:   'business',
      consumo_annuo_kwh: 10000,
      spesa_annua_luce:  3000,
    }
    const cte: CTE = {
      id: 'c5', nome: 'Offerta Index Business', fornitore_nome: 'Test Fornitore',
      tipo_fornitura: 'luce', tipo_prezzo: 'indicizzato',
      spread_luce: 0.010,
      quota_fissa_luce: 20.00,
    }
    const r = calcolaConfrontoOfferte(cliente, [cte], PL_BUSINESS, null, PM)
    expect(key(r[0])).toMatchInlineSnapshot(`
      {
        "costo_annuo_totale": 2784.92,
        "risparmio_annuo": 215.08,
        "risparmio_percentuale": 7.2,
      }
    `)
  })

})
