# RISPARMETRO — REDESIGN UI/UX (STATO)

> Fonte di verità dello stato del **redesign UI/UX**. Si aggiorna a fine di OGNI work-unit (commit isolato).
> Build funzionale e logica: vedi `RISPARMETRO_STATO.md`. Invarianti complete: `RISPARMETRO_BUILD_PLAN.md` + `CLAUDE.md`.
> **Ultimo aggiornamento: 24 giugno 2026** — WU2c completato (stepper visivo sincronizzato con route). WU2 ✅ chiuso. 2/13 WU formali completati.

---

## Stato corrente (one-glance)

- **Work-unit corrente**: WU3 (transizioni di pagina + skeleton/loading premium).
- **Completati**: 2 / 13 formali (WU1 ✅ · WU2 ✅: 2a · 2b · 2b-2 · 2c).
- **Test suite baseline**: `86 passed · 3 skipped · 0 failed`. Build verde. Da mantenere a ogni WU.
- **App LIVE**: `https://risparmetro-com.vercel.app` (deploy on push, branch `main`).
- **Regola**: ogni WU finisce con `npm run build && npm run test` verdi + commit isolato + aggiornamento di QUESTO file. MAI `git push` (lo fa Enrico).

---

## Invarianti UI (sintesi — dettaglio in CLAUDE.md)

- Motore `calcoloOfferte.ts` **frozen**: si reimpagina la presentazione dei risultati, mai il calcolo.
- **Provvigioni/markup mai client-facing** (DOM, PDF, bundle). `clientmode-leak.test.tsx` verde; se nuove superfici cliente → estendere il leak-test.
- Viste cliente brandizzate per tenant via `useTenantBranding` (accent + logo). Niente colori hardcoded.
- Migration additive-only, RLS tenant-scoped, snapshot immutabili.
- Deep-link reggono il refresh (vercel.json SPA rewrite) — verifica dopo WU2.
- `npm run build` + `npm run test` sempre verdi. Pre-commit hook non si indebolisce.

---

## Tooling per work-unit

| WU | Skill / MCP da usare |
|----|----------------------|
| WU1  | `impeccable` (refactor sicuro, test verdi) |
| WU2  | `shadcn` MCP (Stepper/Progress) · `impeccable` · `ui-ux-pro-max` · `frontend-design` |
| WU3  | `shadcn` MCP (Skeleton) · `context7` (View Transitions API) · `chrome-devtools` (layout shift) |
| WU4  | `frontend-design` (token) · `ui-ux-pro-max` · `chrome-devtools` (iPad) |
| WU5  | `stitch` MCP (direzioni visive) · `shadcn` MCP (Card/Badge) · `frontend-design` · `chrome-devtools` (iPad) |
| WU6  | `stitch` MCP (sequenza slide) · `frontend-design` · `ui-ux-pro-max` |
| WU7  | `frontend-design` · `context7` (count-up/animazione) |
| WU8  | `context7` (Recharts animation, Fullscreen API) · `chrome-devtools` (fullscreen/iPad) |
| WU9  | `chrome-devtools` (tap target/viewport) · `ui-ux-pro-max` |
| WU10 | `impeccable` (logica draft/retry) |
| WU11 | `shadcn` MCP · `context7` (`@react-pdf` PDFViewer + libreria QR) |
| WU12 | `context7` (Vibration API) |
| WU13 | `frontend-design` (token dark) · `chrome-devtools` (contrasto, incl. caveat header accent chiaro) |

---

## Roadmap work-unit

Legenda: ✅ fatto · 🟡 parziale · ⏳ da fare · 🔴 rischio alto · ⭐ effetto wow / core value

### Fase 1 — Navigazione (keystone, de-rischia tutto)
| WU | Idee | Goal | Stato | Commit |
|----|------|------|-------|--------|
| WU1 | 3 | Spezzare `AnalisiCockpit` in componenti (Setup / Offerte / Results) senza cambio comportamento | ✅ | ce80abc |
| WU2 | 2 + 1 | Route annidate `/board/analisi/*` (dati→offerte→presenta→chiudi) + stepper visivo sincronizzato | ✅ | 2a: 563a87c · 2b: a404647 · 2b-2: dd55ca7 · 2c: dc557cd |

### Fase 2 — Design base (eredita tutto il resto)
| WU | Idee | Goal | Stato | Commit |
|----|------|------|-------|--------|
| WU3 | 4 + 9 | Transizioni di pagina (View Transitions/CSS) + skeleton/loading premium | ⏳ | — |
| WU4 | 16 + 18 | Tipografia/display + `tabular-nums` sui numeri + spacing/densità coerenti | ⏳ | — |

### Fase 3 — Offerte
| WU | Idee | Goal | Stato | Commit |
|----|------|------|-------|--------|
| WU5 | 5 + 6 | ⭐ Pagina Offerte full-bleed (solo offerte) + card ridisegnate (pill tipo+durata, costo/anno, risparmio verde+%) | ⏳ | — |

### Fase 4 — Modalità Cliente (effetto wow)
| WU | Idee | Goal | Stato | Commit |
|----|------|------|-------|--------|
| WU6 | 10 | ⭐ Modalità Cliente: sequenza slide navigabile, progress dots, brandizzata, zero agente | ⏳ | — |
| WU7 | 11 + 12 | Count-up del numerone da 0 + slide Prima/Dopo con due bollette affiancate | ⏳ | — |
| WU8 | 13 + 14 | Proiezione 12 mesi che si disegna progressivamente + Fullscreen API ("Gira il tablet" entra in fullscreen) | ⏳ | — |

### Fase 5 — Ergonomia field
| WU | Idee | Goal | Stato | Commit |
|----|------|------|-------|--------|
| WU9 | 20 + 21 | Action bar sticky in basso + tap target ≥44px + input `inputmode`/stepper/formattazione live | ⏳ | — |
| WU10 | 22 | Resilienza rete: draft del giro vendita in locale + retry, ripresa senza perdita | ⏳ | — |

### Fase 6 — Chicche differenzianti
| WU | Idee | Goal | Stato | Commit |
|----|------|------|-------|--------|
| WU11 | 23 + 24 | QR a fine presentazione (riepilogo/PDF sul telefono cliente) + anteprima PDF live in-app | ⏳ | — |
| WU12 | 25 | Haptic/vibrazione discreta sul reveal del risparmio (no-op dove non supportato) | ⏳ | — |

### Fase 7 — Tema
| WU | Idee | Goal | Stato | Commit |
|----|------|------|-------|--------|
| WU13 | 19 | Dark mode sala vendita via token, contrasto verificato, toggle persistito | ⏳ | — |

**Escluse di proposito** (non re-introdurre): 7 (segmented sort), 8 (barre confronto), 15 (handoff teatrale), 17 (accent/profondità a sé).

---

## Definition of Done per work-unit

- **WU1** — `AnalisiCockpit` spezzato in ≥3 componenti; **zero cambio di comportamento** visibile; build+test verdi (79/3/0 invariato); leak-test verde.
- **WU2** — Route annidate funzionanti (dati/offerte/presenta/chiudi); boolean sostituiti da navigazione; stepper in alto sincronizzato con la route; back del browser coerente; deep-link reggono il refresh (no 404).
- **WU3** — Transizione fluida tra step; skeleton shimmer + micro-copy durante il calcolo offerte; nessun layout shift (verificato chrome-devtools); via i vuoti morti del riepilogo.
- **WU4** — Superfamily tipografica applicata via token; `tabular-nums` su tutti i prezzi/numeri; spacing scale coerente (4/8/12/16); griglia 2-col iPad sfruttata.
- **WU5** — Pagina Offerte mostra SOLO le offerte (niente form sopra); card con gerarchia forte; best offer evidenziata; verificata su viewport iPad.
- **WU6** — Modalità Cliente come sequenza slide con avanti/indietro + progress dots; brandizzata tenant; zero elementi agente; leak-test esteso se nuove superfici.
- **WU7** — Count-up animato da 0 sul numerone; slide Prima/Dopo con due "bollette" affiancate e delta evidenziato.
- **WU8** — AreaChart proiezione che si disegna progressivamente; Fullscreen API con fallback; "Gira il tablet" entra in fullscreen e nasconde il chrome del browser.
- **WU9** — Action bar sticky in basso (zona pollice); tap target ≥44px verificati; input numerici con `inputmode="decimal"`, stepper potenza, formattazione live.
- **WU10** — Draft del giro vendita persistito in locale + retry su rete instabile; ripresa senza perdita se cade la connessione.
- **WU11** — QR a fine presentazione apre riepilogo/PDF brandizzato; anteprima PDF live in-app (PDFViewer) con estetica coerente alla presentazione.
- **WU12** — Vibrazione discreta sul reveal dove supportata; no-op silenzioso altrove.
- **WU13** — Dark mode via token; contrasto verificato (incluso caveat header con accent chiaro); toggle persistito tra sessioni.

---

## Decisioni & note

- (seed) Navigazione: si passa da boolean su pagina unica a route annidate sotto `/board/analisi`. La shell a tab di `Board.tsx` resta; cambia solo il contenuto del tab "analisi".
- (seed) Transizioni senza framer-motion (rimosso da knip): View Transitions API nativa o CSS.
- (seed) Modalità Cliente è il differenziatore vendibile: massima cura, brandizzata, zero leak provvigioni.
- (WU1) Split move-only: `AnalisiCockpit` resta orchestratore (tutto stato/effetti/memo/handler), `AnalisiSetup` riceve il form+dropzone, `AnalisiOfferte` riceve il ramo agente dei risultati. `PresentazioneView`, overlay (`MaxiTrattativaPanel`, `TrattativaView`) e `ConfrontoDettagliatoView` restano montati dal cockpit. `cockpitShared.tsx` espone i tipi condivisi (`ZonaRow`, `ClienteSeg`, `ResidenzaSeg`). `data-testid` stabili aggiunti: `analisi-setup`, `analisi-offerte`.
- (WU1) FALSO POSITIVO §0-bis: `calcoli.ts` + `ConfrontoModal.tsx` + `ClassificaOfferte.tsx` sono dead-code residuo (0 importer statici vivi); il loro rilevamento in ZIP è atteso. Pulizia da fare nel workstream FUNZIONALE, non qui.
- (WU2) Spezzato in 2a/2b/2c per de-rischio: 2a routerizza i 4 tab board (evita il modello misto tab-state+route annidate); 2b introduce route interne sotto `/board/analisi/`; 2c aggiunge lo stepper. Tab board ora URL-driven: `/board/analisi`, `/board/listino`, `/board/storico`, `/board/impostazioni`. `Board.tsx` è layout puro con `<Outlet/>`. `TabBar` interfaccia invariata (active/onChange). `StoricoRoute` preserva il wrapper container. Catch-all `/board/*` → `/board/analisi`.
- (WU2b) `AnalisiCockpit` diventa layout con `<Outlet context={ctx}/>`. `showResults`/`presentationMode` eliminati: sostituiti da `navigate('/board/analisi/offerte')` (`goToOfferte`) e `navigate('/board/analisi/dati')` (`resetResults`). `AnalisiCtx` esporta il tipo condiviso. `AnalisiSetup`, `AnalisiOfferte`, `PresentazioneView` convertiti a `useOutletContext<AnalisiCtx>()` senza props. Guard redirect su offerte/presenta se nessun risultato. `clientmode-leak.test.tsx` esteso: +2 test su PresentazioneView (81/3/0).
- (WU2b-2) `showDettagliato` eliminato: route `dettaglio` (`ConfrontoDettagliatoView`). `trattativaOfferta` overlay eliminato: route `chiudi` (`TrattativaView`). Entrambi convertiti da props a `useOutletContext<AnalisiCtx>()`. `AnalisiCtx` esteso con `ctes`, `clientMode`/`setClientMode`, `showProvvigioni`/`setShowProvvigioni`, `trattativaOfferta`. Guard redirect: `dettaglio` → `../dati` se no risultati; `chiudi` → `../offerte` se no `trattativaOfferta`. `data-testid="analisi-dettaglio"` e `"analisi-chiudi"` aggiunti. `clientmode-leak.test.tsx` refactored: contesto mutabile via `mockCtx` per ConfrontoDettagliatoView. Maxi overlay preservato. (81/3/0).
- (WU2c) Stepper visivo route-synced. `stepperModel.ts` (pura: `getStepperModel(pathname, hasRisultati, hasTrattativa)` → `{ visible, steps }`). `AnalisiStepper.tsx` (presentational: 4 step orizzontali, connettori, numero/spunta, tenant accent via `useTenantBranding`). Montato come primo figlio in `AnalisiCockpit`. `visible=false` su `/presenta`. Completed steps mostrano checkmark e accent subtile. `stepperModel.test.ts`: 5 unit test puri, no DOM. (86/3/0).

---

## Log sessioni

| Data | WU toccati | Commit | Esito |
|------|------------|--------|-------|
| 23 giu 2026 | — (tracker creato) | 4a7075d | baseline |
| 23 giu 2026 | WU1 | ce80abc | split AnalisiCockpit → AnalisiSetup + AnalisiOfferte; 79/3/0 ✅ |
| 23 giu 2026 | WU2a | 563a87c | tab board route-driven (Board layout + Outlet + StoricoRoute); 79/3/0 ✅ |
| 23 giu 2026 | WU2b | a404647 | route analisi dati/offerte/presenta; AnalisiCtx via Outlet; showResults/presentationMode → navigate; leak-test esteso a PresentazioneView; 81/3/0 ✅ |
| 24 giu 2026 | WU2b-2 | dd55ca7 | route dettaglio+chiudi; ConfrontoDettagliatoView+TrattativaView → useOutletContext; AnalisiCtx +ctes/clientMode/showProvvigioni/trattativaOfferta; leak-test refactored mockCtx; 81/3/0 ✅ |
| 24 giu 2026 | WU2c | dc557cd | stepperModel.ts pura + AnalisiStepper.tsx (4 step, tenant accent, visible=false su /presenta) + montato in AnalisiCockpit; 5 unit test puri; 86/3/0 ✅ |
