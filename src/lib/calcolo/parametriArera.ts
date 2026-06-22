import type { SupabaseClient } from "@supabase/supabase-js"
import type { ParametriRegolati, PrezzoMercato } from "@/lib/board/calcoloOfferte"

/** Prima data in cui leggere luce+mercato da componenti_regolate invece di parametri_regolati */
export const CUTOVER_COMPONENTI = new Date("2026-04-01")

export interface ParametriAreraLuce {
  parametriLuce: ParametriRegolati
  prezziMercato: PrezzoMercato
}

/**
 * Legge parametri ARERA luce e indici mercato da `componenti_regolate`.
 * Usare solo per dataRiferimento >= CUTOVER_COMPONENTI (2026-04-01).
 * Throw esplicito se nessuna riga valida trovata — nessun fallback silenzioso.
 */
export async function fetchParametriAreraLuce(
  supabase: SupabaseClient,
  dataRiferimento: Date,
): Promise<ParametriAreraLuce> {
  const dataStr = dataRiferimento.toISOString().slice(0, 10)

  const [luceRes, mercatoRes] = await Promise.all([
    supabase
      .from("componenti_regolate_luce")
      .select(
        "sigma1_mese, sigma2_kw_mese, sigma3_uc3_kwh, " +
        "oneri_luce_fisso_mese, oneri_luce_var_kwh, oneri_asos_fisso_nonres, " +
        "accise_luce_dom, accise_luce_bus, soglia_esenzione_kwh_mese, " +
        "iva_dom, iva_bus, perdite_rete, cdispd_anno, canone_rai_anno"
      )
      .lte("validita_da", dataStr)
      .gte("validita_a", dataStr)
      .order("validita_da", { ascending: false })
      .limit(1)
      .single(),
    supabase
      .from("componenti_regolate")
      .select("pun_mensile, psv_mensile")
      .eq("tipo", "mercato")
      .is("zona", null)
      .lte("validita_da", dataStr)
      .gte("validita_a", dataStr)
      .order("validita_da", { ascending: false })
      .limit(1)
      .single(),
  ])

  if (luceRes.error || !luceRes.data) {
    throw new Error(
      `Nessun parametro luce valido per ${dataStr} in componenti_regolate_luce: ${
        luceRes.error?.message ?? "riga mancante"
      }`,
    )
  }
  if (mercatoRes.error || !mercatoRes.data) {
    throw new Error(
      `Nessun indice mercato valido per ${dataStr} in componenti_regolate: ${
        mercatoRes.error?.message ?? "riga mancante"
      }`,
    )
  }

  const l = luceRes.data as unknown as {
    sigma1_mese: number | string
    sigma2_kw_mese: number | string
    sigma3_uc3_kwh: number | string
    oneri_luce_fisso_mese: number | string
    oneri_luce_var_kwh: number | string
    oneri_asos_fisso_nonres: number | string | null
    accise_luce_dom: number | string
    accise_luce_bus: number | string
    soglia_esenzione_kwh_mese: number | string
    iva_dom: number | string
    iva_bus: number | string
    perdite_rete: number | string
    cdispd_anno: number | string
    canone_rai_anno: number | string
  }
  const m = mercatoRes.data as {
    pun_mensile: number | string
    psv_mensile: number | string
  }

  return {
    parametriLuce: {
      sigma1_mese:               Number(l.sigma1_mese),
      sigma2_kw_mese:            Number(l.sigma2_kw_mese),
      sigma3_uc3_kwh:            Number(l.sigma3_uc3_kwh),
      oneri_luce_fisso_mese:     Number(l.oneri_luce_fisso_mese),
      oneri_luce_var_kwh:        Number(l.oneri_luce_var_kwh),
      oneri_asos_fisso_nonres:   l.oneri_asos_fisso_nonres != null ? Number(l.oneri_asos_fisso_nonres) : undefined,
      accise_luce_dom:           Number(l.accise_luce_dom),
      accise_luce_bus:           Number(l.accise_luce_bus),
      soglia_esenzione_kwh_mese: Number(l.soglia_esenzione_kwh_mese),
      iva_dom:                   Number(l.iva_dom),
      iva_bus:                   Number(l.iva_bus),
      perdite_rete:              Number(l.perdite_rete),
      cdispd_anno:               Number(l.cdispd_anno),
      canone_rai_anno:           Number(l.canone_rai_anno),
      accise:                    0,
      iva:                       0,
    },
    prezziMercato: {
      pun_medio: Number(m.pun_mensile),
      psv_medio: Number(m.psv_mensile),
    },
  }
}
