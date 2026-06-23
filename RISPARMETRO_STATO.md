# RISPARMETRO — STATO LAVORI

> Checkpoint resumibile. Aggiornato a fine di ogni step (commit isolato).
> Invarianti complete: vedi `RISPARMETRO_BUILD_PLAN.md`. Roadmap: idem.
> **Ultimo aggiornamento: 23 giugno 2026** (sessione post-harness, ragionamento via chat + esecuzione via Claude Code).

---

## Stato corrente (one-glance)

- **Motore**: A (`src/lib/board/calcoloOfferte.ts`, "parte contendibile") = **unico e frozen**. Motore B eliminato.
- **Test suite**: `33 passed · 3 skipped · 0 failed` (`npm run test`).
- **Build**: `npm run build` OK (solo warning pre-esistenti: chunk size, eval in vm-browserify).
- **Golden**: `calcoloOfferte.golden.test.ts` = oracolo vero, 6 casi, numeri ricalcolati a mano dal motore.
- ⚠️ **origin/main indietro**: ricordarsi `git push` (commit locali avanti).

---

## Build Plan — avanzamento per step

Legenda: ✅ fatto · ⏳ da fare · 🟡 parziale · ⏸️ in attesa esterna · 🔴 rischio alto · 💰 core value

### Blocco A — Motore
- **A1** ✅ Motore parte contendibile + regola perdite corretta
- **A2** ✅ Golden test motore — **rifatto come oracolo reale (6 casi)**, fallisce su deviazione di 1 cent
- **A3** ✅ Pannello super-admin parametri ARERA (`componenti_regolate_luce`)
- **A4** ⏸️ Edge function PUN/PSV automatico — **in attesa credenziali GME** (api.mercatoelettrico.org)

### Blocco B — Sala vendita
- **B5** ✅ Sezione "Cliente (opzionale)" → upsert `clienti`, link `cliente_id` su simulazione
- **B6** ✅ Toggle `showProvvigioni` — agente-only, **subordinato a clientMode**. Regola: provvigioni visibili SSE `!clientMode && showProvvigioni`. Guard nel leak-test.
- **B7** ✅ Proiezione 12 mesi — **rifatta da zero su Modello A**. `proiezione.ts` puro TS (no React, no Supabase), `Proiezione12Mesi.tsx` (Recharts AreaChart, risparmio cumulato offerta selezionata), montata in AnalisiCockpit.
- **B8** ⏳ 🔴 StoricoTab v2 su `simulazioni` (prima lettura multi-tenant seria → meglio DOPO D15-RLS)
- **B9** ✅ 💰 PresentazioneView v2 / Salesboard — completa: Proiezione12Mesi (AreaChart) + BeforeAfterCard (BarChart Recharts + durata bloccata label con Lock icon). Layout grid 2-col iPad landscape. Zero provvigioni.
- **B10** ⏳ 💰 OCR bolletta → autofill (`extract-bolletta-board` oggi è stub)
- **B11** ✅ 💰 PDF brandizzato per tenant — logo + accent bar + dati + risparmio. Parità presentazione: durata bloccata nella card offerta (verde, solo se risparmio > 0). Footer: "Preventivo valido fino al gg/mm/aaaa" (+30 gg runtime).

### Blocco V — Co-pilot trattativa
- **V1** ✅ "Gira il tablet" (overlay risparmio gigante)
- **V2 / V3 / V4 / V5** ⏳ — **bloccati sui contenuti**: servono le liste scritte a mano da Enrico (tips, obiezioni, frasi di close) prima di passare a CC
- **V6** ⏳ 💰 Battle card competitor (dipende da B10) · **V7** ⏳ compliance · **V8** ⏳ follow-up (dipende da B5)

### Blocco C — Multi-tenant SaaS
- **C12** ⏳ Console super-admin · **C13** ⏳ 💰 Onboarding + white-label branding · **C14** ⏳ Inviti team + auth completo

### Blocco D — Hardening
- **D15** ✅ (parziale) R1 ✅ narrow SELECT cte, R2 ✅ hook orfano rimosso. R3 ⏸️ `impostazioni` table: decisione globale-vs-tenant parcheggiata → blocco C (onboarding tenant). `rls.cross-tenant.test.ts` ha 3 `it.skip` → step futuro.
- **D16** ⏳ Osservabilità (Sentry)
- **D17** ✅ Dead-code: isola Motore B rimossa · `AnalisiTab.tsx` + `FiltriRapidiChips.tsx` orfani rimossi · warning GoTrueClient eliminato (due `createClient` → un'istanza canonica con fallback chiave)
- **D18** ⏳ QA tablet iPad reale

### Blocco GAS / E
- **GAS19** ⏳ floating (scaglioni Veneto, quando il gas diventa vendita)
- **E20** ⏳ 💰 Billing · **E21** ⏳ Deploy prod + dominio · **E22** ⏳ Tenant 0 = lucegas · **E23** ⏳ Primo broker esterno

---

## Cronologia modifiche (sessione 23 giu, post-harness)

| # | Cosa | Commit | Esito |
|---|------|--------|-------|
| 1 | A2 — `calcoloOfferte.golden.test.ts` riscritto su Motore A, 6 casi (fisso/indicizzato luce+gas, dual, ordinamento, gate-guard) | (golden rewrite) | verde |
| 2 | Eliminata isola Motore B: `calcoli.ts` + `ClassificaOfferte.tsx` + `Proiezione12Mesi.tsx` + `ConfrontoModal.tsx` | `8c373b5` | −906 righe, build OK, 28/3/0 |
| 3 | B6 — toggle `showProvvigioni` (AnalisiCockpit + ConfrontoDettagliatoView + leak-test esteso) | `910513e` | build OK, 29/3/0 |
| 4 | B7 — Proiezione 12 mesi da zero su Motore A (`proiezione.ts` + `Proiezione12Mesi.tsx` Recharts + mount in AnalisiCockpit) | `10f9382` | build OK, 33/3/0 |
| 5 | D17 — rimossi `AnalisiTab.tsx` + `FiltriRapidiChips.tsx` orfani (guard grep vuoto) | `6d8ac02` | build OK, 33/3/0 |
| 6 | B9 slice 1 — Proiezione12Mesi in PresentazioneView (grid 2-col, luce + gas, riuso componente esistente) | `590f33b` | build OK, 33/3/0 |
| 7 | D17 finale — GoTrueClient: `supabase.ts` diventa re-export, istanza canonica con fallback chiave in `client.ts` | `00149eb` | build OK, 33/3/0 |
| 8 | B9 slice 2 — BeforeAfterCard (BarChart Recharts) + durata bloccata label in PresentazioneView | `63189b9` | build OK, 33/3/0 |
| 9 | B11 parità PDF — durata bloccata in OfferCard + "Preventivo valido fino al" nel footer | (questo commit) | build OK, 33/3/0 |
| 10 | D15 step 1 — audit RLS read-only: colonne CTE sensibili, 7 rischi catalogati, tabelle fantasma, bundle scan | `f78783a` | docs-only |
| 11 | D15 R1: narrow SELECT cte + fetch provvigioni gated su !clientMode (belt-and-suspenders) | `b4781be` | build OK, 33/3/0 |
| 12 | D15 R2: rimosso hook orfano useSgProvvigioni (zero consumer, tabella fantasma sg_provvigioni) | `29df98f` | build OK, 33/3/0 |

---

## Prossimo step

- **B8** — StoricoTab v2 su `simulazioni` (D15 R1+R2 completati, R3 parcheggiato → si può procedere).
- **V2/V3** — Enrico scrive le liste contenuti (tips/obiezioni/close) → poi si genera il codice.

---

## Note tecniche aperte

- `AnalisiTab.tsx` è **orfano** (zero import) → candidato cleanup D17.
- Leak-guard `clientmode-leak.test.tsx`: usa `queryByText("Provvigione")` **esatto** per non collidere col bottone toggle "Provvigioni: ON/OFF". Hardening opzionale: `data-testid` dedicato sulla sezione "Condizioni Agente".
- Provvigioni: PDF (`src/lib/pdf/`) e `MaxiTrattativaPanel` verificati **puliti** (nessun riferimento). Unica superficie viva che le mostra = `ConfrontoDettagliatoView`.
- `parametri_regolati` gas resta separato finché non si fa il Blocco GAS (scaglioni).
