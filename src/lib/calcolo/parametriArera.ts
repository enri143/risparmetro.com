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
      .from("componenti_regolate")
      .select("trasporto_gestione, oneri_sistema, accisa_aliquota, iva")
      .eq("tipo", "luce")
      .is("zona", null)
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
      `Nessun parametro luce valido per ${dataStr} in componenti_regolate: ${
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

  const l = luceRes.data as {
    trasporto_gestione: number | string
    oneri_sistema: number | string
    accisa_aliquota: number | string
    iva: number | string
  }
  const m = mercatoRes.data as {
    pun_mensile: number | string
    psv_mensile: number | string
  }

  return {
    parametriLuce: {
      trasporto_gestione: Number(l.trasporto_gestione),
      oneri_sistema: Number(l.oneri_sistema),
      accise: Number(l.accisa_aliquota),
      iva: Number(l.iva),
    },
    prezziMercato: {
      pun_medio: Number(m.pun_mensile),
      psv_medio: Number(m.psv_mensile),
    },
  }
}
