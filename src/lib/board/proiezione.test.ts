import { describe, it, expect } from 'vitest'
import { proiezione12Mesi } from './proiezione'

describe('proiezione12Mesi', () => {
  const result = proiezione12Mesi(1200, 960)

  it('length === 12', () => {
    expect(result).toHaveLength(12)
  })

  it('mese 1 — valori corretti', () => {
    expect(result[0]).toEqual({
      mese: 1,
      spesaAttualeMese: 100,
      spesaOffertaMese: 80,
      risparmioCumulato: 20,
    })
  })

  it('mese 6 — risparmioCumulato === 120', () => {
    expect(result[5].risparmioCumulato).toBe(120)
  })

  it('mese 12 — risparmioCumulato === 240 (spesaAnnua - costoOfferta)', () => {
    expect(result[11].risparmioCumulato).toBe(240)
  })
})
