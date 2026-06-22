# Harness CI — audit

Branch: `chore/harness`
Data: 2026-06-22

## Cosa protegge questo harness

### 1. clientmode-leak (jsdom)
`src/components/board/clientmode-leak.test.tsx`

Verifica che `ConfrontoDettagliatoView` con `clientMode=true` non esponga
nel DOM parole chiave legate a provvigioni (`Provvigion`, `Condizioni Agente`)
né il valore numerico (€50) — nemmeno dopo aver espanso il pannello "Vedi Dettagli".

Casi coperti (3/3 pass):
- clientMode=true → no `/Provvigion/i`, no `/Condizioni Agente/i`
- clientMode=true → no match `/50,00/` nel textContent
- clientMode=false (agente) → `/Condizioni Agente/i` e `/Provvigion/i` presenti

### 2. parametriArera guard (no-silent-zero)
`src/lib/calcolo/parametriArera.guard.test.ts`

Verifica che `fetchParametriAreraLuce` lanci un errore esplicito (non torni
zeri silenti) quando mancano dati ARERA o di mercato.

Casi coperti (4/4 pass):
- `componenti_regolate_luce` → data null + error → throws `/componenti_regolate_luce/`
- `componenti_regolate_luce` → data null, no error → throws `/riga mancante/`
- mercato (`componenti_regolate`) → error → throws `/componenti_regolate/`
- entrambi presenti → ritorna parametri validi

### 3. File-lock pre-commit (Husky)
`.husky/pre-commit`

Blocca `git commit` se:
- Uno dei file frozen è in staging:
  - `src/lib/board/calcoloOfferte.ts`
  - `src/lib/board/calcoloOfferte.golden.test.ts`
  - `src/lib/board/calcoloOfferte.test.ts`
- Una migration esistente (`supabase/migrations/*`) viene modificata
  (solo file nuovi con timestamp sono permessi)
- La suite vitest esce con codice ≠ 0

### 4. RLS cross-tenant (scaffold — PART 2, non attivo)
`src/integrations/supabase/rls.cross-tenant.test.ts`

Tre `it.skip` che descrivono i test da implementare quando l'utente
autorizza la connessione al DB reale (PART 2). Non eseguire prima di
conferma esplicita.

## Gate di uscita

```
npm run build   → 0 errori TypeScript
npm run test    → 7/7 pass (3 clientmode-leak + 4 parametriArera.guard)
git commit      → pre-commit hook blocca file frozen / migration edit
```
