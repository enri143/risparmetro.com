# D15 — Security Audit RLS: Esposizione Provvigioni e Isolamento Tenant

**Data:** 23 giugno 2026  
**Scope:** read-only (zero modifiche a codice/schema)  
**Invariante da proteggere:** "Le provvigioni NON devono mai essere leggibili pubblicamente. Isolamento via `current_tenant_id()`. Mai query che facciano trapelare dati tra tenant."

---

## 1. Colonne sensibili su `cte`

Le seguenti colonne sono considerate sensibili (agente-only):

| Colonna | Tipo | Classificazione |
|---------|------|----------------|
| `provvigione_override` | `numeric(10,2)` | Provvigione — mai al cliente |
| `provvigione_tipo` | `provvigione_tipo` | Provvigione — mai al cliente |
| `mesi_storno_rischio` | `int` | Provvigione — mai al cliente |
| `script_apertura` | `text` | Semi-sensibile (script vendita) |
| `obiezioni_comuni` | `jsonb` | Semi-sensibile (battle card) |
| `target_note` | `text` | Semi-sensibile |
| `componenti_venditore` | `jsonb` | Aggiunto in `20260622100000` — componenti custom del broker |

---

## 2. Copertura RLS — tabella completa

| Tabella | RLS enabled | Politica SELECT | Cross-tenant leak |
|---------|------------|-----------------|-------------------|
| `tenants` | ✅ | `authenticated` + `current_tenant_id()` o `is_platform_admin()` | Bloccato |
| `tenant_members` | ✅ | `authenticated` + `current_tenant_id()` o `is_platform_admin()` | Bloccato |
| `cte` | ✅ | `authenticated` + `current_tenant_id()` | Bloccato |
| `clienti` | ✅ | `authenticated` + `current_tenant_id()` | Bloccato |
| `simulazioni` | ✅ | `authenticated` + `current_tenant_id()` | Bloccato |
| `tenant_branding` | ✅ | `authenticated` + `current_tenant_id()` o `is_platform_admin()` | Bloccato |
| `fornitori` | ✅ | SELECT a `authenticated using (true)` — globale read-only | N/A (dati pubblici) |
| `mercato_prezzi` | ✅ | SELECT a `authenticated using (true)` | N/A (dati pubblici) |
| `zone_territoriali` | ✅ | SELECT a `authenticated using (true)` | N/A (dati pubblici) |
| `componenti_regolate` | ✅ | SELECT a `authenticated using (true)`; write solo `is_platform_admin()` | N/A |
| `componenti_regolate_luce` | ✅ | SELECT a `authenticated using (true)`; write solo `is_platform_admin()` | N/A |
| `componenti_regolate_gas` | ✅ | SELECT a `authenticated using (true)`; write solo `is_platform_admin()` | N/A |
| `platform_admins` | ✅ | Tutte le operazioni solo `is_platform_admin()` | Bloccato |
| Storage `bollette` | ✅ | Select/write isolato per path `{tenant_id}/…` | Bloccato |
| Storage `brand-assets` | ✅ | **SELECT pubblico** (nessuna auth); write solo `authenticated` + path `{tenant_id}/` | Intenzionale — logo pubblico |

**Nessuna policy `anon` su nessuna tabella.** Senza sessione Supabase, tutte le tabelle restituiscono 0 righe.

---

## 3. Chiamate `select(` in src/ — analisi dettagliata

### 3a. Chiamate che espongono colonne CTE (provvigioni incluse)

| File | Riga | Query | Esposizione |
|------|------|-------|-------------|
| `AnalisiCockpit.tsx` | 420 | `supabase.from("cte").select("*, fornitori(nome, colore)")` | Recupera TUTTE le colonne CTE incluse provvigioni |
| `ListinoTab.tsx` | 37 | `supabase.from("cte").select("*, fornitori(nome, colore)")` | Idem |

**Valutazione:** RLS su `cte` richiede `authenticated` + `current_tenant_id()`. Il broker legge SOLO le proprie CTE. Cross-tenant leak: impossibile per design DB. Ma le colonne vengono idrate nel client JS → se un componente non-agente le rendesse visibili sarebbe un bug UI, non un bug di sicurezza DB.

**Mitigazione raccomandata (D15 step 2):** sostituire `SELECT *` con la lista colonne effettivamente usata dalla UI, escludendo `provvigione_override`, `provvigione_tipo`, `mesi_storno_rischio`. In alternativa: dedicated view `cte_pubblico` (senza colonne provvigioni) per le query che non richiedono provvigioni.

### 3b. Altre chiamate `select(*)`

| File | Riga | Tabella | Rischio |
|------|------|---------|---------|
| `AreraTab.tsx` | 107 | `componenti_regolate_luce` | Basso — dati globali ARERA, non sensibili |
| `BrandingTab.tsx` | 305 | `tenant_branding` | Basso — dati propri, RLS corretto |
| `ImpostazioniContext.tsx` | 23 | `"impostazioni"` | **MEDIO** — tabella NON presente in nessuna migration |

### 3c. Tabelle "fantasma" (usate nel codice, assenti dalle migration)

| Tabella | File | Dettaglio |
|---------|------|-----------|
| `impostazioni` | `ImpostazioniContext.tsx:23` | `select("*").eq("id", 1).maybeSingle()` — schema e RLS sconosciuti |
| `sg_provvigioni` | `useSgProvvigioni.ts:75` | `select("*")` su tabella non in migration; errori silenziatiatamente con `try/catch → setMap({})` |

**`sg_provvigioni`:** questo hook carica gli scaglioni provvigioni per le CTE SG (offerte a scaglione di consumo). La tabella non è mai stata migrata. Attualmente inerte (query fallisce silenziosamente). **Rischio futuro:** se la tabella viene creata senza RLS, esporrebbe dati di provvigione a tutti i tenant autenticati. Priorità: alta se si implementa questa feature.

---

## 4. Gate UI provvigioni — verifica

| Punto | File | Verifica |
|-------|------|---------|
| Vista agente toggle | `ConfrontoDettagliatoView.tsx` | Gate: `!clientMode && showProvvigioni` ✅ |
| `clientMode=true` override | `ConfrontoDettagliatoView.tsx` | clientMode blocca SEMPRE, indipendente da `showProvvigioni` ✅ |
| Test leak guard | `clientmode-leak.test.tsx` | 5 test cases, incluso `clientMode=false + showProvvigioni=false` ✅ |
| PresentazioneView (vista cliente) | `PresentazioneView.tsx` | Zero provvigioni, zero import di colonne sensibili ✅ |
| PDF | `src/lib/pdf/ReportPDF.tsx` | Zero provvigioni, zero colonne provvigione nel tipo `RisultatoOfferta` passato ✅ |
| `MaxiTrattativaPanel.tsx` | `MaxiTrattativaPanel.tsx:78` | Seleziona solo `accent_color, logo_url, brand_name` ✅ |

---

## 5. Bundle — scan segreti

| Check | Risultato |
|-------|-----------|
| `service_role` nel bundle | ✅ Non trovato |
| JWT token completo (eyJ…) nel bundle | ✅ Non trovato (anon key non iniettata oppure pattern encoding diverso) |
| URL progetto Supabase nel bundle | ⚠️ Presente (`yrwjsztbibhnrlbvkayh`) — **atteso e accettabile** (endpoint pubblico) |
| Chiave anon in `.env` | Presente come `VITE_SUPABASE_PUBLISHABLE_KEY` e `VITE_SUPABASE_ANON_KEY` — chiave pubblica per design |

**Conclusione bundle:** nessuna chiave privilegiata esposta. La anon key, anche se embeddata, è by-design (Supabase RLS model).

---

## 6. Storage `brand-assets` — nota

La policy `brand_assets_public_read` permette `SELECT` senza autenticazione su tutto il bucket. Intenzionale: i logo dei broker devono essere accessibili pubblicamente per il PDF e per eventuali pagine cliente. **Non è un bug.** Da documentare nel onboarding tenant: non caricare in questo bucket file privati.

---

## 7. Riepilogo rischi e raccomandazioni (D15 step 2)

| # | Rischio | Gravità | Raccomandazione |
|---|---------|---------|-----------------|
| R1 | `SELECT *` su `cte` idrata colonne provvigioni nel client JS | BASSO | Colonne narrow: escludere `provvigione_*`, `mesi_storno_rischio` dalle query non-provvigioni |
| R2 | Tabella `impostazioni` senza migration né RLS noti | MEDIO | Aggiungere migration con RLS, oppure rimuovere riferimento se non usata |
| R3 | Tabella `sg_provvigioni` senza migration né RLS | MEDIO-ALTO | Prima di creare la tabella: migration con RLS `current_tenant_id()` obbligatoria |
| R4 | `brand-assets` pubblica in lettura | INFO | Intenzionale; documentare nel onboarding |
| R5 | `B8 StoricoTab` pianificata prima di R1/R3 risolti | ALTO | Implementare B8 DOPO aver eseguito D15 step 2 |

---

*Audit condotto in modalità read-only. Nessuna modifica a codice o schema.*
