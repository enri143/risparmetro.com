# RISPARMETRO — STATO LAVORI

> Checkpoint resumibile. Aggiornato a fine di ogni step (commit isolato).
> Invarianti complete: vedi `RISPARMETRO_BUILD_PLAN.md`. Roadmap: idem.
> **Ultimo aggiornamento: 23 giugno 2026** (sessione continuata — blocco V co-pilot completato).

---

## Stato corrente (one-glance)

- **Motore**: A (`src/lib/board/calcoloOfferte.ts`, "parte contendibile") = **unico e frozen**. Motore B eliminato.
- **Motore B eliminato — verificato su git** (`noMotoreB.guard.test.ts` blinda l'invariante a CI).
- **Test suite**: `53 passed · 3 skipped · 0 failed` (`npm run test`).
- **Build**: `npm run build` OK (solo warning pre-esistenti: chunk size, eval in vm-browserify).
- **Golden**: `calcoloOfferte.golden.test.ts` = oracolo vero, 6 casi, numeri ricalcolati a mano dal motore. Tracciato in git da `13d0c0d`.
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
- **B8** ✅ StoricoTab v2 su `simulazioni` — query diretta (RLS per-tenant, nessuna edge function), snapshot immutabile read-only (splitSnapshot + stripProvvigioni), tab Storico montata in Board. Cross-tenant garantito dalla RLS verificata in D15, non testabile con vitest senza DB live.
- **B9** ✅ 💰 PresentazioneView v2 / Salesboard — completa: Proiezione12Mesi (AreaChart) + BeforeAfterCard (BarChart Recharts + durata bloccata label con Lock icon). Layout grid 2-col iPad landscape. Zero provvigioni.
- **B10** 🟡 💰 OCR bolletta → autofill. Edge function `extract-bolletta-board` completa. `UploadBollettaButton` montato in AnalisiCockpit con `handleOcrApply`/`handleOcrDone`. Mapping layer estratto in `ocrBolletta.ts` (puro TS, testato: 8 test). **PENDING**: migration applicata al DB remoto, secrets configurati in Supabase, E2E manuale su device reale. Nota: le fasce estratte dall'OCR non si applicano ancora al cockpit (monorario); feature fasce è a sé.
- **B11** ✅ 💰 PDF brandizzato per tenant — logo + accent bar + dati + risparmio. Parità presentazione: durata bloccata nella card offerta (verde, solo se risparmio > 0). Footer: "Preventivo valido fino al gg/mm/aaaa" (+30 gg runtime).

### Blocco V — Co-pilot trattativa
- **V1** ✅ "Gira il tablet" (overlay risparmio gigante)
- **V2** ⏳ — bloccato: serve lista tips/suggerimenti (contenuto da Enrico)
- **V3** ✅ ObiezioniPanel — 6 obiezioni con risposta, accordion locale
- **V4** ✅ ScalettaChiusuraPanel — 6 step checklist con contatore
- **V5** ✅ FrasiClosePanel — 6 frasi con bottone Copia (clipboard)
- **V6** ⏳ 💰 Battle card competitor (dipende da B10)
- **V7** ✅ CompliancePanel — 5 item checklist con banner verde a completamento
- **V8** ⏳ follow-up (dipende da B5)
- Contenuti V3/V4/V5/V7 hardcoded come default; editabilità per-tenant via jsonb deferita al blocco C.
- ✅ **BUG fornitori risolto**: `matchFornitore` (fuzzy includes) + auto-create via upsert on conflict slug in `UploadPdfFlow`. Seed ancora da applicare se DB vuoto (`npx supabase db push`).

### Blocco C — Multi-tenant SaaS
- **C12** 🟡 Console super-admin — slice 1+2 fatti: `/admin` blindata, lista tenant, crea tenant (nome/slug/piano/colore, errore slug duplicato), sospendi/riattiva con conferma. Provisioning agente via UI (C14-B). Restano: mandati fornitori per-tenant.
- **C13** ⏳ 💰 Onboarding + white-label branding
- **C14** 🟡 Provisioning agente: edge function `provision-tenant-user` (service_role, guard platform_admin, rollback su member-insert fail) + UI "Aggiungi agente" nella console (email/password/ruolo, genera password, riepilogo+copia). Resta: inviti self-service via email (fase futura).

### Blocco D — Hardening
- **D15** ✅ (parziale) R1 ✅ narrow SELECT cte, R2 ✅ hook orfano rimosso. R3 ⏸️ `impostazioni` table: decisione globale-vs-tenant parcheggiata → blocco C (onboarding tenant). `rls.cross-tenant.test.ts` ha 3 `it.skip` → step futuro.
- **D16** ⏳ Osservabilità (Sentry)
- **D17** ✅ Dead-code: isola Motore B rimossa · `AnalisiTab.tsx` + `FiltriRapidiChips.tsx` orfani rimossi · warning GoTrueClient eliminato · hook orfano `useSgProvvigioni` rimosso (D15-R2) · 10 file orfani residui rimossi (knip) · 5 dipendenze inutilizzate rimosse (knip). Export inutilizzati in `calcoloOfferte.ts` NON rimossi (motore frozen).
- **D18** ⏳ QA tablet iPad reale

### Blocco GAS / E
- **GAS19** ⏳ floating (scaglioni Veneto, quando il gas diventa vendita)
- **E20** ⏳ 💰 Billing · **E21** ⏳ Deploy prod + dominio · **E22** ⏳ Tenant 0 = lucegas · **E23** ⏳ Primo broker esterno

---

## Cronologia modifiche (sessione 23 giu, post-harness)

| # | Cosa | Commit | Esito |
|---|------|--------|-------|
| 1 | A2 — `calcoloOfferte.golden.test.ts` riscritto su Motore A, 6 casi (fisso/indicizzato luce+gas, dual, ordinamento, gate-guard) | `13d0c0d` | verde |
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
| 13 | D17 knip: rimuovi 10 file orfani residui (BeforeAfterBar, ClienteForm, DraftBanner, HeroRisparmio, SimulazioneBolletta, useDraftAutosave, iva, sgCodice, share, App.css) | `46cedf8` | build OK, 33/3/0 |
| 14 | D17 knip: rimuovi 5 dipendenze inutilizzate (framer-motion, html2canvas, jspdf, @base-ui/react, @fontsource-variable/geist); pako promosso a diretta | `6860fc3` | build OK, 33/3/0 |
| 15 | B8 S1 — helper storico (splitSnapshot + stripProvvigioni) con 4 test | `fbd582a` | build OK, 37/3/0 |
| 16 | B8 S2 — StoricoTab v2: query diretta simulazioni, snapshot read-only, no provvigioni, no edge function | `f8c4d95` | build OK, 37/3/0 |
| 17 | B8 S3 — monta tab Storico (BoardTab union + History icon + Board.tsx mount) | `3282bb6` | build OK, 37/3/0 |
| 18 | V S1 — contenuti co-pilot di default + 5 test (obiezioni, scaletta, frasi, compliance) | `f66431d` | build OK, 42/3/0 |
| 19 | V3 — ObiezioniPanel (accordion locale, una aperta alla volta) | `45f0b49` | build OK, 42/3/0 |
| 20 | V4 — ScalettaChiusuraPanel (checklist + contatore x/N) | `6f992d4` | build OK, 42/3/0 |
| 21 | V5+V7 — FrasiClosePanel (clipboard+feedback) + CompliancePanel (checklist+banner) | `19e6c72` | build OK, 42/3/0 |
| 22 | V S5 — CopilotTrattativa accordion + mount in TrattativaView | `b54baa1` | build OK, 42/3/0 |
| 23 | fix: fornitore_id via fuzzy match + auto-create (matchFornitore.ts + 5 test + UploadPdfFlow) | `c7bca4a` | build OK, 47/3/0 |
| 24 | C12 S1 — guard RequirePlatformAdmin (loading/accesso negato/children) | `4df9ae7` | build OK, 47/3/0 |
| 25 | C12 S2 — pagina AdminConsole: lista tenant read-only, skeleton, empty state | `6fcfaa5` | build OK, 47/3/0 |
| 26 | C12 S3 — rotta /admin + link "Admin" condizionale in Board header | `29c22fe` | build OK, 47/3/0 |
| 27 | C12 S4 — slugify helper + 5 test | `369f3e4` | build OK, 52/3/0 |
| 28 | C12 S5 — crea tenant: Dialog nome/slug/piano/colore, errore slug duplicato | `89370a1` | build OK, 52/3/0 |
| 29 | C12 S6 — sospendi/riattiva tenant: toggle + confirm + reload | `1da420e` | build OK, 52/3/0 |
| 30 | C14-B — edge function provision-tenant-user + UI AggiuntaAgenteDialog | `aa4efc2` | build OK, 52/3/0 · deploy OK |
| 31 | Baseline oracolo: traccia golden (13d0c0d), ignora zip/.codex, untrack tsbuildinfo, fix pre-commit hook | `13d0c0d` | build OK, 52/3/0 |
| 32 | Re-land D17: rimuovi `SimulazioneBolletta` orfana da types.ts + guard test `noMotoreB.guard.test.ts` | `c40fefe` | build OK, 53/3/0 |
| 33 | B10: estrai mapping OCR in `ocrBolletta.ts` + 8 test (buildPatch/mergeExtracted/robustezza) | `cb9ffb2` | build OK, 61/3/0 |

---

## Prossimo step

- **V2** — Enrico scrive lista tips/suggerimenti → si genera il pannello.
- **V6** / **V8** — bloccati su contenuti/feature precedenti.
- **C13** — Onboarding white-label (upload logo, accent color per tenant).
- **board-storico** — edge function orfana (non chiamata da nessun client): candidata rimozione in D17 futuro.

---

## Note tecniche aperte

- Leak-guard `clientmode-leak.test.tsx`: usa `queryByText("Provvigione")` **esatto** per non collidere col bottone toggle "Provvigioni: ON/OFF". Hardening opzionale: `data-testid` dedicato sulla sezione "Condizioni Agente".
- Provvigioni: PDF (`src/lib/pdf/`) e `MaxiTrattativaPanel` verificati **puliti** (nessun riferimento). Unica superficie viva che le mostra = `ConfrontoDettagliatoView`.
- `parametri_regolati` gas resta separato finché non si fa il Blocco GAS (scaglioni).
