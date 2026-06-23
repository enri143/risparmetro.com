import type { DatiCliente } from './types'

export interface Extracted {
  tipo?: 'luce' | 'gas' | 'dual'
  segmento?: 'family' | 'business'
  residente?: boolean | null
  canone_rai?: boolean | null
  fornitore_attuale?: string
  nome_offerta?: string | null
  luce?: {
    potenza_impegnata_kw?: number
    consumo_annuo_kwh?: number
    prezzo_materia_kwh?: number
    fisso_mese_eur?: number
    tipo_contatore?: 'monorario' | 'fasce'
    consumi_fasce_annui?: { f1_kwh: number; f2_kwh: number; f3_kwh: number } | null
    prezzi_fasce?: { f1_eur_kwh: number; f2_eur_kwh: number; f3_eur_kwh: number } | null
  } | null
  gas?: {
    consumo_annuo_smc?: number
    prezzo_materia_smc?: number
    fisso_mese_eur?: number
  } | null
  confidence?: number
  note?: string
}

/** Merge multiple extracted bills into one. Luce/gas blocks from different bills are combined. */
export function mergeExtracted(list: Extracted[]): Extracted {
  if (list.length === 1) return list[0]
  const merged: Extracted = {
    segmento: undefined,
    residente: null,
    canone_rai: null,
    fornitore_attuale: '',
    nome_offerta: null,
    luce: null,
    gas: null,
    confidence: 1,
    note: '',
  }
  const fornitori: string[] = []
  const notes: string[] = []
  let minConf = 1
  let hasLuce = false
  let hasGas = false
  for (const ex of list) {
    if (ex.luce && (!merged.luce || (ex.luce.consumo_annuo_kwh ?? 0) > (merged.luce.consumo_annuo_kwh ?? 0))) {
      merged.luce = ex.luce
      hasLuce = true
    } else if (ex.luce) {
      hasLuce = true
    }
    if (ex.gas && (!merged.gas || (ex.gas.consumo_annuo_smc ?? 0) > (merged.gas.consumo_annuo_smc ?? 0))) {
      merged.gas = ex.gas
      hasGas = true
    } else if (ex.gas) {
      hasGas = true
    }
    if (ex.segmento && !merged.segmento) merged.segmento = ex.segmento
    if (ex.residente != null && merged.residente == null) merged.residente = ex.residente
    if (ex.canone_rai != null && merged.canone_rai == null) merged.canone_rai = ex.canone_rai
    if (ex.fornitore_attuale && !fornitori.includes(ex.fornitore_attuale)) fornitori.push(ex.fornitore_attuale)
    if (ex.note) notes.push(ex.note)
    if ((ex.confidence ?? 1) < minConf) minConf = ex.confidence ?? 1
  }
  merged.fornitore_attuale = fornitori.join(' / ')
  merged.note = notes.join(' — ')
  merged.confidence = minConf
  merged.tipo = hasLuce && hasGas ? 'dual' : hasLuce ? 'luce' : 'gas'
  return merged
}

/** Build a DatiCliente patch from an OCR-extracted bill. `dati` provides fallback values. */
export function buildPatch(ex: Extracted, dati: DatiCliente): Partial<DatiCliente> {
  const luce = ex.luce ?? {}
  const gas = ex.gas ?? {}
  const cf = luce.consumi_fasce_annui
  const tot = cf ? cf.f1_kwh + cf.f2_kwh + cf.f3_kwh : 0
  const percF1 = cf && tot > 0 ? Math.round((cf.f1_kwh / tot) * 100) : undefined
  const percF2 = cf && tot > 0 ? Math.round((cf.f2_kwh / tot) * 100) : undefined
  const percF3 = cf && tot > 0 ? Math.round((cf.f3_kwh / tot) * 100) : undefined
  const pf = luce.prezzi_fasce
  return {
    segmento: ex.segmento ?? dati.segmento,
    potenzaKw: luce.potenza_impegnata_kw ?? dati.potenzaKw,
    residente: ex.residente ?? true,
    canoneRai: ex.canone_rai ?? false,
    consumoLuce: luce.consumo_annuo_kwh ?? 0,
    prezzoLuce: luce.prezzo_materia_kwh ?? 0,
    fissoLuceMese: luce.fisso_mese_eur ?? 0,
    usaFasce: luce.tipo_contatore === 'fasce',
    prezzoF1: pf?.f1_eur_kwh,
    prezzoF2: pf?.f2_eur_kwh,
    prezzoF3: pf?.f3_eur_kwh,
    percF1,
    percF2,
    percF3,
    consumoGas: gas.consumo_annuo_smc ?? 0,
    prezzoGas: gas.prezzo_materia_smc ?? 0,
    fissoGasMese: gas.fisso_mese_eur ?? 0,
  }
}
