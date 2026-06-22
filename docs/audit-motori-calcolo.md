# Audit motori di calcolo — board

> Data: 2026-06-22

## Due sistemi paralleli

| Sistema | File core | Tipi | Usato da |
|---------|-----------|------|---------|
| **Motore A** (vecchio) | `src/lib/board/calcoloOfferte.ts` | `CTE`, `DatiCliente`, `ParametriRegolati`, `RisultatoOfferta` (calcoloOfferte) | AnalisiTab, AnalisiCockpit, TrattativaView, ConfrontoDettagliatoView, MaxiTrattativaPanel, PresentazioneView, generateReport, ReportPDF |
| **Motore B** (nuovo) | `src/lib/board/calcoli.ts` | `CTE`, `DatiCliente`, `Impostazioni`, `RisultatoOfferta` (types.ts) | ClassificaOfferte, ConfrontoModal, Proiezione12Mesi |

I due sistemi coesistono. I loro tipi `RisultatoOfferta` e `CTE` sono **incompatibili** (diversi nomi e struttura dei campi).

---

## Parte 1 — Audit dei 9 file (Motore A)

### 1. `src/components/board/analisi/AnalisiTab.tsx`

| Colonna | Valore |
|---------|--------|
| **Funzione engine chiamata** | `calcolaConfrontoOfferte` da `calcoloOfferte.ts` (chiamata diretta) |
| **Sorgente parametri** | DB: `parametri_regolati` (via query Supabase diretta) + FALLBACK_LUCE/FALLBACK_GAS hardcoded nel file |
| **Campi RisultatoOfferta consumati** | `costo_annuo_totale`, `risparmio_annuo`, `risparmio_percentuale`, `nome`, `fornitore_nome`, `tipo_prezzo` |
| **Altre funzioni engine** | — |
| **Rischio migrazione** | **ALTO** — chiama direttamente il motore vecchio; dipende da parametri DB in formato vecchio; cambio engine qui cambia numeri visibili |

### 2. `src/components/board/AnalisiCockpit.tsx`

| Colonna | Valore |
|---------|--------|
| **Funzione engine chiamata** | Coordina: chiama `fetchParametriAreraLuce` poi passa parametri ad AnalisiTab |
| **Sorgente parametri** | `fetchParametriAreraLuce` (aggiornato a `componenti_regolate_luce`) + FALLBACK_LUCE inline |
| **Campi RisultatoOfferta consumati** | Nessuno direttamente — passa i risultati alle sottoview via props |
| **Altre funzioni engine** | `fetchParametriAreraLuce` da `src/lib/calcolo/parametriArera.ts` |
| **Rischio migrazione** | **BASSO** — già allineato al nuovo schema DB; il fetch è stato aggiornato nella sessione corrente |

### 3. `src/components/board/analisi/MaxiTrattativaPanel.tsx`

| Colonna | Valore |
|---------|--------|
| **Funzione engine chiamata** | Nessuna — riceve `RisultatoOfferta[]` pre-calcolato via props |
| **Sorgente parametri** | N/A |
| **Campi RisultatoOfferta consumati** | `risparmio_annuo`, `quota_fissa_annua`, `fornitore_nome`, `nome` |
| **Altre funzioni engine** | — |
| **Rischio migrazione** | **BASSO** — display puro; tutti i campi letti esistono in entrambi i formati (nota: `quota_fissa_annua` è attualmente 0 nell'engine) |

### 4. `src/components/board/TrattativaView.tsx`

| Colonna | Valore |
|---------|--------|
| **Funzione engine chiamata** | Nessuna — riceve `offerta: RisultatoOfferta` via props |
| **Sorgente parametri** | N/A |
| **Campi RisultatoOfferta consumati** | `costo_annuo_totale`, `risparmio_annuo`, `costo_materia_energia`, `quota_fissa_annua`, `fornitore_nome`, `nome`, `provvigione`, `provvigione_tipo`, `mesi_storno_rischio`, `durata_blocco_mesi` |
| **Altre funzioni engine** | `generateReport` (PDF) |
| **Rischio migrazione** | **MEDIO** — usa `costo_materia_energia` e `quota_fissa_annua` che sono attualmente 0 nel motore; la view mostra "€0,00" per il breakdown |

### 5. `src/components/board/ConfrontoDettagliatoView.tsx`

| Colonna | Valore |
|---------|--------|
| **Funzione engine chiamata** | Nessuna — riceve `r: RisultatoOfferta` via props |
| **Sorgente parametri** | Legge `parametriLuce.tide` e `parametriLuce.dispacciamento` (campi rimossi dal nuovo schema) |
| **Campi RisultatoOfferta consumati** | `risparmio_annuo`, `risparmio_percentuale`, `costo_annuo_totale`, `quota_fissa_annua`, `tipo_prezzo`, `durata_blocco_mesi`, `fornitore_nome`, `fornitore_colore`, `nome`, `provvigione`, `provvigione_tipo`, `mesi_storno_rischio` |
| **Altre funzioni engine** | `generateReport` (PDF) |
| **Rischio migrazione** | **MEDIO** — `parametriLuce.tide` e `parametriLuce.dispacciamento` sono undefined con il nuovo schema (accesso via `?.`, no crash; riga non renderizzata); `fornitore_colore` sarà undefined se adapter non lo recupera |

### 6. `src/components/board/PresentazioneView.tsx`

| Colonna | Valore |
|---------|--------|
| **Funzione engine chiamata** | Nessuna — riceve risultati via props |
| **Sorgente parametri** | Legge `parametriLuce?.iva` e `parametriGas?.iva` (campo `iva` esiste ancora in `ParametriRegolati` per retrocompat gas) |
| **Campi RisultatoOfferta consumati** | `risparmio_annuo`, `costo_annuo_totale`, `nome` |
| **Altre funzioni engine** | — |
| **Rischio migrazione** | **BASSO** — campi letti esistono; `iva` retrocompat presente nel nuovo schema |

### 7. `src/lib/pdf/generateReport.ts`

| Colonna | Valore |
|---------|--------|
| **Funzione engine chiamata** | Nessuna — riceve `RisultatoOfferta[]` pre-calcolato e passa a ReportPDF |
| **Sorgente parametri** | N/A |
| **Campi RisultatoOfferta consumati** | Passa tutto l'array a `ReportPDF` |
| **Altre funzioni engine** | — |
| **Rischio migrazione** | **BASSO** — wrapper puro, non calcola |

### 8. `src/lib/pdf/ReportPDF.tsx`

| Colonna | Valore |
|---------|--------|
| **Funzione engine chiamata** | Nessuna — riceve `RisultatoOfferta` via props |
| **Sorgente parametri** | N/A |
| **Campi RisultatoOfferta consumati** | `costo_materia_energia`, `costo_trasporto`, `costo_oneri`, `costo_accise`, `iva`, `quota_fissa_annua`, `sconti`, `costo_annuo_totale`, `risparmio_annuo`, `risparmio_percentuale`, `fornitore_nome`, `nome`, `tipo_prezzo` |
| **Altre funzioni engine** | — |
| **Rischio migrazione** | **ALTO** — renderizza tutti i campi breakdown che sono attualmente 0; il PDF mostra righe vuote/zero per materia, trasporto, oneri, accise, IVA, quota fissa |

### 9. `src/lib/calcolo/parametriArera.ts`

| Colonna | Valore |
|---------|--------|
| **Funzione engine chiamata** | Query Supabase a `componenti_regolate_luce` (luce) e `componenti_regolate` (mercato) |
| **Sorgente parametri** | DB diretto |
| **Campi RisultatoOfferta consumati** | N/A — produce `ParametriRegolati` |
| **Altre funzioni engine** | — |
| **Rischio migrazione** | **BASSO** — aggiornato nella sessione corrente al nuovo schema; produce tutti i campi richiesti da `calcolaCostoLuce` |

---

## Parte 2 — File che usano calcoli.ts (Motore B)

Questi file sono **sistema separato**: usano `RisultatoOfferta` da `types.ts` (non da `calcoloOfferte.ts`). Non sono intercambiabili con il Motore A.

| File | Funzione calcoli.ts | Campi letti |
|------|---------------------|-------------|
| `ClassificaOfferte.tsx` | `classificaCTE` | `cte`, `costoOfferta`, `costoCliente`, `risparmio`, `risparmioPct`, `prezzoEffettivo`, `prezziPerFascia`, `cte.commercializzazione_anno` |
| `ConfrontoModal.tsx` | `simulaBollettaLuce`, `simulaBollettaGas` | `cte`, `risparmio` (da classificaCTE) |
| `Proiezione12Mesi.tsx` | `simulaBollettaLuce`, `simulaBollettaGas` | `costoOfferta`, `costoCliente` (da classificaCTE) |

---

## Parte 3 — Gap analysis: campi `RisultatoOfferta` vecchio vs nuovo

Campi del vecchio `RisultatoOfferta` (calcoloOfferte.ts) e loro equivalente in `calcoli.ts`:

| Campo vecchio | Equivalente calcoli.ts | Note |
|---|---|---|
| `cte_id` | `r.cte.id` | mapping diretto |
| `nome` | `r.cte.nome` | mapping diretto |
| `fornitore_nome` | `r.cte.fornitore` | rename del campo |
| `fornitore_colore` | **MANCANTE** | non in `types.ts CTE` — recuperare dal CTE vecchio in input |
| `tipo_prezzo` | `r.cte.tipo_prezzo` (fisso/index) | enum mapping: index → indicizzato |
| `durata_blocco_mesi` | **MANCANTE** | non in `types.ts CTE` — recuperare dal CTE vecchio in input |
| `costo_materia_energia` | `sim.dettaglioMateria.corrispettivo × 12` | via `simulaBollettaLuce/Gas` |
| `costo_trasporto` | `sim.spesaTrasporto × 12` | via `simulaBollettaLuce/Gas` |
| `costo_oneri` | `sim.spesaOneri × 12` | via `simulaBollettaLuce/Gas` |
| `costo_accise` | `sim.dettaglioImposte.accise × 12` | via `simulaBollettaLuce/Gas` |
| `imponibile` | **MANCANTE** | calcoli.ts non espone l'imponibile lordo |
| `iva` | `sim.dettaglioImposte.iva × 12` | via `simulaBollettaLuce/Gas` |
| `quota_fissa_annua` | `cte.commercializzazione_anno` | = `quota_fissa_luce/gas × 12` |
| `sconti` | **MANCANTE** | sconti RID/fattura-el non modellati in `types.ts CTE` |
| `costo_annuo_totale` | `sim.totaleAnno + cdispd_anno` | cdispd non incluso in `totaleAnno` |
| `risparmio_annuo` | `spesaAttuale - costoTotale` | calcolato dall'adapter |
| `risparmio_percentuale` | `risparmio / spesaAttuale` | calcolato dall'adapter |
| `provvigione` | **MANCANTE** | non in `types.ts CTE` — recuperare dal CTE vecchio |
| `provvigione_tipo` | **MANCANTE** | recuperare dal CTE vecchio |
| `mesi_storno_rischio` | **MANCANTE** | recuperare dal CTE vecchio |
| `priorita` | **MANCANTE** | recuperare dal CTE vecchio |

**Campi breakdown attualmente 0 anche nel motore vecchio**: `costo_materia_energia`, `costo_trasporto`, `costo_oneri`, `costo_accise`, `imponibile`, `iva`, `quota_fissa_annua`, `sconti` — il motore vecchio (calcolaConfrontoOfferte) li setta tutti a 0 nel push. L'adapter può recuperarli via `simulaBollettaLuce/Gas`.

---

## Divergenze comportamentali note tra Motore A e Motore B

| Aspetto | Motore A (calcoloOfferte.ts) | Motore B (calcoli.ts) |
|---|---|---|
| **perdite_rete** | Applicate solo per `indicizzato`/`variabile` | Applicate sempre (anche per `fisso`) |
| **Accise esenzione luce** | Cumulate annue: `max(0, consumo_annuo − soglia×12)` | Per-mese full-or-nothing: `consumoMese > soglia ? aliquota×mese : 0` — cifre molto diverse per consumi ~2×soglia |
| **Gas CCR** | Non presente (`ccr_gas` non esiste) | Aggiunto al prezzo indicizzato gas (`psv + ccr_gas + spread`) |
| **Gas accise** | Scaglioni dettagliati per uso (riscaldamento/cottura/business) con aliquote 4.4%, 17.5%, 17%, 18.6% | Scaglioni semplificati a 2 livelli (`gas_accise_1_smc`, `gas_accise_2_smc`) + addizionale regionale |
| **IVA** | Annuale su imponibile totale | Mensile su subtotale mensile (stessa aliquota, piccolo delta di arrotondamento) |
| **cdispd_anno** | Incluso in `calcolaCostoLuce` | NON incluso in `simulaBollettaLuce.totaleAnno` — va aggiunto a parte |
