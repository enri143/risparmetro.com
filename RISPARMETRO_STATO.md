# RISPARMETRO — STATO LAVORI

> Checkpoint resumibile. Aggiornato a fine di ogni step (commit isolato).
> Invarianti complete: vedi `RISPARMETRO_BUILD_PLAN.md`. Roadmap: idem.
> **Ultimo aggiornamento: 23 giugno 2026** (sessione post-harness, ragionamento via chat + esecuzione via Claude Code).

---

## Stato corrente (one-glance)

- **Motore**: A (`src/lib/board/calcoloOfferte.ts`, "parte contendibile") = **unico e frozen**. Motore B eliminato.
- **Test suite**: `29 passed · 3 skipped · 0 failed` (`npm run test`).
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
- **B7** ⏳ Proiezione 12 mesi — **DA RIFARE DA ZERO su Modello A** (la vecchia, su Modello B, è stata cancellata con l'isola morta)
- **B8** ⏳ 🔴 StoricoTab v2 su `simulazioni` (prima lettura multi-tenant seria → meglio DOPO D15-RLS)
- **B9** ⏳ 💰 PresentazioneView v2 / Salesboard (Recharts)
- **B10** ⏳ 💰 OCR bolletta → autofill (`extract-bolletta-board` oggi è stub)
- **B11** ⏳ 💰 PDF brandizzato per tenant

### Blocco V — Co-pilot trattativa
- **V1** ✅ "Gira il tablet" (overlay risparmio gigante)
- **V2 / V3 / V4 / V5** ⏳ — **bloccati sui contenuti**: servono le liste scritte a mano da Enrico (tips, obiezioni, frasi di close) prima di passare a CC
- **V6** ⏳ 💰 Battle card competitor (dipende da B10) · **V7** ⏳ compliance · **V8** ⏳ follow-up (dipende da B5)

### Blocco C — Multi-tenant SaaS
- **C12** ⏳ Console super-admin · **C13** ⏳ 💰 Onboarding + white-label branding · **C14** ⏳ Inviti team + auth completo

### Blocco D — Hardening
- **D15** ⏳ 🔴 Security audit RLS (il test `rls.cross-tenant.test.ts` ha 3 `it.skip` placeholder → da implementare qui)
- **D16** ⏳ Osservabilità (Sentry)
- **D17** 🟡 Dead-code: **isola Motore B fatta**. RESTA: `AnalisiTab.tsx` (orfano), warning "Multiple GoTrueClient instances"
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

---

## Prossimo step

Due opzioni (a verde, decidere):
1. **B7** — ricostruire "Proiezione 12 mesi" da zero su Modello A.
2. **V2/V3** — Enrico scrive le liste contenuti (tips/obiezioni/close) → poi si genera il codice.

---

## Note tecniche aperte

- `AnalisiTab.tsx` è **orfano** (zero import) → candidato cleanup D17.
- Leak-guard `clientmode-leak.test.tsx`: usa `queryByText("Provvigione")` **esatto** per non collidere col bottone toggle "Provvigioni: ON/OFF". Hardening opzionale: `data-testid` dedicato sulla sezione "Condizioni Agente".
- Provvigioni: PDF (`src/lib/pdf/`) e `MaxiTrattativaPanel` verificati **puliti** (nessun riferimento). Unica superficie viva che le mostra = `ConfrontoDettagliatoView`.
- `parametri_regolati` gas resta separato finché non si fa il Blocco GAS (scaglioni).
