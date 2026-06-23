// ─────────────────────────────────────────────────────────────────────────────
// GOLDEN — calcolaConfrontoOfferte (Motore A "contendibile", A1.7.1)
//
// I numeri sono il contratto FROZEN del motore. Se un refactor li cambia, il
// test fallisce: è intenzionale. NON aggiornare con `-u`: i valori attesi sono
// stati ricalcolati a mano dalle formule del motore e verificati. Se cambi una
// formula, ricalcola a mano il nuovo atteso, non rigenerare alla cieca.
//
// NB: A calcola solo la PARTE CONTENDIBILE (netto IVA/accise/trasporto/oneri).
// Nell'output costo_trasporto/costo_oneri/costo_accise/iva sono sempre 0:
// IVA e accise le applicano le VISTE via switch, non questo motore. Per questo
// "residente vs business" o "accise alte" NON cambiano i 3 campi pinnati qui;
// i casi coprono invece i rami reali del motore (fisso/indicizzato, dual, sort).
// ─────────────────────────────────────────────────────────────────────────────

import { describe, it, expect } from 'vitest'
import {
  calcolaConfrontoOfferte,
  type DatiCliente,
  type CTE,
  type ParametriRegolati,
  type PrezzoMercato,
} from './calcoloOfferte'

// ── Parametri ARERA / mercato (coerenti col seed II trim 2026) ───────────────
// Solo perdite_rete (luce indicizzato) e pun/psv (mercato) entrano nei numeri.
// accise/iva sono richiesti dal tipo ma NON influenzano l'output contendibile.
const PL: ParametriRegolati = { perdite_rete: 1.10, accise: 0.0227, iva: 0.10 }
const PG: ParametriRegolati = { trasporto: 0.1850, oneri: 0.0120, accise: 0, iva: 0.10 }
const PM: PrezzoMercato = { pun_medio: 0.115, psv_medio: 0.420 }

// ── Helper: i 3 campi del contratto frozen ───────────────────────────────────
function key(r: ReturnType<typeof calcolaConfrontoOfferte>[number]) {
  return {
    costo_annuo_totale: r.costo_annuo_totale,
    risparmio_annuo: r.risparmio_annuo,
    risparmio_percentuale: r.risparmio_percentuale,
  }
}

// ─────────────────────────────────────────────────────────────────────────────

describe('calcolaConfrontoOfferte — golden (Motore A contendibile)', () => {

  // Ramo: luce FISSO. spesa=0.145*2700+10*12=511.5 · offerta=0.135*2700+9.9*12=483.3
  it('caso 1 — luce only, fisso, domestico residente', () => {
    const cliente: DatiCliente = {
      tipo_fornitura: 'luce', tipo_cliente: 'domestico_residente',
      consumo_annuo_kwh: 2700, prezzo_materia_luce: 0.1450, quota_fissa_luce_mese: 10.00,
    }
    const cte: CTE = {
      id: 'cte1', nome: 'Fisso Luce', fornitore_nome: 'Test',
      tipo_fornitura: 'luce', tipo_prezzo: 'fisso',
      prezzo_energia_luce: 0.1350, quota_fissa_luce: 9.90,
    }
    const r = calcolaConfrontoOfferte(cliente, [cte], PL, null, PM)
    expect(r).toHaveLength(1)
    expect(key(r[0])).toEqual({
      costo_annuo_totale: 483.3,
      risparmio_annuo: 28.2,
      risparmio_percentuale: 5.5,
    })
  })

  // Ramo: gas INDICIZZATO. prezzo=psv0.42+ccr0.02+spread0.05=0.49
  // spesa=0.52*600+8*12=408 · offerta=0.49*600+7.5*12=384
  it('caso 2 — gas only, indicizzato PSV, domestico residente', () => {
    const cliente: DatiCliente = {
      tipo_fornitura: 'gas', tipo_cliente: 'domestico_residente',
      consumo_annuo_smc: 600, prezzo_materia_gas: 0.520, quota_fissa_gas_mese: 8.00,
    }
    const cte: CTE = {
      id: 'cte2', nome: 'Gas Index', fornitore_nome: 'Test',
      tipo_fornitura: 'gas', tipo_prezzo: 'indicizzato',
      spread_gas: 0.050, quota_fissa_gas: 7.50,
    }
    const r = calcolaConfrontoOfferte(cliente, [cte], null, PG, PM)
    expect(r).toHaveLength(1)
    expect(key(r[0])).toEqual({
      costo_annuo_totale: 384,
      risparmio_annuo: 24,
      risparmio_percentuale: 5.9,
    })
  })

  // Ramo: DUAL fisso (luce+gas sommati in un risultato).
  // luce: spesa511.5/off483.3 · gas: spesa408/off(0.48*600+7.5*12=378) → tot off 861.3
  it('caso 3 — dual (luce + gas) fissi, domestico residente', () => {
    const cliente: DatiCliente = {
      tipo_fornitura: 'dual', tipo_cliente: 'domestico_residente',
      consumo_annuo_kwh: 2700, prezzo_materia_luce: 0.1450, quota_fissa_luce_mese: 10.00,
      consumo_annuo_smc: 600, prezzo_materia_gas: 0.520, quota_fissa_gas_mese: 8.00,
    }
    const cte: CTE = {
      id: 'cte3', nome: 'Dual Fisso', fornitore_nome: 'Test',
      tipo_fornitura: 'dual', tipo_prezzo: 'fisso',
      prezzo_energia_luce: 0.1350, quota_fissa_luce: 9.90,
      prezzo_energia_gas: 0.480, quota_fissa_gas: 7.50,
    }
    const r = calcolaConfrontoOfferte(cliente, [cte], PL, PG, PM)
    expect(r).toHaveLength(1)
    expect(key(r[0])).toEqual({
      costo_annuo_totale: 861.3,
      risparmio_annuo: 58.2,
      risparmio_percentuale: 6.3,
    })
  })

  // Ramo: luce INDICIZZATO → pun0.115 × perdite1.10 + spread0.015 = 0.1415
  // spesa=0.16*3500+12*12=704 · offerta=0.1415*3500+8*12=591.25
  // (questo è l'unico caso che esercita il moltiplicatore perdite_rete)
  it('caso 4 — luce only, indicizzato PUN, domestico residente', () => {
    const cliente: DatiCliente = {
      tipo_fornitura: 'luce', tipo_cliente: 'domestico_residente',
      consumo_annuo_kwh: 3500, prezzo_materia_luce: 0.1600, quota_fissa_luce_mese: 12.00,
    }
    const cte: CTE = {
      id: 'cte4', nome: 'Luce Index', fornitore_nome: 'Test',
      tipo_fornitura: 'luce', tipo_prezzo: 'indicizzato',
      spread_luce: 0.0150, quota_fissa_luce: 8.00,
    }
    const r = calcolaConfrontoOfferte(cliente, [cte], PL, null, PM)
    expect(r).toHaveLength(1)
    expect(key(r[0])).toEqual({
      costo_annuo_totale: 591.25,
      risparmio_annuo: 112.75,
      risparmio_percentuale: 16.0,
    })
  })

  // Ordinamento: due offerte → la più conveniente (risparmio maggiore) prima.
  it('caso 5 — multi-CTE ordinate per risparmio_annuo desc', () => {
    const cliente: DatiCliente = {
      tipo_fornitura: 'luce', tipo_cliente: 'domestico_residente',
      consumo_annuo_kwh: 2700, prezzo_materia_luce: 0.1450, quota_fissa_luce_mese: 10.00,
    }
    const cara: CTE = {
      id: 'cara', nome: 'Cara', fornitore_nome: 'Test',
      tipo_fornitura: 'luce', tipo_prezzo: 'fisso',
      prezzo_energia_luce: 0.1400, quota_fissa_luce: 11.00,
    }
    const conveniente: CTE = {
      id: 'conveniente', nome: 'Conveniente', fornitore_nome: 'Test',
      tipo_fornitura: 'luce', tipo_prezzo: 'fisso',
      prezzo_energia_luce: 0.1300, quota_fissa_luce: 8.00,
    }
    const r = calcolaConfrontoOfferte(cliente, [cara, conveniente], PL, null, PM)
    expect(r).toHaveLength(2)
    expect(r[0].cte_id).toBe('conveniente')
    expect(key(r[0])).toEqual({
      costo_annuo_totale: 447,
      risparmio_annuo: 64.5,
      risparmio_percentuale: 12.6,
    })
    expect(r[1].cte_id).toBe('cara')
    expect(key(r[1])).toEqual({
      costo_annuo_totale: 510,
      risparmio_annuo: 1.5,
      risparmio_percentuale: 0.3,
    })
  })

  // Gate del contendibile: senza prezzo_materia_luce del cliente non si può
  // calcolare il risparmio → l'offerta è scartata. Questo è il guard del bug
  // che aveva mandato in rosso il vecchio golden (passava spesa_annua_luce).
  it('caso 6 — gate: cliente senza prezzo_materia_luce → offerta scartata', () => {
    const cliente: DatiCliente = {
      tipo_fornitura: 'luce', tipo_cliente: 'domestico_residente',
      consumo_annuo_kwh: 2700, // niente prezzo_materia_luce
    }
    const cte: CTE = {
      id: 'cte6', nome: 'X', fornitore_nome: 'Test',
      tipo_fornitura: 'luce', tipo_prezzo: 'fisso',
      prezzo_energia_luce: 0.1350, quota_fissa_luce: 9.90,
    }
    const r = calcolaConfrontoOfferte(cliente, [cte], PL, null, PM)
    expect(r).toHaveLength(0)
  })
})
