// ============================================================================
// calcoloOfferte.ts — Motore contendibile (A1.7b)
//
// Calcola solo la "parte contendibile" dell'offerta:
//   Luce fisso / attuale: prezzo_materia × consumo + quota_fissa × 12
//   Luce indicizzato:     (PUN + spread) × consumo × perdite_rete + quota_fissa × 12
//   Gas:                  prezzo_materia × consumo + quota_fissa × 12
//
// Tutti i numeri sono NETTO IVA. Le viste applicano IVA via switch.
// REGOLA: puro TypeScript, zero dipendenze React, zero import Supabase.
// ============================================================================

import type { Impostazioni } from './types';

// ---------------------------------------------------------------------------
// 1. TIPI (invariati — viste consumano questi)
// ---------------------------------------------------------------------------

export type TipoFornitura = 'luce' | 'gas' | 'dual'
export type TipoCliente = 'domestico_residente' | 'domestico_non_residente' | 'business'
export type TipoTariffa = 'monoraria' | 'bioraria' | 'trioraria'
export type UsoGas = 'riscaldamento' | 'cottura_acs' | 'entrambi'

export interface DatiCliente {
  tipo_fornitura: TipoFornitura
  tipo_cliente: TipoCliente

  // --- LUCE ---
  consumo_annuo_kwh?: number
  fascia_f1_kwh?: number
  fascia_f2_kwh?: number
  fascia_f3_kwh?: number
  tipo_tariffa?: TipoTariffa
  potenza_impegnata_kw?: number
  tensione?: 'BT' | 'MT'
  zona_arera?: string
  prezzo_materia_luce?: number        // €/kWh — offerta attuale del cliente
  quota_fissa_luce_mese?: number      // €/mese — quota fissa offerta attuale
  segmento_cliente?: 'residenziale' | 'business'
  residente?: boolean

  // --- GAS ---
  consumo_annuo_smc?: number
  uso_gas?: UsoGas
  ambito_gas?: string
  prezzo_materia_gas?: number         // €/Smc — offerta attuale del cliente
  quota_fissa_gas_mese?: number       // €/mese — quota fissa offerta attuale

  // --- CONDIZIONI ---
  rid_attivo?: boolean
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
  prezzo_energia_luce?: number
  prezzo_f1?: number
  prezzo_f2?: number
  prezzo_f3?: number
  spread_luce?: number
  quota_fissa_luce?: number           // €/mese

  // pricing gas
  prezzo_energia_gas?: number
  spread_gas?: number
  quota_fissa_gas?: number            // €/mese

  sconto_rid?: number
  sconto_fattura_elettronica?: number
  durata_blocco_mesi?: number

  // vendibilità (solo per agente)
  provvigione?: number
  provvigione_tipo?: 'fisso' | 'percentuale'
  mesi_storno_rischio?: number
  priorita?: number
}

export interface ParametriRegolati {
  // luce (componenti_regolate_luce)
  sigma1_mese?: number
  sigma2_kw_mese?: number
  sigma3_uc3_kwh?: number
  oneri_luce_fisso_mese?: number
  oneri_luce_var_kwh?: number
  oneri_asos_fisso_nonres?: number
  accise_luce_dom?: number
  accise_luce_bus?: number
  soglia_esenzione_kwh_mese?: number
  iva_dom?: number
  iva_bus?: number
  perdite_rete?: number
  cdispd_anno?: number
  canone_rai_anno?: number
  // gas
  trasporto?: number
  oneri?: number
  // comuni (retrocompat gas)
  accise: number
  iva: number
}

export interface PrezzoMercato {
  pun_medio: number
  psv_medio: number
}

// ---------------------------------------------------------------------------
// 2. RISULTATO (invariato — viste consumano questo)
// ---------------------------------------------------------------------------

export interface RisultatoOfferta {
  cte_id: string
  nome: string
  fornitore_nome: string
  fornitore_colore?: string
  tipo_prezzo: string
  durata_blocco_mesi?: number

  // breakdown costo annuo (parte contendibile)
  costo_materia_energia: number       // prezzo × consumo (× perdite per luce)
  costo_trasporto: number             // 0 — non contendibile
  costo_oneri: number                 // 0 — non contendibile
  costo_accise: number                // 0 — non contendibile
  imponibile: number                  // 0 — non usato in questo motore
  iva: number                         // 0 — applicata dalla vista via switch
  quota_fissa_annua: number           // quota_fissa_mese × 12
  sconti: number                      // 0 — non modellato in A1.7b
  costo_annuo_totale: number          // costo_materia_energia + quota_fissa_annua

  // confronto
  risparmio_annuo: number
  risparmio_percentuale: number

  // agente
  provvigione?: number
  provvigione_tipo?: string
  mesi_storno_rischio?: number
  priorita?: number
}

// ---------------------------------------------------------------------------
// 3. DEFAULTS Motore B (speculari a ImpostazioniTab.tsx)
// ---------------------------------------------------------------------------

const IMPOSTAZIONI_DEFAULTS: Impostazioni = {
  id: 0,
  pun_riferimento: 0.12,
  psv_riferimento: 0.41,
  ccr_gas: 0.02,
  perdite_rete: 1.10,
  sigma1_mese: 1.90,
  sigma2_kw_mese: 2.106,
  sigma3_uc3_kwh: 0.01057,
  oneri_luce_fisso_mese: 0.50,
  oneri_luce_var_kwh: 0.0350,
  accise_luce_dom: 0.0227,
  accise_luce_bus: 0.0125,
  soglia_esenzione_kwh_mese: 150,
  iva_dom: 0.10,
  iva_bus: 0.22,
  canone_rai_anno: 90,
  cdispd_anno: 1.23,
  gas_trasporto_fisso_mese: 4.75,
  gas_trasporto_var_smc: 0.042,
  gas_oneri_fisso_mese: 0.50,
  gas_oneri_var_smc: 0.040,
  gas_accise_1_smc: 0.044,
  gas_accise_2_smc: 0.175,
  gas_accise_soglia: 120,
  gas_add_regionale: 0.0155,
  gas_iva_soglia: 480,
};

// ---------------------------------------------------------------------------
// 4. mappaImpostazioni — estrae pun/psv/ccr/perdite dai parametri ARERA
// ---------------------------------------------------------------------------

function mappaImpostazioni(
  pl: ParametriRegolati | null,
  pg: ParametriRegolati | null,
  pm: PrezzoMercato,
): Impostazioni {
  const D = IMPOSTAZIONI_DEFAULTS;
  return {
    id: 0,
    pun_riferimento: pm.pun_medio,
    psv_riferimento: pm.psv_medio,
    ccr_gas: D.ccr_gas,
    perdite_rete:              pl?.perdite_rete              ?? D.perdite_rete,
    sigma1_mese:               pl?.sigma1_mese               ?? D.sigma1_mese,
    sigma2_kw_mese:            pl?.sigma2_kw_mese            ?? D.sigma2_kw_mese,
    sigma3_uc3_kwh:            pl?.sigma3_uc3_kwh            ?? D.sigma3_uc3_kwh,
    oneri_luce_fisso_mese:     pl?.oneri_luce_fisso_mese     ?? D.oneri_luce_fisso_mese,
    oneri_luce_var_kwh:        pl?.oneri_luce_var_kwh        ?? D.oneri_luce_var_kwh,
    oneri_asos_fisso_nonres:   pl?.oneri_asos_fisso_nonres,
    accise_luce_dom:           pl?.accise_luce_dom           ?? D.accise_luce_dom,
    accise_luce_bus:           pl?.accise_luce_bus           ?? D.accise_luce_bus,
    soglia_esenzione_kwh_mese: pl?.soglia_esenzione_kwh_mese ?? D.soglia_esenzione_kwh_mese,
    iva_dom:                   pl?.iva_dom                   ?? D.iva_dom,
    iva_bus:                   pl?.iva_bus                   ?? D.iva_bus,
    canone_rai_anno:           pl?.canone_rai_anno           ?? D.canone_rai_anno,
    cdispd_anno:               pl?.cdispd_anno               ?? D.cdispd_anno,
    gas_trasporto_fisso_mese: D.gas_trasporto_fisso_mese,
    gas_trasporto_var_smc:    pg?.trasporto ?? D.gas_trasporto_var_smc,
    gas_oneri_fisso_mese:     D.gas_oneri_fisso_mese,
    gas_oneri_var_smc:        pg?.oneri    ?? D.gas_oneri_var_smc,
    gas_accise_1_smc:         pg?.accise   ?? D.gas_accise_1_smc,
    gas_accise_2_smc:         D.gas_accise_2_smc,
    gas_accise_soglia:        D.gas_accise_soglia,
    gas_add_regionale:        D.gas_add_regionale,
    gas_iva_soglia:           D.gas_iva_soglia,
  };
}

// ---------------------------------------------------------------------------
// 5. PARTE CONTENDIBILE
//
// perdite_rete si applica SOLO alle offerte indicizzate (PUN/PSV sono prezzi
// all'ingrosso — serve il fattore perdite per arrivare al contatore).
// Prezzi fissi e prezzo attuale del cliente sono già prezzi al contatore → no perdite.
// ---------------------------------------------------------------------------

function costoContendibileLuce(
  prezzoMateria: number,
  consumoKwh: number,
  quotaFissaMese: number,
): number {
  return prezzoMateria * consumoKwh + quotaFissaMese * 12;
}

function costoContendibileGas(
  prezzoMateria: number,
  consumoSmc: number,
  quotaFissaMese: number,
): number {
  return prezzoMateria * consumoSmc + quotaFissaMese * 12;
}

// ---------------------------------------------------------------------------
// 6. FUNZIONE PRINCIPALE
// ---------------------------------------------------------------------------

export function calcolaConfrontoOfferte(
  cliente: DatiCliente,
  cteList: CTE[],
  parametriLuce: ParametriRegolati | null,
  parametriGas: ParametriRegolati | null,
  prezziMercato: PrezzoMercato,
): RisultatoOfferta[] {
  const imp = mappaImpostazioni(parametriLuce, parametriGas, prezziMercato);

  const risultati: RisultatoOfferta[] = [];

  for (const cte of cteList) {
    const hasLuce = cte.tipo_fornitura === 'luce' || cte.tipo_fornitura === 'dual';
    const hasGas  = cte.tipo_fornitura === 'gas'  || cte.tipo_fornitura === 'dual';

    const hasDatiLuce = hasLuce
      && (cliente.consumo_annuo_kwh ?? 0) > 0
      && (cliente.prezzo_materia_luce ?? 0) > 0;
    const hasDatiGas = hasGas
      && (cliente.consumo_annuo_smc ?? 0) > 0
      && (cliente.prezzo_materia_gas ?? 0) > 0;

    // ── Spesa attuale (parte contendibile) ──────────────────────────────────
    // prezzo_materia_luce è già un prezzo al contatore → no perdite_rete
    const spesaAttLuce = hasDatiLuce
      ? costoContendibileLuce(
          cliente.prezzo_materia_luce!,
          cliente.consumo_annuo_kwh!,
          cliente.quota_fissa_luce_mese ?? 0,
        )
      : 0;
    const spesaAttGas = hasDatiGas
      ? costoContendibileGas(
          cliente.prezzo_materia_gas!,
          cliente.consumo_annuo_smc!,
          cliente.quota_fissa_gas_mese ?? 0,
        )
      : 0;

    // ── Prezzo materia dell'offerta ─────────────────────────────────────────
    const isFisso = cte.tipo_prezzo === 'fisso';

    const prezzoLuce = isFisso
      ? (cte.prezzo_energia_luce ?? 0)
      : imp.pun_riferimento + (cte.spread_luce ?? 0);

    const prezzoGas = isFisso
      ? (cte.prezzo_energia_gas ?? 0)
      : imp.psv_riferimento + imp.ccr_gas + (cte.spread_gas ?? 0);

    // ── Costo offerta (parte contendibile) ──────────────────────────────────
    // Fisso → prezzo già al contatore. Indicizzato → PUN/PSV wholesale × perdite_rete
    const materiaLuce = hasDatiLuce
      ? isFisso
        ? prezzoLuce * cliente.consumo_annuo_kwh!
        : prezzoLuce * cliente.consumo_annuo_kwh! * imp.perdite_rete
      : 0;
    const quotaLuce = hasDatiLuce ? (cte.quota_fissa_luce ?? 0) * 12 : 0;
    const costoOffLuce = materiaLuce + quotaLuce;

    const materiaGas = hasDatiGas
      ? prezzoGas * cliente.consumo_annuo_smc!
      : 0;
    const quotaGas = hasDatiGas ? (cte.quota_fissa_gas ?? 0) * 12 : 0;
    const costoOffGas = materiaGas + quotaGas;

    const costoTotale = costoOffLuce + costoOffGas;
    const spesaTotale = spesaAttLuce + spesaAttGas;
    const risparmio   = spesaTotale - costoTotale;

    risultati.push({
      cte_id: cte.id,
      nome: cte.nome,
      fornitore_nome: cte.fornitore_nome,
      fornitore_colore: cte.fornitore_colore,
      tipo_prezzo: cte.tipo_prezzo,
      durata_blocco_mesi: cte.durata_blocco_mesi,

      costo_materia_energia: round2(materiaLuce + materiaGas),
      costo_trasporto:       0,
      costo_oneri:           0,
      costo_accise:          0,
      imponibile:            0,
      iva:                   0,
      quota_fissa_annua:     round2(quotaLuce + quotaGas),
      sconti:                0,
      costo_annuo_totale:    round2(costoTotale),

      risparmio_annuo:       round2(risparmio),
      risparmio_percentuale: spesaTotale > 0
        ? round1((risparmio / spesaTotale) * 100)
        : 0,

      provvigione:         cte.provvigione,
      provvigione_tipo:    cte.provvigione_tipo,
      mesi_storno_rischio: cte.mesi_storno_rischio,
      priorita:            cte.priorita,
    });
  }

  risultati.sort((a, b) => b.risparmio_annuo - a.risparmio_annuo);
  return risultati;
}

// ---------------------------------------------------------------------------
// 7. UTILITY
// ---------------------------------------------------------------------------

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

// ---------------------------------------------------------------------------
// 8. EXPORT PER VISTE (invariati)
// ---------------------------------------------------------------------------

export function stimaFasce(
  consumoTotale: number,
  tipoCliente: TipoCliente,
): { f1: number; f2: number; f3: number } {
  const split =
    tipoCliente === 'business'
      ? { f1: 0.50, f2: 0.30, f3: 0.20 }
      : tipoCliente === 'domestico_non_residente'
        ? { f1: 0.40, f2: 0.35, f3: 0.25 }
        : { f1: 0.33, f2: 0.33, f3: 0.34 };

  return {
    f1: Math.round(consumoTotale * split.f1),
    f2: Math.round(consumoTotale * split.f2),
    f3: Math.round(consumoTotale * split.f3),
  };
}

export function stimaClasseConsumoGas(consumoSmc: number): string {
  if (consumoSmc <= 120) return 'C1';
  if (consumoSmc <= 480) return 'C2';
  if (consumoSmc <= 1560) return 'C3';
  if (consumoSmc <= 5000) return 'C4';
  return 'C5';
}
