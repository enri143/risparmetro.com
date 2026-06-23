# Risparmetro — Build Plan

> Documento vivo. Aggiornato a ogni milestone di architettura.
> **Ultimo aggiornamento: 23 giugno 2026** — Motore B eliminato, Auth Supabase operativa, blocchi A/B/V/D avanzati.

---

## Invarianti architetturali

**Motore unico (frozen):** `src/lib/board/calcoloOfferte.ts` — Motore A, "parte contendibile". Nessun altro motore di calcolo esiste. `calcoli.ts` (ex Motore B) è stato eliminato in commit `8c373b5`.

**Snapshot immutabili:** `simulazioni.snapshot_offerte` (jsonb) congela i risultati al momento del salvataggio. Nessun ricalcolo di simulazioni storiche. `tenants.live_pricing_enabled` è flag per futura modalità live.

**RLS multi-tenant:** ogni tabella per-tenant usa `current_tenant_id()` + `auth.uid()`. Provvigioni mai leggibili pubblicamente. Isolamento cross-tenant verificato (D15).

**Tablet-first:** bottoni ≥ 44px, niente hover-dependency, due modalità agente/cliente.

---

## Fasi principali — avanzamento

Legenda: ✅ fatto · ⏳ da fare · 🟡 parziale · ⏸️ in attesa esterna · 💰 core value

### Blocco A — Motore + parametri

| Step | Stato | Note |
|------|-------|------|
| **A1** Cockpit MVP — form + calcolo + confronto offerte | ✅ | Motore A (`calcoloOfferte.ts`) unico e frozen. Tipi `DatiCliente`, `RisultatoOfferta` stabili. Hard stop attivo: se mancano prezzo materia + quota fissa, il bottone "Trova offerta migliore" resta disabilitato. |
| **A2** Golden test motore | ✅ | `calcoloOfferte.golden.test.ts` — oracolo reale, 6 casi (fisso/indicizzato luce+gas, dual, ordinamento, gate-guard). Fallisce su deviazione di 1 cent. |
| **A3** Pannello super-admin parametri ARERA | ✅ | CRUD `componenti_regolate_luce`, gated da `is_platform_admin()`. Tab ARERA in Impostazioni, RLS blocca scritture non-admin. |
| **A4** Edge function PUN/PSV automatico | ⏸️ | In attesa credenziali GME (`api.mercatoelettrico.org`). Ora seed a mano. |

### Blocco B — Sala vendita

| Step | Stato | Note |
|------|-------|------|
| **B5** Sezione Cliente (opzionale) | ✅ | Upsert `clienti`, link `cliente_id` su simulazione. |
| **B6** Toggle provvigioni agente-only | ✅ | `!clientMode && showProvvigioni`. Leak-test guard attivo. |
| **B7** Proiezione 12 mesi | ✅ | `proiezione.ts` puro TS + `Proiezione12Mesi.tsx` Recharts AreaChart, risparmio cumulato. |
| **B8** StoricoTab v2 | ✅ | Query diretta `simulazioni`, snapshot read-only (splitSnapshot + stripProvvigioni). Zero provvigioni. |
| **B9** 💰 PresentazioneView v2 / Salesboard | ✅ | Proiezione12Mesi + BeforeAfterCard (BarChart). Layout grid 2-col iPad landscape. Zero provvigioni. |
| **B10** 💰 OCR bolletta → autofill | ⏳ | `extract-bolletta-board` oggi è stub. Dipende da edge function. |
| **B11** 💰 PDF brandizzato per tenant | ✅ | Logo + accent bar + dati + risparmio. Durata bloccata in card. Footer "Preventivo valido fino al" (+30gg). |

### Blocco V — Co-pilot trattativa

| Step | Stato | Note |
|------|-------|------|
| **V1** "Gira il tablet" overlay | ✅ | Overlay risparmio gigante. |
| **V2** Tips/suggerimenti | ⏳ | Bloccato: contenuto da Enrico. |
| **V3** ObiezioniPanel | ✅ | 6 obiezioni con risposta, accordion locale. |
| **V4** ScalettaChiusuraPanel | ✅ | 6 step checklist + contatore x/N. |
| **V5** FrasiClosePanel | ✅ | 6 frasi con Copia (clipboard, 1.8s feedback). |
| **V6** 💰 Battle card competitor | ⏳ | Dipende da B10. |
| **V7** CompliancePanel | ✅ | 5 item checklist + banner verde a completamento. |
| **V8** Follow-up | ⏳ | Dipende da B5. |

Contenuti V3/V4/V5/V7 hardcoded come default. Editabilità per-tenant via jsonb deferita al blocco C.

### Blocco C — Multi-tenant SaaS

**Auth Supabase è già operativa:** login funzionante (`BoardLogin`), `useSession`, RLS `current_tenant_id()` attiva.

Quello che resta nel blocco C è l'**onboarding multi-tenant**, non l'auth:

| Step | Stato | Note |
|------|-------|------|
| **C12** Console super-admin | ⏳ | Gestione tenant dalla piattaforma. |
| **C13** 💰 Onboarding + white-label branding | ⏳ | Creazione tenant, upload logo, accent color, mapping utente↔tenant. |
| **C14** Inviti team + ruoli | ⏳ | `tenant_members` schema pronto, UI mancante. |

### Blocco D — Hardening

| Step | Stato | Note |
|------|-------|------|
| **D15** Audit RLS + narrow provvigioni | 🟡 | R1 ✅ narrow SELECT cte · R2 ✅ hook orfano rimosso · R3 ⏸️ tabella `impostazioni` globale-vs-tenant → blocco C. `rls.cross-tenant.test.ts` ha 3 `it.skip`. |
| **D16** Osservabilità (Sentry) | ⏳ | — |
| **D17** Dead-code cleanup | ✅ | Motore B eliminato · orfani rimossi (knip: 10 file + 5 dep) · GoTrueClient deduplicato. |
| **D18** QA tablet iPad reale | ⏳ | — |

### Blocco GAS / E — Espansione + Revenue

| Step | Stato | Note |
|------|-------|------|
| **GAS19** Scaglioni gas (Veneto) | ⏳ | Floating. |
| **E20** 💰 Billing | ⏳ | — |
| **E21** Deploy prod + dominio | ⏳ | — |
| **E22** Tenant 0 = lucegas | ⏳ | — |
| **E23** Primo broker esterno | ⏳ | — |

---

## Schema database — ruoli

**GLOBALI** (read-only per tenant, scrittura solo admin): `fornitori`, `mercato_prezzi`, `parametri_regolati`, `zone_territoriali`.

**PER-TENANT** (isolati via RLS): `tenants`, `tenant_members`, `cte`, `clienti`, `simulazioni`.

**PIATTAFORMA**: `platform_admins`.

Helper RLS: `current_tenant_id()` e `is_platform_admin()` (security definer).

---

## File calcolo — stato post-cleanup

| File | Ruolo | Stato |
|------|-------|-------|
| `src/lib/board/calcoloOfferte.ts` | Motore A — unico motore, confronto offerte | **frozen** |
| `src/lib/board/proiezione.ts` | Proiezione 12 mesi su Motore A | attivo |
| `src/lib/board/storico.ts` | splitSnapshot + stripProvvigioni | attivo |
| `src/lib/calcolo/parametriArera.ts` | Fetch parametri ARERA da DB | attivo |
| `src/lib/board/matchFornitore.ts` | Fuzzy match + slug resolve per fornitori | attivo |
| `src/lib/board/calcoli.ts` | **ELIMINATO** (Motore B, commit `8c373b5`) | — |
