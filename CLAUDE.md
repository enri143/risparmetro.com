# CLAUDE.md — Risparmetro

> File di contesto per Claude Code. Leggilo prima di ogni sessione.
> Lingua di lavoro: **italiano**.

## Cos'è Risparmetro

SaaS **white-label multi-tenant** per broker/consulenti energia indipendenti e
piccole agenzie (2–10 agenti).

**Differenziatore (la nicchia):** **tablet-first sales cockpit**. Il broker apre
l'iPad davanti al cliente in casa, gira lo schermo e mostra confronto offerte +
risparmio con UI premium. **Non** è un tool da scrivania.

**Wow moment:** il broker trascina la bolletta del cliente → in ~8 secondi vede
confronto + PDF brandizzato con il risparmio annuo evidenziato e il logo della
sua agenzia.

## Stack

- Vite + React + TypeScript
- Tailwind v4 (`@tailwindcss/vite`)
- shadcn/ui (componenti base già installati)
- Supabase (DB + Auth + Storage); progetto `yrwjsztbibhnrlbvkayh`
- Deploy: Vercel
- Editing: Claude Code (NON Lovable su questo progetto)
- Repo: `enri143/risparmetro.com` (privata) · Dominio: `risparmetro.com`

## Principi non negoziabili

1. **Tablet-first.** Bottoni touch ≥ 44px, niente Cmd+K, niente dipendenza
   dall'hover, niente menu densi. Due modalità: **"demo cliente"** (pulita, da
   girare verso il cliente) e **"agente"** (completa, con provvigioni e note).
2. **Multi-tenant con RLS fin dall'inizio.** Ogni tabella dati ha `tenant_id`.
   Isolamento via `current_tenant_id()` (vedi migration). Mai query che possano
   far trapelare dati tra tenant. Le provvigioni **non** devono mai essere
   leggibili pubblicamente (lezione dall'audit del progetto precedente).
3. **Snapshot immutabili.** Le `simulazioni` congelano i prezzi al salvataggio
   in `snapshot_offerte`. Non si ricalcola una simulazione vecchia con prezzi
   nuovi. `tenants.live_pricing_enabled` è il flag per la futura modalità live.
4. **Modifiche additive.** Sul `/board` e sulla logica di calcolo: aggiungere,
   non rompere. Niente refactor distruttivi senza richiesta esplicita.
5. **Design Attio-inspired.** Light-first, font Inter, accent indaco/viola,
   spacing generoso, bordi 1px, niente ombre pesanti, niente gradient, niente
   emoji. (Da finalizzare con moodboard Attio + Linear.)

## Decisioni di prodotto (congelate)

| # | Tema | Scelta |
|---|------|--------|
| 1 | Segmento cliente | Residenziale + business (micro/PMI), `codice_ateco` opzionale |
| 2 | Provvigioni | Per CTE, con default ereditabile dal fornitore |
| 3 | Logo PDF | Logo fisso del tenant + override opzionale per CTE |
| 4 | Multi-utente | Single-user MVP; schema `tenant_members` pronto per dopo |
| 5 | Storico simulazioni | Snapshot di default; flag `live_pricing_enabled` per il futuro |
| 6 | Parametri regolati | Per **zona ARERA** (6 elettriche / 6 ambiti gas), non per regione |
| 7 | Prezzi mercato | Tabella serie temporale `mercato_prezzi`, popolata a mano; cron in fase 4 |
| 8 | Pannello admin | `platform_admins` separato, route `/admin` |

## Schema database

Vedi `supabase/migrations/20260620120000_init_risparmetro.sql`.

**GLOBALI (read-only per i tenant, scrittura solo admin):** `fornitori`,
`mercato_prezzi`, `parametri_regolati`, `zone_territoriali`.

**PER-TENANT (isolati via RLS):** `tenants`, `tenant_members`, `cte`,
`clienti`, `simulazioni`.

**Piattaforma:** `platform_admins`.

Helper RLS: `current_tenant_id()` e `is_platform_admin()` (security definer).

## Auth — stato e regola

- **Attuale:** `/board/login` usa password locale `energia2026` (provvisoria).
- **Regola:** la RLS si basa su `auth.uid()`. Con la sola chiave anon e senza
  sessione Supabase, le tabelle per-tenant tornano **0 righe**.
- **Prossimo step obbligatorio:** collegare Supabase Auth (email/password o
  magic link), mappare l'utente a un tenant via `tenant_members`, poi eseguire
  il blocco BOOTSTRAP in fondo alla migration. Solo allora il `/board` legge le
  CTE.

## Struttura repo (sintesi)

```
src/
  lib/board/          # logica calcolo offerte (portata dal vecchio progetto)
  components/board/   # UI del cockpit
  hooks/useLongPress.ts
  pages/
    Board.tsx
    BoardLogin.tsx
supabase/
  migrations/         # 20260620120000_init_risparmetro.sql
.env                  # VITE_SUPABASE_URL, VITE_SUPABASE_PUBLISHABLE_KEY
```

## Comandi

```bash
npm run dev            # dev server (localhost:5175)
npm run build          # build di produzione (deve passare con 0 errori)
npx supabase db push   # applica le migration al progetto remoto
```

## Cosa NON fare adesso

- Edge functions (OCR bolletta, analyze-cte) → fase successiva, nuovo Supabase.
- Cron PUN/PSV automatico → fase 4 (ora seed a mano).
- PDF brandizzato → quando la UI del board è pronta.
- Ricreare l'auth a password locale come soluzione definitiva.

## Glossario

- **CTE** — Condizioni Tecnico-Economiche: una singola offerta del broker.
- **Tenant** — il broker/agenzia (cliente del SaaS).
- **PUN / PSV** — indici di riferimento prezzo energia elettrica / gas.
- **Ambito / zona** — raggruppamento territoriale ARERA per le tariffe regolate.
- **Storno** — recesso/annullamento contratto che azzera o riprende la provvigione.
