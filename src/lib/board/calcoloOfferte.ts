// ============================================================================
// calcoloOfferte.ts — Motore di calcolo confronto offerte energia
//
// REGOLA: puro TypeScript, zero dipendenze React, zero import Supabase.
// I dati (CTE, parametri regolati, zone) arrivano come argomenti.
// ============================================================================

// ---------------------------------------------------------------------------
// 1. TIPI
// ---------------------------------------------------------------------------

export type TipoFornitura = 'luce' | 'gas' | 'dual'
export type TipoCliente = 'domestico_residente' | 'domestico_non_residente' | 'business'
export type TipoTariffa = 'monoraria' | 'bioraria' | 'trioraria'
export type UsoGas = 'riscaldamento' | 'cottura_acs' | 'entrambi'

export interface DatiCliente {
  tipo_fornitura: TipoFornitura
  tipo_cliente: TipoCliente

  // --- LUCE ---
  consumo_annuo_kwh?: number          // totale
  fascia_f1_kwh?: number              // se bioraria/trioraria
  fascia_f2_kwh?: number
  fascia_f3_kwh?: number              // trioraria: separata; bioraria: F2+F3 insieme
  tipo_tariffa?: TipoTariffa
  potenza_impegnata_kw?: number       // default 3.0
  tensione?: 'BT' | 'MT'             // solo business
  zona_arera?: string                 // NORD | CNOR | CSUD | SUD | SICI | SARD
  prezzo_materia_luce?: number        // €/kWh — offerta attuale del cliente
  quota_fissa_luce_mese?: number      // €/mese — quota fissa offerta attuale
  segmento_cliente?: 'residenziale' | 'business'
  residente?: boolean

  // --- GAS ---
  consumo_annuo_smc?: number
  uso_gas?: UsoGas
  ambito_gas?: string                 // NORD_OVEST | NORD_EST | CENTRALE | etc.
  prezzo_materia_gas?: number         // €/Smc — offerta attuale del cliente
  quota_fissa_gas_mese?: number       // €/mese — quota fissa offerta attuale

  // --- CONDIZIONI ---
  rid_attivo?: boolean                // domiciliazione bancaria
  fattura_elettronica?: boolean
}

export interface CTE {
  id: string
  nome: string
  fornitore_nome: string
  fornitore_colore?: string
  tipo_fornitura: TipoFornitura
  tipo_prezzo: 'fisso' | 'variabile' | 'indicizzato'

  // pricing luce
  prezzo_energia_luce?: number        // €/kWh (offerte fisse: prezzo monorario o per fascia)
  prezzo_f1?: number                  // €/kWh fascia F1 (se l'offerta è multioraria)
  prezzo_f2?: number                  // €/kWh fascia F2
  prezzo_f3?: number                  // €/kWh fascia F3
  spread_luce?: number                // €/kWh sopra PUN (variabili/indicizzate)
  quota_fissa_luce?: number           // €/mese

  // pricing gas
  prezzo_energia_gas?: number         // €/Smc (offerte fisse)
  spread_gas?: number                 // €/Smc sopra PSV (variabili)
  quota_fissa_gas?: number            // €/mese

  sconto_rid?: number                 // €/anno di sconto se RID attivo
  sconto_fattura_elettronica?: number // €/anno se fattura elettronica
  durata_blocco_mesi?: number

  // vendibilità (solo per agente)
  provvigione?: number
  provvigione_tipo?: 'fisso' | 'percentuale'
  mesi_storno_rischio?: number
  priorita?: number
}

export interface ParametriRegolati {
  // luce (schema componenti_regolate_luce) — opzionali per compatibilità oggetti gas-only
  sigma1_mese?: number              // €/mese quota fissa rete
  sigma2_kw_mese?: number           // €/kW/mese quota potenza
  sigma3_uc3_kwh?: number           // €/kWh quota variabile rete + UC3
  oneri_luce_fisso_mese?: number    // €/mese
  oneri_luce_var_kwh?: number       // €/kWh
  oneri_asos_fisso_nonres?: number  // €/anno solo non-residenti
  accise_luce_dom?: number          // €/kWh domestico
  accise_luce_bus?: number          // €/kWh business
  soglia_esenzione_kwh_mese?: number
  iva_dom?: number                  // 0.10
  iva_bus?: number                  // 0.22
  perdite_rete?: number             // moltiplicatore 1.10
  cdispd_anno?: number              // €/anno
  canone_rai_anno?: number          // €/anno
  // gas
  trasporto?: number                // €/Smc
  oneri?: number                    // €/Smc
  // comuni (retrocompat gas)
  accise: number                    // €/Smc per gas; non usato per luce nel nuovo motore
  iva: number                       // 0.10 per gas
}

export interface PrezzoMercato {
  pun_medio: number                   // €/kWh (media ultimi 30 gg)
  psv_medio: number                   // €/Smc
}

// ---------------------------------------------------------------------------
// 2. RISULTATO
// ---------------------------------------------------------------------------

export interface RisultatoOfferta {
  cte_id: string
  nome: string
  fornitore_nome: string
  fornitore_colore?: string
  tipo_prezzo: string
  durata_blocco_mesi?: number

  // breakdown costo annuo stimato
  costo_materia_energia: number       // prezzo fornitore × consumo
  costo_trasporto: number             // trasporto + gestione contatore (ARERA)
  costo_oneri: number                 // oneri di sistema (ARERA)
  costo_accise: number                // accise (stato)
  imponibile: number                  // somma dei 4 sopra
  iva: number                         // imponibile × aliquota IVA
  quota_fissa_annua: number           // quota_fissa_mese × 12
  sconti: number                      // RID + fattura elettronica
  costo_annuo_totale: number          // imponibile + iva + quota_fissa - sconti

  // confronto
  risparmio_annuo: number             // spesa_attuale - costo_annuo_totale
  risparmio_percentuale: number       // risparmio / spesa_attuale × 100

  // agente
  provvigione?: number
  provvigione_tipo?: string
  mesi_storno_rischio?: number
  priorita?: number
}

// ---------------------------------------------------------------------------
// 3. FUNZIONE PRINCIPALE
// ---------------------------------------------------------------------------

/**
 * Calcola il costo annuo stimato per ogni CTE e lo confronta con la spesa attuale.
 *
 * FORMULA PER LUCE (offerta fissa monoraria):
 *   materia_energia = prezzo_energia_luce × consumo_annuo_kwh
 *   trasporto       = parametri.trasporto_gestione × consumo_annuo_kwh
 *   oneri           = parametri.oneri_sistema × consumo_annuo_kwh
 *   accise          = parametri.accise × consumo_annuo_kwh
 *   imponibile      = materia_energia + trasporto + oneri + accise
 *   iva             = imponibile × parametri.iva
 *   quota_fissa     = cte.quota_fissa_luce × 12
 *   sconti          = (rid ? cte.sconto_rid : 0) + (fatt_el ? cte.sconto_fattura_el : 0)
 *   TOTALE          = imponibile + iva + quota_fissa - sconti
 *
 * FORMULA PER LUCE (offerta fissa multioraria):
 *   materia_energia = (prezzo_f1 × f1_kwh) + (prezzo_f2 × f2_kwh) + (prezzo_f3 × f3_kwh)
 *   ... resto uguale
 *
 * FORMULA PER LUCE (offerta variabile/indicizzata):
 *   materia_energia = (pun_medio + spread_luce) × consumo_annuo_kwh
 *   ... resto uguale
 *
 * FORMULA PER GAS:
 *   materia_energia = prezzo_energia_gas × consumo_annuo_smc
 *   (oppure variabile: (psv_medio + spread_gas) × consumo_annuo_smc)
 *   trasporto       = parametri_gas.trasporto × consumo_annuo_smc
 *   oneri           = parametri_gas.oneri × consumo_annuo_smc
 *   accise          = calcolaAcciseGas(consumo_annuo_smc, uso_gas, tipo_cliente)
 *   imponibile      = materia_energia + trasporto + oneri + accise
 *   iva             = imponibile × parametri_gas.iva
 *   quota_fissa     = cte.quota_fissa_gas × 12
 *   TOTALE          = imponibile + iva + quota_fissa - sconti
 */
export function calcolaConfrontoOfferte(
  cliente: DatiCliente,
  cteList: CTE[],
  parametriLuce: ParametriRegolati | null,
  parametriGas: ParametriRegolati | null,
  prezziMercato: PrezzoMercato
): RisultatoOfferta[] {

  const risultati: RisultatoOfferta[] = []
  const spesaAttuale =
    ((cliente.prezzo_materia_luce ?? 0) * (cliente.consumo_annuo_kwh ?? 0) + (cliente.quota_fissa_luce_mese ?? 0) * 12) +
    ((cliente.prezzo_materia_gas  ?? 0) * (cliente.consumo_annuo_smc  ?? 0) + (cliente.quota_fissa_gas_mese  ?? 0) * 12)

  for (const cte of cteList) {
    let costoLuce = 0
    let costoGas = 0

    // --- LUCE ---
    if (
      (cte.tipo_fornitura === 'luce' || cte.tipo_fornitura === 'dual') &&
      cliente.consumo_annuo_kwh &&
      parametriLuce
    ) {
      costoLuce = calcolaCostoLuce(cliente, cte, parametriLuce, prezziMercato)
    }

    // --- GAS ---
    if (
      (cte.tipo_fornitura === 'gas' || cte.tipo_fornitura === 'dual') &&
      cliente.consumo_annuo_smc &&
      parametriGas
    ) {
      costoGas = calcolaCostoGas(cliente, cte, parametriGas, prezziMercato)
    }

    const costoTotale = costoLuce + costoGas
    const risparmio = spesaAttuale - costoTotale

    risultati.push({
      cte_id: cte.id,
      nome: cte.nome,
      fornitore_nome: cte.fornitore_nome,
      fornitore_colore: cte.fornitore_colore,
      tipo_prezzo: cte.tipo_prezzo,
      durata_blocco_mesi: cte.durata_blocco_mesi,

      costo_materia_energia: 0,
      costo_trasporto: 0,
      costo_oneri: 0,
      costo_accise: 0,
      imponibile: 0,
      iva: 0,
      quota_fissa_annua: 0,
      sconti: 0,
      costo_annuo_totale: round2(costoTotale),

      risparmio_annuo: round2(risparmio),
      risparmio_percentuale: spesaAttuale > 0
        ? round1((risparmio / spesaAttuale) * 100)
        : 0,

      provvigione: cte.provvigione,
      provvigione_tipo: cte.provvigione_tipo,
      mesi_storno_rischio: cte.mesi_storno_rischio,
      priorita: cte.priorita,
    })
  }

  risultati.sort((a, b) => b.risparmio_annuo - a.risparmio_annuo)
  return risultati
}

// ---------------------------------------------------------------------------
// 4. FUNZIONI DI CALCOLO COMPONENTI
// ---------------------------------------------------------------------------

function calcolaCostoLuce(
  cliente: DatiCliente,
  cte: CTE,
  parametri: ParametriRegolati,
  prezzi: PrezzoMercato
): number {
  const {
    sigma1_mese, sigma2_kw_mese, sigma3_uc3_kwh,
    oneri_luce_fisso_mese, oneri_luce_var_kwh, oneri_asos_fisso_nonres,
    accise_luce_dom, accise_luce_bus, soglia_esenzione_kwh_mese,
    iva_dom, iva_bus, perdite_rete, cdispd_anno, canone_rai_anno,
  } = parametri

  if (
    sigma1_mese == null || sigma2_kw_mese == null || sigma3_uc3_kwh == null ||
    oneri_luce_fisso_mese == null || oneri_luce_var_kwh == null ||
    accise_luce_dom == null || accise_luce_bus == null || soglia_esenzione_kwh_mese == null ||
    iva_dom == null || iva_bus == null || perdite_rete == null ||
    cdispd_anno == null || canone_rai_anno == null
  ) {
    throw new Error('calcolaCostoLuce: parametri luce incompleti — usare ParametriRegolati da componenti_regolate_luce')
  }

  const consumo = cliente.consumo_annuo_kwh!
  const isBusiness = cliente.tipo_cliente === 'business' || cliente.segmento_cliente === 'business'
  const isResidente = cliente.residente !== undefined
    ? cliente.residente
    : cliente.tipo_cliente === 'domestico_residente'
  const potenza = cliente.potenza_impegnata_kw ?? 3.0

  // Materia energia — perdite_rete solo per indicizzato/variabile (PUN al netto perdite)
  let materiaEnergia: number
  if (cte.tipo_prezzo === 'fisso') {
    if (cliente.tipo_tariffa !== 'monoraria' && cte.prezzo_f1 != null && cte.prezzo_f2 != null) {
      const f1 = cliente.fascia_f1_kwh ?? consumo * 0.33
      const f2 = cliente.fascia_f2_kwh ?? consumo * 0.33
      const f3 = cliente.fascia_f3_kwh ?? consumo * 0.34
      materiaEnergia = cte.prezzo_f1 * f1 + cte.prezzo_f2 * f2 + (cte.prezzo_f3 ?? cte.prezzo_f2) * f3
    } else {
      materiaEnergia = (cte.prezzo_energia_luce ?? 0) * consumo
    }
  } else {
    materiaEnergia = (prezzi.pun_medio + (cte.spread_luce ?? 0)) * consumo * perdite_rete
  }

  // Rete ARERA (σ)
  const quotaFissaRete = sigma1_mese * 12
  const quotaPotenza = sigma2_kw_mese * potenza * 12
  const quotaVarRete = sigma3_uc3_kwh * consumo

  // Oneri di sistema
  const oneriFissi = oneri_luce_fisso_mese * 12
  const oneriVar = oneri_luce_var_kwh * consumo
  const oneriAsos = (!isResidente && !isBusiness && oneri_asos_fisso_nonres != null)
    ? oneri_asos_fisso_nonres
    : 0

  // Accise (domestico residente: soglia esenzione; business/non-res: tutto tassabile)
  const acciseAliquota = isBusiness ? accise_luce_bus : accise_luce_dom
  const sogliaAnnua = soglia_esenzione_kwh_mese * 12
  const kwhTassabili = (isResidente && !isBusiness) ? Math.max(0, consumo - sogliaAnnua) : consumo
  const accise = acciseAliquota * kwhTassabili

  // Imponibile + IVA
  const imponibile = materiaEnergia + quotaFissaRete + quotaPotenza + quotaVarRete
    + oneriFissi + oneriVar + oneriAsos + accise
  const ivaAliquota = isBusiness ? iva_bus : iva_dom
  const iva = imponibile * ivaAliquota

  // Fissi annui
  const cdispd = cdispd_anno
  const rai = (isResidente && !isBusiness) ? canone_rai_anno : 0

  // Quota CTE fornitore + sconti
  const quotaFissa = (cte.quota_fissa_luce ?? 0) * 12
  const sconti = calcolaSconti(cliente, cte)

  return imponibile + iva + quotaFissa + cdispd + rai - sconti
}

function calcolaCostoGas(
  cliente: DatiCliente,
  cte: CTE,
  parametri: ParametriRegolati,
  prezzi: PrezzoMercato
): number {
  const consumo = cliente.consumo_annuo_smc!
  let materiaEnergia: number

  if (cte.tipo_prezzo === 'fisso') {
    materiaEnergia = (cte.prezzo_energia_gas ?? 0) * consumo
  } else {
    materiaEnergia = (prezzi.psv_medio + (cte.spread_gas ?? 0)) * consumo
  }

  const trasporto = (parametri.trasporto ?? 0) * consumo
  const oneri = (parametri.oneri ?? 0) * consumo
  const accise = calcolaAcciseGas(consumo, cliente.uso_gas, cliente.tipo_cliente)
  const imponibile = materiaEnergia + trasporto + oneri + accise
  const iva = imponibile * parametri.iva
  const quotaFissa = (cte.quota_fissa_gas ?? 0) * 12
  const sconti = calcolaSconti(cliente, cte)

  return imponibile + iva + quotaFissa - sconti
}

// ---------------------------------------------------------------------------
// 5. ACCISE GAS (scaglioni)
// ---------------------------------------------------------------------------

function calcolaAcciseGas(
  consumoSmc: number,
  usoGas?: UsoGas,
  tipoCliente?: TipoCliente
): number {
  if (tipoCliente === 'business') {
    return consumoSmc * 0.0124
  }

  if (usoGas === 'riscaldamento' || usoGas === 'entrambi' || !usoGas) {
    return calcolaPerScaglioni(consumoSmc, [
      { fino: 120,      aliquota: 0.0440 },
      { fino: 480,      aliquota: 0.1750 },
      { fino: 1560,     aliquota: 0.1700 },
      { fino: Infinity, aliquota: 0.1860 },
    ])
  }

  // cottura_acs
  return calcolaPerScaglioni(consumoSmc, [
    { fino: 480,      aliquota: 0.0440 },
    { fino: Infinity, aliquota: 0.0854 },
  ])
}

function calcolaPerScaglioni(
  consumo: number,
  scaglioni: { fino: number; aliquota: number }[]
): number {
  let totale = 0
  let consumoResiduo = consumo
  let sogliaPrecedente = 0

  for (const s of scaglioni) {
    const capienza = s.fino - sogliaPrecedente
    const consumoInScaglione = Math.min(consumoResiduo, capienza)
    totale += consumoInScaglione * s.aliquota
    consumoResiduo -= consumoInScaglione
    sogliaPrecedente = s.fino
    if (consumoResiduo <= 0) break
  }

  return totale
}

// ---------------------------------------------------------------------------
// 6. SCONTI
// ---------------------------------------------------------------------------

function calcolaSconti(cliente: DatiCliente, cte: CTE): number {
  let sconti = 0
  if (cliente.rid_attivo && cte.sconto_rid) sconti += cte.sconto_rid
  if (cliente.fattura_elettronica && cte.sconto_fattura_elettronica) sconti += cte.sconto_fattura_elettronica
  return sconti
}

// ---------------------------------------------------------------------------
// 7. UTILITY
// ---------------------------------------------------------------------------

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

function round1(n: number): number {
  return Math.round(n * 10) / 10
}

// ---------------------------------------------------------------------------
// 8. DEFAULT per campi opzionali
// ---------------------------------------------------------------------------

export function stimaFasce(
  consumoTotale: number,
  tipoCliente: TipoCliente
): { f1: number; f2: number; f3: number } {
  const split =
    tipoCliente === 'business'
      ? { f1: 0.50, f2: 0.30, f3: 0.20 }
      : tipoCliente === 'domestico_non_residente'
        ? { f1: 0.40, f2: 0.35, f3: 0.25 }
        : { f1: 0.33, f2: 0.33, f3: 0.34 }

  return {
    f1: Math.round(consumoTotale * split.f1),
    f2: Math.round(consumoTotale * split.f2),
    f3: Math.round(consumoTotale * split.f3),
  }
}

export function stimaClasseConsumoGas(consumoSmc: number): string {
  if (consumoSmc <= 120) return 'C1'
  if (consumoSmc <= 480) return 'C2'
  if (consumoSmc <= 1560) return 'C3'
  if (consumoSmc <= 5000) return 'C4'
  return 'C5'
}
