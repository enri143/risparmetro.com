/**
 * RLS cross-tenant isolation scaffold.
 *
 * TODO (PART 2 — NON ESEGUIRE senza consenso esplicito):
 *   1. Creare due tenant reali via Supabase Admin API (o seed fixture).
 *   2. Autenticare ciascuno con sessione JWT separata.
 *   3. Verificare che `simulazioni`, `clienti`, `cte` tornino 0 righe se
 *      interrogati dalla sessione dell'altro tenant.
 *   4. Scrivere test `it(...)` con le query reali.
 *
 * STOP: non connettere a DB reale finché l'utente non conferma "vai con PART 2".
 */

import { describe, it } from "vitest";

describe("RLS cross-tenant isolation", () => {
  it.skip("tenant A non vede simulazioni di tenant B", () => {
    // TODO: wiring DB — vedi intestazione file
  });

  it.skip("tenant A non vede clienti di tenant B", () => {
    // TODO: wiring DB — vedi intestazione file
  });

  it.skip("tenant A non vede CTE di tenant B", () => {
    // TODO: wiring DB — vedi intestazione file
  });
});
