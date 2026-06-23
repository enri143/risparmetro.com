import { describe, it, expect } from 'vitest'

const motoreB = import.meta.glob('./calcoli.ts')

describe('invariante: Motore B eliminato', () => {
  it('calcoli.ts non esiste piu', () => {
    expect(Object.keys(motoreB)).toHaveLength(0)
  })
})
