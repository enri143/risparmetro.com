import type { CTE, DatiCliente, Impostazioni, RisultatoOfferta, SimulazioneBolletta } from "./types";

const DEF_PERC = { f1: 0.33, f2: 0.24, f3: 0.43 };

function getFasceConfig(d: DatiCliente) {
  return {
    usa: !!d.usaFasce,
    f1: (d.percF1 ?? DEF_PERC.f1 * 100) / 100,
    f2: (d.percF2 ?? DEF_PERC.f2 * 100) / 100,
    f3: (d.percF3 ?? DEF_PERC.f3 * 100) / 100,
  };
}

function punFasce(imp: Impostazioni) {
  return {
    f1: imp.pun_f1 ?? imp.pun_riferimento,
    f2: imp.pun_f2 ?? imp.pun_riferimento,
    f3: imp.pun_f3 ?? imp.pun_riferimento,
  };
}

export function prezzoUnitarioCTE(cte: CTE, imp: Impostazioni): number {
  if (cte.tipo_prezzo === "fisso") return cte.prezzo_fisso ?? 0;
  if (cte.tipo === "luce") return imp.pun_riferimento + (cte.spread ?? 0);
  return imp.psv_riferimento + imp.ccr_gas + (cte.spread ?? 0);
}

/** Restituisce i 3 prezzi per fascia di una CTE luce (€/kWh, prima delle perdite). */
export function prezziLuceFasce(cte: CTE, imp: Impostazioni): { f1: number; f2: number; f3: number } {
  if (cte.tipo_prezzo === "fisso") {
    const p = cte.prezzo_fisso ?? 0;
    return { f1: p, f2: p, f3: p };
  }
  // index
  const sp = cte.spread ?? 0;
  if (cte.tipo_pun === "fasce") {
    const pf = punFasce(imp);
    return { f1: pf.f1 + sp, f2: pf.f2 + sp, f3: pf.f3 + sp };
  }
  // monorario index
  const p = imp.pun_riferimento + sp;
  return { f1: p, f2: p, f3: p };
}

export function calcolaCostoOffertaLuce(cte: CTE, dati: DatiCliente, imp: Impostazioni) {
  const consumoAnnuo = dati.consumoLuce;
  const fc = getFasceConfig(dati);
  const costoFisso = cte.commercializzazione_anno;
  const costoCvv = (cte.cvv_variabile ?? 0) * consumoAnnuo;
  const costoDisp = (cte.dispacciamento_kwh ?? 0) * consumoAnnuo;
  const cdispd = imp.cdispd_anno;

  if (fc.usa) {
    const pf = prezziLuceFasce(cte, imp);
    const cm =
      pf.f1 * consumoAnnuo * fc.f1 * imp.perdite_rete +
      pf.f2 * consumoAnnuo * fc.f2 * imp.perdite_rete +
      pf.f3 * consumoAnnuo * fc.f3 * imp.perdite_rete;
    const prezzoMedio =
      pf.f1 * fc.f1 * imp.perdite_rete +
      pf.f2 * fc.f2 * imp.perdite_rete +
      pf.f3 * fc.f3 * imp.perdite_rete;
    return {
      costoTotale: cm + costoFisso + costoCvv + costoDisp + cdispd,
      prezzoEffettivo: prezzoMedio,
      prezziPerFascia: { f1: pf.f1 * imp.perdite_rete, f2: pf.f2 * imp.perdite_rete, f3: pf.f3 * imp.perdite_rete },
    };
  }

  // monorario classico (compat con index PUN F0)
  let prezzo: number;
  if (cte.tipo_prezzo === "fisso") prezzo = cte.prezzo_fisso ?? 0;
  else if (cte.tipo_pun === "fasce") {
    // l'offerta è per fasce ma il cliente ha monorario: usa media ponderata default
    const pf = punFasce(imp);
    prezzo = pf.f1 * DEF_PERC.f1 + pf.f2 * DEF_PERC.f2 + pf.f3 * DEF_PERC.f3 + (cte.spread ?? 0);
  } else prezzo = imp.pun_riferimento + (cte.spread ?? 0);

  const costoMateriaPrima = prezzo * consumoAnnuo * imp.perdite_rete;
  return { costoTotale: costoMateriaPrima + costoFisso + costoCvv + costoDisp + cdispd, prezzoEffettivo: prezzo * imp.perdite_rete };
}

export function calcolaCostoOffertaGas(cte: CTE, consumoAnnuo: number, imp: Impostazioni) {
  const prezzo = prezzoUnitarioCTE(cte, imp);
  const costoMateriaPrima = prezzo * consumoAnnuo;
  const costoFisso = cte.commercializzazione_anno;
  const costoCvv = (cte.cvv_variabile ?? 0) * consumoAnnuo;
  const costoTotale = costoMateriaPrima + costoFisso + costoCvv;
  return { costoTotale, prezzoEffettivo: prezzo };
}

export function calcolaCostoCliente(prezzoCliente: number, consumoAnnuo: number, fissoMese: number): number {
  return prezzoCliente * consumoAnnuo + fissoMese * 12;
}

function costoClienteLuceFasce(dati: DatiCliente): number {
  const fc = getFasceConfig(dati);
  const pF1 = dati.prezzoF1 ?? dati.prezzoLuce;
  const pF2 = dati.prezzoF2 ?? dati.prezzoLuce;
  const pF3 = dati.prezzoF3 ?? dati.prezzoLuce;
  return (
    pF1 * dati.consumoLuce * fc.f1 +
    pF2 * dati.consumoLuce * fc.f2 +
    pF3 * dati.consumoLuce * fc.f3 +
    dati.fissoLuceMese * 12
  );
}

export function classificaCTE(
  ctes: CTE[],
  dati: DatiCliente,
  imp: Impostazioni,
  tipo: "luce" | "gas"
): RisultatoOfferta[] {
  const consumo = tipo === "luce" ? dati.consumoLuce : dati.consumoGas;
  const fissoMese = tipo === "luce" ? dati.fissoLuceMese : dati.fissoGasMese;

  let costoCliente: number;
  if (tipo === "luce" && dati.usaFasce) {
    costoCliente = costoClienteLuceFasce(dati);
  } else {
    const prezzoCliente = tipo === "luce" ? dati.prezzoLuce : dati.prezzoGas;
    costoCliente = calcolaCostoCliente(prezzoCliente, consumo, fissoMese);
  }

  return ctes
    .filter((c) => c.attiva && c.tipo === tipo && c.segmento === dati.segmento)
    .map((cte) => {
      const r = tipo === "luce"
        ? calcolaCostoOffertaLuce(cte, dati, imp)
        : calcolaCostoOffertaGas(cte, consumo, imp);
      const risparmio = costoCliente - r.costoTotale;
      const risparmioPct = costoCliente > 0 ? (risparmio / costoCliente) * 100 : 0;
      return {
        cte,
        costoOfferta: r.costoTotale,
        costoCliente,
        risparmio,
        risparmioPct,
        prezzoEffettivo: r.prezzoEffettivo,
        prezziPerFascia: (r as { prezziPerFascia?: { f1: number; f2: number; f3: number } }).prezziPerFascia,
      };
    })
    .sort((a, b) => b.risparmio - a.risparmio);
}

export function simulaBollettaLuce(
  cte: CTE,
  dati: DatiCliente,
  imp: Impostazioni
): SimulazioneBolletta {
  const consumoMese = dati.consumoLuce / 12;
  const quotaFissaFornitore = cte.commercializzazione_anno / 12;

  let corrispettivo: number;
  let corrispettiviFasce: SimulazioneBolletta["dettaglioMateria"]["corrispettiviFasce"] | undefined;

  if (dati.usaFasce) {
    const fc = getFasceConfig(dati);
    const pf = prezziLuceFasce(cte, imp);
    const kwhF1 = consumoMese * fc.f1;
    const kwhF2 = consumoMese * fc.f2;
    const kwhF3 = consumoMese * fc.f3;
    const cF1 = pf.f1 * kwhF1 * imp.perdite_rete;
    const cF2 = pf.f2 * kwhF2 * imp.perdite_rete;
    const cF3 = pf.f3 * kwhF3 * imp.perdite_rete;
    corrispettivo = cF1 + cF2 + cF3;
    corrispettiviFasce = {
      f1: cF1, f2: cF2, f3: cF3,
      prezzoF1: pf.f1 * imp.perdite_rete,
      prezzoF2: pf.f2 * imp.perdite_rete,
      prezzoF3: pf.f3 * imp.perdite_rete,
      kwhF1, kwhF2, kwhF3,
    };
  } else {
    const prezzo = prezzoUnitarioCTE(cte, imp);
    corrispettivo = prezzo * consumoMese * imp.perdite_rete;
  }
  const spesaMateria = quotaFissaFornitore + corrispettivo;

  const quotaFissaRete = imp.sigma1_mese;
  const quotaPotenza = imp.sigma2_kw_mese * dati.potenzaKw;
  const quotaVariabile = imp.sigma3_uc3_kwh * consumoMese;
  const spesaTrasporto = quotaFissaRete + quotaPotenza + quotaVariabile;

  const asosFissoMese = !dati.residente && dati.segmento === "family"
    ? (imp.oneri_asos_fisso_nonres ?? 0) / 12
    : 0;
  const spesaOneri = imp.oneri_luce_fisso_mese + asosFissoMese + imp.oneri_luce_var_kwh * consumoMese;

  const aliquotaAccise = dati.segmento === "family" ? imp.accise_luce_dom : imp.accise_luce_bus;
  let accise = 0;
  if (dati.segmento === "family" && dati.residente && consumoMese <= imp.soglia_esenzione_kwh_mese) {
    accise = 0;
  } else {
    accise = aliquotaAccise * consumoMese;
  }
  const subtotale = spesaMateria + spesaTrasporto + spesaOneri + accise;
  const aliquotaIva = dati.segmento === "family" ? imp.iva_dom : imp.iva_bus;
  const iva = subtotale * aliquotaIva;
  const spesaImposte = accise + iva;

  const canoneRaiMediaMese = dati.canoneRai && dati.residente && dati.segmento === "family"
    ? imp.canone_rai_anno / 12
    : 0;

  const totaleMese = spesaMateria + spesaTrasporto + spesaOneri + spesaImposte + canoneRaiMediaMese;

  return {
    spesaMateria,
    dettaglioMateria: { quotaFissaFornitore, corrispettivo, corrispettiviFasce },
    spesaTrasporto,
    dettaglioTrasporto: { quotaFissa: quotaFissaRete, quotaPotenza, quotaVariabile },
    spesaOneri,
    spesaImposte,
    dettaglioImposte: { accise, iva },
    canoneRaiMediaMese,
    totaleMese,
    totaleAnno: totaleMese * 12,
  };
}

export function simulaBollettaGas(
  cte: CTE,
  dati: DatiCliente,
  imp: Impostazioni
): SimulazioneBolletta {
  const consumoAnnuo = dati.consumoGas;
  const consumoMese = consumoAnnuo / 12;
  const prezzo = prezzoUnitarioCTE(cte, imp);
  const quotaFissaFornitore = cte.commercializzazione_anno / 12;
  const corrispettivo = prezzo * consumoMese;
  const spesaMateria = quotaFissaFornitore + corrispettivo;

  const quotaFissa = imp.gas_trasporto_fisso_mese;
  const quotaVariabile = imp.gas_trasporto_var_smc * consumoMese;
  const spesaTrasporto = quotaFissa + quotaVariabile;

  const spesaOneri = imp.gas_oneri_fisso_mese + imp.gas_oneri_var_smc * consumoMese;

  let acciseAnnue: number;
  if (consumoAnnuo <= imp.gas_accise_soglia) {
    acciseAnnue = consumoAnnuo * imp.gas_accise_1_smc;
  } else {
    acciseAnnue =
      imp.gas_accise_soglia * imp.gas_accise_1_smc +
      (consumoAnnuo - imp.gas_accise_soglia) * imp.gas_accise_2_smc;
  }
  const addizionaleAnnua = consumoAnnuo * imp.gas_add_regionale;
  const acciseMese = (acciseAnnue + addizionaleAnnua) / 12;

  const subtotaleMese = spesaMateria + spesaTrasporto + spesaOneri + acciseMese;
  const subtotaleAnno = subtotaleMese * 12;
  let ivaAnno: number;
  if (consumoAnnuo <= imp.gas_iva_soglia) {
    ivaAnno = subtotaleAnno * imp.iva_dom;
  } else {
    const perc10 = imp.gas_iva_soglia / consumoAnnuo;
    const perc22 = 1 - perc10;
    ivaAnno = subtotaleAnno * perc10 * imp.iva_dom + subtotaleAnno * perc22 * imp.iva_bus;
  }
  const ivaMese = ivaAnno / 12;
  const spesaImposte = acciseMese + ivaMese;

  const totaleMese = spesaMateria + spesaTrasporto + spesaOneri + spesaImposte;
  return {
    spesaMateria,
    dettaglioMateria: { quotaFissaFornitore, corrispettivo },
    spesaTrasporto,
    dettaglioTrasporto: { quotaFissa, quotaVariabile },
    spesaOneri,
    spesaImposte,
    dettaglioImposte: { accise: acciseMese, iva: ivaMese },
    totaleMese,
    totaleAnno: totaleMese * 12,
  };
}
