# Risparmetro — Build Plan

> Documento vivo. Aggiornato a ogni milestone di architettura.

## Fasi principali

| Fase | Contenuto |
|------|-----------|
| **A1** | Cockpit MVP — form + calcolo + confronto offerte |
| **A2** | Auth Supabase + multi-tenant reale |
| **A3** | PDF brandizzato |
| **A4** | Snapshot simulazioni + storico |
| **B1** | ClassificaOfferte (calcoli.ts) → migrazione viste al Motore B |
| **B2** | Golden test su calcoli.ts |
| **C1** | OCR bolletta (Edge Function) |
| **C2** | Cron PUN/PSV automatico |

---

## A1 — stato reale (giugno 2026)

### Invarianti architetturali implementati

**Invariante #3 — snapshot immutabili**: applicato. Il campo `dati_input` nel salvataggio simulazione contiene i prezzi materia e la quota fissa dell'offerta attuale del cliente, non la spesa annua aggregata. I risultati in `snapshot_offerte` sono calcolati al momento del salvataggio e non vengono ricalcolati.

**`spesa_annua_*` rimosso**: i campi `spesa_annua_luce` e `spesa_annua_gas` sono stati eliminati da `DatiCliente` (calcoloOfferte.ts). Al loro posto: `prezzo_materia_luce` (€/kWh), `quota_fissa_luce_mese` (€/mese), `prezzo_materia_gas` (€/Smc), `quota_fissa_gas_mese` (€/mese). La spesa annua viene derivata internamente dal motore come `prezzo × consumo + quota × 12`.

**Hard stop attivo**: se l'agente inserisce il consumo ma non il prezzo materia e la quota fissa dell'offerta attuale, il bottone "Trova offerta migliore" rimane disabilitato e compare il messaggio: *"Servono prezzo materia e quota fissa dell'offerta attuale del cliente per calcolare il risparmio reale. Senza, niente confronto."*

### File calcolo esistenti post-A1

| File | Ruolo |
|------|-------|
| `src/lib/board/calcoloOfferte.ts` | Motore A — calcolo confronto offerte, tipo `DatiCliente`, `RisultatoOfferta` vecchio |
| `src/lib/calcolo/parametriArera.ts` | Fetch parametri ARERA da `componenti_regolate_luce` |
| `src/lib/board/calcoli.ts` | Motore B — usato da ClassificaOfferte, ConfrontoModal, Proiezione12Mesi |
| `src/lib/board/types.ts` | Tipi Motore B |

### A1.7 — wrapper Motore B (giugno 2026)

- Motore di calcolo passato a `calcoli.ts` (`simulaBollettaLuce` / `simulaBollettaGas`); la firma `calcolaConfrontoOfferte` e i tipi legacy (`DatiCliente`, `RisultatoOfferta`, `CTE`) restano invariati per le viste.
- Firma legacy preservata: tutte le viste (Maxi\*, Trattativa\*, Confronto\*, Presentazione\*, Report\*, Analisi\*) continuano a compilare e funzionare senza modifiche.
- Golden test eliminati (saranno riscritti su Motore B in A1.8).

### A3 — Pannello ARERA (giugno 2026)

- CRUD completo su `componenti_regolate_luce` (INSERT/UPDATE/DELETE/SELECT).
- Gated da `is_platform_admin()` — hook `useIsPlatformAdmin`, tab "ARERA" appare solo ai platform_admin.
- Accessibile via Impostazioni → tab ARERA. RLS blocca scritture non-admin anche se la tab viene forzata.

### Prossimo step obbligatorio (A2)

Collegare Supabase Auth (email/password o magic link), mappare utente a tenant via `tenant_members`. Senza auth reale, le tabelle per-tenant restano vuote (RLS blocca tutto con chiave anon).
