import { describe, it, expect, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchParametriAreraLuce } from "./parametriArera";

// ── Builder mock supabase ─────────────────────────────────────────────────────

function makeMockSupabase(opts: {
  luceData?: Record<string, unknown>;
  luceError?: { message: string };
  mercatoData?: Record<string, unknown>;
  mercatoError?: { message: string };
}) {
  const buildChain = (data: unknown, error: unknown) => ({
    select: vi.fn().mockReturnThis(),
    lte: vi.fn().mockReturnThis(),
    gte: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    is: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: data ?? null, error: error ?? null }),
  });

  return {
    from: vi.fn().mockImplementation((table: string) => {
      if (table === "componenti_regolate_luce") {
        return buildChain(opts.luceData, opts.luceError);
      }
      return buildChain(opts.mercatoData, opts.mercatoError);
    }),
  } as unknown as SupabaseClient;
}

// Dati minimi validi per luce e mercato
const LUCE_VALIDA = {
  sigma1_mese: 1.9, sigma2_kw_mese: 2.106, sigma3_uc3_kwh: 0.01057,
  oneri_luce_fisso_mese: 0.5, oneri_luce_var_kwh: 0.035,
  oneri_asos_fisso_nonres: null,
  accise_luce_dom: 0.0227, accise_luce_bus: 0.0125,
  soglia_esenzione_kwh_mese: 150, iva_dom: 0.1, iva_bus: 0.22,
  perdite_rete: 1.1, cdispd_anno: 1.23, canone_rai_anno: 90,
};
const MERCATO_VALIDO = { pun_mensile: 0.115, psv_mensile: 0.42 };

// ── Test ─────────────────────────────────────────────────────────────────────

describe("fetchParametriAreraLuce — guard no-silent-zero", () => {
  it("lancia errore quando componenti_regolate_luce non ha righe (data null)", async () => {
    const sb = makeMockSupabase({
      luceData: undefined,
      luceError: { message: "nessuna riga per la data" },
      mercatoData: MERCATO_VALIDO,
    });
    await expect(
      fetchParametriAreraLuce(sb, new Date("2099-01-01")),
    ).rejects.toThrow(/componenti_regolate_luce/);
  });

  it("lancia errore quando la riga esiste ma data è null (riga mancante)", async () => {
    const sb = makeMockSupabase({
      luceData: undefined,
      luceError: undefined, // no error, but data is null
      mercatoData: MERCATO_VALIDO,
    });
    await expect(
      fetchParametriAreraLuce(sb, new Date("2099-01-01")),
    ).rejects.toThrow(/riga mancante/);
  });

  it("lancia errore quando componenti_regolate (mercato) non ha righe", async () => {
    const sb = makeMockSupabase({
      luceData: LUCE_VALIDA,
      mercatoData: undefined,
      mercatoError: { message: "nessun indice per la data" },
    });
    await expect(
      fetchParametriAreraLuce(sb, new Date("2099-01-01")),
    ).rejects.toThrow(/componenti_regolate/);
  });

  it("ritorna parametri validi quando entrambe le tabelle hanno dati", async () => {
    const sb = makeMockSupabase({ luceData: LUCE_VALIDA, mercatoData: MERCATO_VALIDO });
    const result = await fetchParametriAreraLuce(sb, new Date("2026-06-22"));
    expect(result.parametriLuce.sigma1_mese).toBeCloseTo(1.9);
    expect(result.prezziMercato.pun_medio).toBeCloseTo(0.115);
  });
});
