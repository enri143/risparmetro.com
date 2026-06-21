# Board Migration: LuceGasVicenza → Risparmetro

> Analisi prodotta il 2026-06-21. Fonte: `/Users/enricobalsemin/Desktop/vicenza-energy-saver/src/`.
> NESSUNA modifica al codice finché il backlog non viene approvato.

---

## 1. Struttura `/board` LuceGasVicenza

```
pages/Board.tsx                          # Entry point — sessionStorage auth + long-press 1.2s
  ImpostazioniProvider                   # PUN/PSV/futures da tabella "impostazioni" (id=1)
  TabBar                                 # 3 tab: Analisi | Listino | Impostazioni
  AnalisiTab                             # Tab principale
    ├─ view: "calcolo" | "storico"
    ├─ ClienteForm                       # form dati cliente (tipi vecchi: types.ts)
    ├─ DraftBanner                       # "analisi non completata — riprendi?"
    ├─ Futures panel                     # toggle PUN/PSV +1/+2/+3 mesi da impostazioni
    ├─ NoteCliente (collapsible)         # nome / telefono / note libere agente
    ├─ [filtroTipo] luce | gas | entrambi
    ├─ toggle: Presentazione | Maxi | SG Energia | Provvigioni
    ├─ HeroRisparmio + BeforeAfterBar    # in modalità presentazione
    ├─ ClassificaOfferte                 # lista ordinata per risparmio
    │     ├─ FiltriRapidiChips          # filtri: fisso/var/solo-risparmio/verde
    │     ├─ ConfrontoModal             # modale confronto 2 offerte affiancate
    │     ├─ Proiezione12Mesi           # grafico risparmio proiettato 12 mesi
    │     └─ SimulazioneBolletta        # breakdown bolletta sintetica
    ├─ MaxiTrattativaPanel              # FULLSCREEN: numero +€365 enorme, swipe offerte
    └─ StoricoTab                       # lista analisi passate via edge fn board-storico
  ListinoTab                            # CRUD CTE + upload PDF
  ImpostazioniTab                       # PUN/PSV/futures edit + configurazione agente
  ModalitaAgenteSheet                   # drawer nascosto (long-press 1.2s sull'header)
```

**Auth lucegasvicenza**: `sessionStorage` con password hashata → redirect a `/board/login`.

**Auth Risparmetro**: Supabase Auth con RLS per-tenant → superiore.

---

## 2. Tabella classificazione pattern

| Pattern | LuceGasVicenza | Stato Risparmetro | Come adattare |
|---|---|---|---|
| **Auth** | sessionStorage password | ✅ Supabase Auth RLS (superiore) | — |
| **ImpostazioniProvider** | `impostazioni` singola riga (id=1) | ✅ identico | — |
| **TabBar** | 3 tab | ✅ identico | — |
| **AnalisiCockpit** | AnalisiTab con tipi `types.ts`+`calcoli.ts` | ✅ riscritto con `calcoloOfferte.ts`, zone ARERA, OCR, snapshot immutabili | Cockpit nuovo già più avanzato |
| **MaxiTrattativaPanel** | fullscreen +€ enorme, swipe tra top-5 | ❌ assente | **Portare** — adattare tipi: `risparmio` → `risparmio_annuo`, `cte.fornitore` → `fornitore_nome` |
| **StoricoTab** | edge fn `board-storico` + tipi vecchi | ❌ dead code con tipi incompatibili | **Reimplementare** — leggere da `simulazioni` con RLS, senza edge fn |
| **DraftBanner** | riprendere bozza non salvata | ❌ hook `useDraftAutosave` presente ma non usato in AnalisiCockpit | Collegare hook esistente |
| **NoteCliente** | collapsible nome/tel/note | ❌ assente in AnalisiCockpit | Aggiungere + passare a `simulazioni.dati_input` |
| **FiltriRapidiChips** | filtro quick: fisso/var/verde/risparmio | ❌ file presente, non usato in cockpit | Portare adattando `RisultatoOfferta` da `calcoloOfferte.ts` |
| **Proiezione12Mesi** | grafico risparmio 12 mesi | ❌ file presente, non usato | Portare — già self-contained, prop `risparmioAnno: number` |
| **Futures panel** | PUN/PSV +3 mesi toggle con selector mese | ❌ assente | Portare SE `impostazioni` ha i campi (verificare) |
| **showProvvigioni toggle** | mostra/nascondi commissioni | ❌ assente | Portare SOLO con `clientMode=false` — mai nel PDF |
| **NegotiationDiscount** | sconto trattativa in-memory % | ❌ hook presente, non wired | Considerare per P3 |
| **HeroRisparmio + BeforeAfterBar** | modalità presentazione grafica | ❌ file presenti, non usati | Già rimpiazzati da `PresentazioneView` (superiore) |
| **ConfrontoModal** | modale confronto 2 CTE | ❌ file presente, tipi sbagliati | Rimpiazzato da `ConfrontoDettagliatoView` (superiore) |
| **SimulazioneBolletta** | breakdown bolletta sintetica | ❌ file presente, non usato | Bassa priorità |
| **SG Energia toggle** | filtro fornitore specifico | 🚫 non applicabile | Multi-tenant: ogni tenant ha le proprie CTE |
| **CanoneRAI switch** | domestico: canone RAI on/off | ❌ assente in cockpit | Aggiungere come opzione opzionale domestico |
| **BrandingTab** | assente | ✅ unica di Risparmetro | — |
| **Salva simulazione** | assente | ✅ snapshot immutabile in `simulazioni` | — |
| **OCR bolletta** | assente | ✅ Gemini 2.5-flash + GPT-4o fallback | — |
| **Zone ARERA** | assente | ✅ parametri per regione da `parametri_regolati` | — |
| **componenti_regolate** | assente | ✅ ARERA luce da DB dal 2026-04-01 | — |

---

## 3. Gap analysis

### Funzionalità presenti in lucegasvicenza ma assenti in Risparmetro

| Gap | Impatto vendita | Complessità adattamento |
|---|---|---|
| `MaxiTrattativaPanel` — fullscreen "+€365" | 🔴 Alto — "wow moment" durante trattativa tablet | Bassa — soli 4 campi da rinominare |
| StoricoTab funzionante (da `simulazioni`) | 🔴 Alto — agente vede storico cliente | Media — riscrivere senza edge fn vecchia |
| `DraftBanner` — riprendere bozza | 🟡 Medio — UX, evita perdita dati | Bassa — hook già presente |
| NoteCliente (nome/tel/note) | 🟡 Medio — essenziale per storico utile | Bassa — aggiungere collapsible + salvare in `dati_input` |
| `FiltriRapidiChips` | 🟡 Medio — orientamento rapido in lista offerte | Media — adattare `RisultatoOfferta` |
| `Proiezione12Mesi` | 🟡 Medio — grafico visivo per il cliente | Molto bassa — prop singola |
| Futures panel | 🟠 Medio-basso — solo se agente usa prezzi forward | Media — verificare campi `impostazioni` |
| `showProvvigioni` toggle | 🟠 Medio-basso — solo in vista agente | Bassa — condizionato a `clientMode=false` |

### Funzionalità presenti in Risparmetro ma assenti in lucegasvicenza (vantaggio da preservare)

- Multi-tenant RLS completo
- Snapshot simulazioni immutabili in DB
- OCR bolletta Gemini+OpenAI
- `ConfrontoDettagliatoView` (più ricco di ConfrontoModal)
- `PresentazioneView` tablet-first
- `BrandingTab` + branding per-tenant
- Zone ARERA + `componenti_regolate`

---

## 4. Lista prioritizzata — top 8 da portare

### P1 — Alto impatto, basso rischio

**1. MaxiTrattativaPanel**
- File sorgente: `vicenza-energy-saver/src/components/board/analisi/MaxiTrattativaPanel.tsx`
- Adattamenti tipi richiesti:
  - `r.risparmio` → `r.risparmio_annuo`
  - `r.cte.fornitore` → `r.fornitore_nome`
  - `r.cte.nome` → `r.nome`
  - `r.cte.commercializzazione_anno / 12` → calcolare da `r.quota_fissa_anno / 12` (verificare campo)
  - Rimuovere `useShowIva` + `Impostazioni` se non mappabili al nuovo schema
- Wiring in `AnalisiCockpit`: aggiungere toggle "Modalità Maxi" nella action bar (accanto a `clientMode`)
- Dipendenze: `framer-motion` (verificare se già in package.json)

**2. StoricoTab — versione Risparmetro**
- Buttare il file attuale in `analisi/StoricoTab.tsx` (dead code, tipi `DatiCliente` incompatibili)
- Riscrivere: `supabase.from("simulazioni").select(...)` filtrato per-tenant via RLS automatica
- Mostrare: data, consumo, risparmio_annuo, offerta scelta, nome cliente (da `dati_input`)
- CTA "Ricarica": ripopola form `AnalisiCockpit` con i campi di `dati_input`
- Aggiungere `view: "calcolo" | "storico"` toggle in `AnalisiCockpit` (stesso pattern lucegasvicenza)

### P2 — Utile, adattamento medio

**3. DraftBanner**
- Hook `useDraftAutosave.ts` già in `src/hooks/` — non usato in `AnalisiCockpit`
- Adattare `DraftPayload` ai nuovi campi di `DatiCliente` da `calcoloOfferte.ts`
- Collegare: salva draft ogni N secondi sui campi form, mostra `DraftBanner` all'apertura

**4. NoteCliente collapsible**
- Aggiungere sezione collapsible nel form con: nome cliente, telefono, note libere
- Passare i valori all'insert `simulazioni.dati_input` in `handleSalvaSimulazione`
- Utile solo se `StoricoTab` li mostra (dipendenza soft da P1-2)

**5. FiltriRapidiChips**
- File presente in `analisi/FiltriRapidiChips.tsx` ma non usato in AnalisiCockpit
- Adattare: `RisultatoOfferta` da `calcoloOfferte.ts` ha `risparmio_annuo`, non `risparmio`
- Aggiungere sopra classifica luce e sopra classifica gas nei risultati

### P3 — Nice-to-have

**6. Proiezione12Mesi**
- File già presente in `analisi/Proiezione12Mesi.tsx`
- Quasi zero adattamento: prop `risparmioAnno: number` + eventuale prop `isDarkMode`
- Aggiungere dopo le classifiche nella sezione risultati

**7. Futures panel**
- Prerequisito: verificare se `impostazioni` table ha campi `pun_futures_1/2/3`, `psv_futures_1/2/3`, `futures_mese_1/2/3`, `futures_updated_at`
- Se sì: portare il toggle così com'è da `AnalisiTab.tsx`
- Se no: prima migration che aggiunge i campi, poi il pannello

**8. showProvvigioni toggle**
- Aggiungere nella action bar di `AnalisiCockpit` SOLO quando `clientMode === false`
- Passare `showProvvigioni` a `StandardOfferCard` per mostrare la riga provvigione
- **Vincolo invariante**: mai visibile con `clientMode=true`, mai nel PDF generato

---

## 5. Cosa NON toccare

| Vincolo | Motivazione |
|---|---|
| `src/lib/board/calcoloOfferte.ts` | Frozen by design — invariante di progetto |
| Interfaccia `onApply` di `UploadBollettaButton` | Contratto stabile tra OCR e cockpit |
| Tabella `parametri_regolati` per gas | Gas fuori scope dalla refactor ARERA |
| `analisi/AnalisiTab.tsx` (attuale) | Dead code con tipi incompatibili — non cablare, rimuovere a parte |
| `analisi/StoricoTab.tsx` (attuale) | Dead code — rimpiazzare, non riparare |
| Edge function `board-storico` | Non esiste in Risparmetro, non crearla — usare `simulazioni` RLS |
| `useSgProvvigioni` | Specifico lucegasvicenza (SG Energia), non applicabile |
| Query cross-tenant | Mai query che bypassano RLS o espongono dati tra tenant |
| Provvigioni nel DOM client-facing | Mai in `clientMode=true`, mai nel PDF |
| Snapshot simulazioni | Immutabili dopo salvataggio — non aggiornare, solo inserire |
| Branding white-label | Logo/colori/nome letti sempre da DB per-tenant, mai hardcoded |
