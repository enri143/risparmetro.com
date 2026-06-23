import { describe, it, expect } from 'vitest'
import { buildPatch, mergeExtracted, buildClientePatch, type Extracted } from './ocrBolletta'
import type { DatiCliente } from './types'

const datiDefault: DatiCliente = {
  segmento: 'family',
  potenzaKw: 3.0,
  residente: true,
  canoneRai: false,
  consumoLuce: 0,
  prezzoLuce: 0,
  fissoLuceMese: 0,
  consumoGas: 0,
  prezzoGas: 0,
  fissoGasMese: 0,
}

// ── buildPatch ────────────────────────────────────────────────────────────────

describe('buildPatch', () => {
  it('luce monorario: consumo/prezzo/fisso mappati, usaFasce=false', () => {
    const ex: Extracted = {
      tipo: 'luce',
      luce: {
        consumo_annuo_kwh: 2700,
        prezzo_materia_kwh: 0.15,
        fisso_mese_eur: 12,
        tipo_contatore: 'monorario',
      },
    }
    const p = buildPatch(ex, datiDefault)
    expect(p.consumoLuce).toBe(2700)
    expect(p.prezzoLuce).toBe(0.15)
    expect(p.fissoLuceMese).toBe(12)
    expect(p.usaFasce).toBe(false)
  })

  it('dual: luce + gas entrambi mappati nel patch', () => {
    const ex: Extracted = {
      tipo: 'dual',
      luce: { consumo_annuo_kwh: 2700, prezzo_materia_kwh: 0.15, fisso_mese_eur: 12 },
      gas: { consumo_annuo_smc: 600, prezzo_materia_smc: 0.52, fisso_mese_eur: 8 },
    }
    const p = buildPatch(ex, datiDefault)
    expect(p.consumoLuce).toBe(2700)
    expect(p.prezzoLuce).toBe(0.15)
    expect(p.consumoGas).toBe(600)
    expect(p.prezzoGas).toBe(0.52)
    expect(p.fissoGasMese).toBe(8)
  })

  it('fasce: percF1+F2+F3=100, prezzi mappati, usaFasce=true', () => {
    const ex: Extracted = {
      tipo: 'luce',
      luce: {
        tipo_contatore: 'fasce',
        consumo_annuo_kwh: 1000,
        consumi_fasce_annui: { f1_kwh: 300, f2_kwh: 400, f3_kwh: 300 },
        prezzi_fasce: { f1_eur_kwh: 0.15, f2_eur_kwh: 0.12, f3_eur_kwh: 0.09 },
      },
    }
    const p = buildPatch(ex, datiDefault)
    expect(p.usaFasce).toBe(true)
    expect(p.percF1).toBe(30)
    expect(p.percF2).toBe(40)
    expect(p.percF3).toBe(30)
    expect(p.percF1! + p.percF2! + p.percF3!).toBe(100)
    expect(p.prezzoF1).toBe(0.15)
    expect(p.prezzoF2).toBe(0.12)
    expect(p.prezzoF3).toBe(0.09)
  })

  it('segmento business propagato; residente false non azzerato da default true', () => {
    const ex: Extracted = { segmento: 'business', residente: false }
    const p = buildPatch(ex, datiDefault)
    expect(p.segmento).toBe('business')
    expect(p.residente).toBe(false)
  })
})

// ── mergeExtracted ────────────────────────────────────────────────────────────

describe('mergeExtracted', () => {
  it('un solo elemento: passthrough (referenza identica)', () => {
    const ex: Extracted = { tipo: 'luce', luce: { consumo_annuo_kwh: 1000 }, confidence: 0.9 }
    expect(mergeExtracted([ex])).toBe(ex)
  })

  it('luce-only + gas-only: tipo=dual, entrambi i blocchi presenti, fornitori uniti con " / "', () => {
    const luceEx: Extracted = {
      tipo: 'luce',
      fornitore_attuale: 'Enel',
      luce: { consumo_annuo_kwh: 2700 },
      confidence: 0.9,
    }
    const gasEx: Extracted = {
      tipo: 'gas',
      fornitore_attuale: 'Eni',
      gas: { consumo_annuo_smc: 600 },
      confidence: 0.8,
    }
    const m = mergeExtracted([luceEx, gasEx])
    expect(m.tipo).toBe('dual')
    expect(m.luce?.consumo_annuo_kwh).toBe(2700)
    expect(m.gas?.consumo_annuo_smc).toBe(600)
    expect(m.fornitore_attuale).toBe('Enel / Eni')
  })

  it('due luce con consumi diversi: tiene il blocco a consumo maggiore, confidence=min', () => {
    const alta: Extracted = { tipo: 'luce', luce: { consumo_annuo_kwh: 3000 }, confidence: 0.9 }
    const bassa: Extracted = { tipo: 'luce', luce: { consumo_annuo_kwh: 1500 }, confidence: 0.7 }
    const m = mergeExtracted([alta, bassa])
    expect(m.luce?.consumo_annuo_kwh).toBe(3000)
    expect(m.confidence).toBe(0.7)
  })
})

// ── buildClientePatch ─────────────────────────────────────────────────────────

describe('buildClientePatch', () => {
  it('family completo: tutti i campi anagrafica mappati, segmento=residenziale, no ragione_sociale', () => {
    const ex: Extracted = {
      segmento: 'family',
      fornitore_attuale: 'Enel',
      nome_offerta: 'Luce Flex',
      scadenza_offerta: '2026-12-31',
      anagrafica: {
        nome: 'Mario',
        cognome: 'Rossi',
        ragione_sociale: null,
        indirizzo: 'Via Roma 1',
        cap: '20100',
        comune: 'Milano',
        provincia: 'MI',
        pod: 'IT001E12345678',
        pdr: null,
      },
    }
    const p = buildClientePatch(ex)
    expect(p.nome).toBe('Mario')
    expect(p.cognome).toBe('Rossi')
    expect(p.indirizzo).toBe('Via Roma 1')
    expect(p.cap).toBe('20100')
    expect(p.comune).toBe('Milano')
    expect(p.provincia).toBe('MI')
    expect(p.pod).toBe('IT001E12345678')
    expect(p.fornitore_attuale).toBe('Enel')
    expect(p.offerta_attuale).toBe('Luce Flex')
    expect(p.scadenza_offerta).toBe('2026-12-31')
    expect(p.segmento).toBe('residenziale')
    expect('ragione_sociale' in p).toBe(false)
    expect('pdr' in p).toBe(false)
  })

  it('business: ragione_sociale + segmento=business, no nome/cognome', () => {
    const ex: Extracted = {
      segmento: 'business',
      anagrafica: { ragione_sociale: 'Acme Srl', nome: null, cognome: null },
    }
    const p = buildClientePatch(ex)
    expect(p.ragione_sociale).toBe('Acme Srl')
    expect(p.segmento).toBe('business')
    expect('nome' in p).toBe(false)
    expect('cognome' in p).toBe(false)
  })

  it('parziale (solo pod): ritorna esattamente { pod } — anti-wipe', () => {
    const ex: Extracted = { anagrafica: { pod: 'IT001E12345678' } }
    const p = buildClientePatch(ex)
    expect(p.pod).toBe('IT001E12345678')
    expect(Object.keys(p)).toEqual(['pod'])
  })
})

// ── enum-guard buildClientePatch ──────────────────────────────────────────────

describe('buildClientePatch — enum-guard segmento', () => {
  it('family → residenziale', () => {
    expect(buildClientePatch({ segmento: 'family' }).segmento).toBe('residenziale')
  })

  it('business → business', () => {
    expect(buildClientePatch({ segmento: 'business' }).segmento).toBe('business')
  })

  it('segmento assente → omesso (mai undefined nel DB)', () => {
    expect('segmento' in buildClientePatch({})).toBe(false)
  })

  it('valore fuori enum (cast) → omesso, mai scritto nel patch', () => {
    const p = buildClientePatch({ segmento: 'altro' as unknown as 'family' })
    expect('segmento' in p).toBe(false)
  })
})

// ── robustezza ────────────────────────────────────────────────────────────────

describe('buildPatch — robustezza', () => {
  const NUMERIC_FIELDS = [
    'consumoLuce', 'prezzoLuce', 'fissoLuceMese',
    'consumoGas', 'prezzoGas', 'fissoGasMese',
  ] as const

  it('estratto vuoto: tutti i campi numerici finiti e >= 0 (niente NaN/undefined al form)', () => {
    const p = buildPatch({}, datiDefault)
    for (const f of NUMERIC_FIELDS) {
      const v = p[f] as number
      expect(Number.isFinite(v), `${f} deve essere finito`).toBe(true)
      expect(v, `${f} deve essere >= 0`).toBeGreaterThanOrEqual(0)
    }
  })
})
