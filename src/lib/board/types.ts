export type TipoEnergia = "luce" | "gas";
export type Segmento = "family" | "business";
export type TipoPrezzo = "fisso" | "index";
export type Indice = "PUN" | "PSV";

export type TipoPun = "monorario" | "fasce";

export interface CTE {
  id: string;
  nome: string;
  fornitore: string;
  tipo: TipoEnergia;
  segmento: Segmento;
  tipo_prezzo: TipoPrezzo;
  prezzo_fisso: number | null;
  indice: Indice | null;
  spread: number | null;
  commercializzazione_anno: number;
  cvv_variabile: number | null;
  dispacciamento_kwh?: number | null;
  penale_recesso: boolean;
  validita: string | null;
  note: string | null;
  attiva: boolean;
  tipo_pun?: TipoPun | null;
  energia_verde?: boolean | null;
  provvigione_una_tantum?: number | null;
  provvigione_ricorrente_per_1000?: number | null;
  codice_offerta?: string | null;
  created_at?: string;
  updated_at?: string;
}


export interface Impostazioni {
  id: number;
  pun_riferimento: number;
  pun_f1?: number;
  pun_f2?: number;
  pun_f3?: number;
  psv_riferimento: number;
  ccr_gas: number;
  // Futures previsioni mercato (3 mesi)
  pun_futures_1?: number | null;
  pun_futures_2?: number | null;
  pun_futures_3?: number | null;
  psv_futures_1?: number | null;
  psv_futures_2?: number | null;
  psv_futures_3?: number | null;
  futures_mese_1?: string | null;
  futures_mese_2?: string | null;
  futures_mese_3?: string | null;
  futures_updated_at?: string | null;
  perdite_rete: number;
  sigma1_mese: number;
  sigma2_kw_mese: number;
  sigma3_uc3_kwh: number;
  oneri_luce_fisso_mese: number;
  oneri_luce_var_kwh: number;
  accise_luce_dom: number;
  accise_luce_bus: number;
  soglia_esenzione_kwh_mese: number;
  iva_dom: number;
  iva_bus: number;
  canone_rai_anno: number;
  cdispd_anno: number;
  gas_trasporto_fisso_mese: number;
  gas_trasporto_var_smc: number;
  gas_oneri_fisso_mese: number;
  gas_oneri_var_smc: number;
  gas_accise_1_smc: number;
  gas_accise_2_smc: number;
  gas_accise_soglia: number;
  gas_add_regionale: number;
  gas_iva_soglia: number;
  oneri_asos_kwh?: number;
  oneri_arim_kwh?: number;
  oneri_uc3_kwh?: number;
  oneri_uc6_kwh?: number;
  oneri_uc6_kw_anno?: number;
  oneri_asos_fisso_nonres?: number;
  updated_at?: string;
}

export interface NoteCliente {
  nomeCliente: string;
  telefono: string;
  email?: string;
  note: string;
}

export interface DatiCliente {
  segmento: Segmento;
  potenzaKw: number;
  residente: boolean;
  canoneRai: boolean;
  // Luce
  consumoLuce: number;
  prezzoLuce: number;
  fissoLuceMese: number;
  // Fasce orarie luce
  usaFasce?: boolean;
  percF1?: number;
  percF2?: number;
  percF3?: number;
  prezzoF1?: number;
  prezzoF2?: number;
  prezzoF3?: number;
  // Gas
  consumoGas: number;
  prezzoGas: number;
  fissoGasMese: number;
}

export interface RisultatoOfferta {
  cte: CTE;
  costoOfferta: number;
  costoCliente: number;
  risparmio: number;
  risparmioPct: number;
  prezzoEffettivo: number;
  prezziPerFascia?: { f1: number; f2: number; f3: number };
}
