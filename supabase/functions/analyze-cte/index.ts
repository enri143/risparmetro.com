import "jsr:@supabase/functions-js/edge-runtime.d.ts"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY") ?? ""

const PROMPT = `Sei un esperto di offerte energia italiano. Ti fornisco il PDF di una CTE (Condizioni Tecnico-Economiche).

Estrai i dati e rispondi SOLO con questo JSON (senza markdown, senza testo extra). Se il PDF contiene più offerte distinte, restituisci più elementi in "items".

{
  "items": [
    {
      "nome": "nome commerciale dell'offerta",
      "fornitore": "ragione sociale completa (es. 'Hera Comm S.p.A.', 'Acea Energia S.p.A.')",
      "tipo": "luce" | "gas",
      "segmento": "family" | "business",
      "tipo_prezzo": "fisso" | "index" | "hybrid",
      "prezzo_materia_prima": numero | null,
      "indice": "PUN" | "PSV" | null,
      "moltiplicatore_indice": numero,
      "spread": numero | null,
      "quota_fissa_mese": numero | null,
      "dispacciamento_extra_kwh": numero | null,
      "durata_mesi": numero | null,
      "prezzo_dopo_durata": "stringa" | null,
      "scadenza_sottoscrizione": "GG/MM/AAAA" | null,
      "componenti_venditore": [{ "label": "...", "valore": "..." }],
      "note": "stringa"
    }
  ]
}

REGOLE:

SEGMENTO: "casa"/"domestico"/"uso domestico" → "family". "lavoro"/"uso non domestico"/"aziende"/"partita IVA" → "business".

TIPO PREZZO:
- "fisso": prezzo energia fisso per tutta la durata, senza legame a indice di mercato.
- "index": prezzo indicizzato (PUN per luce, PSV per gas) più spread fisso.
- "hybrid": prezzo fisso ENTRO una soglia di consumo mensile + prezzo indicizzato (indice+spread) sull'eccedenza. Tipico nelle offerte "Hybrid" di Hera. tipo_prezzo="hybrid", prezzo_materia_prima = il prezzo fisso entro soglia, indice+spread = quelli dell'eccedenza. Aggiungi in componenti_venditore la riga soglia: {"label":"Soglia fisso","valore":"N Smc/mese (o kWh/mese)"}.

PREZZO MATERIA PRIMA: se fisso → prezzo fisso in €/kWh o €/Smc. Se hybrid → prezzo fisso della quota entro soglia. Se index → null.

MOLTIPLICATORE INDICE (default 1.0):
- Formula "PUN Index GME × 1,1 + X" o "1,1 × PUN + X" o "Indice PUN * 1,1" o "Valore Indice PUN × 1,1" → moltiplicatore_indice=1.1, spread=X. Aggiungi in componenti_venditore: {"label":"Moltiplicatore indice","valore":"×1.1 (perdite in formula)"}.
- Formula "PUNt * (1+λ)" con λ=10% o "perdite di rete 10%" → moltiplicatore_indice=1.1. In generale moltiplicatore_indice = 1+λ quando le perdite sono espresse dentro la formula del prezzo.
- Formula "PUN + X" → moltiplicatore_indice=1.0. NON aggiungere riga in componenti_venditore se il moltiplicatore è esattamente 1.
- Cattura sempre il coefficiente moltiplicativo dell'indice anche se chiamato "perdite di rete" o simile.
- Il CDISPD/CdispD generico (corrispettivo di dispacciamento ARERA) NON va in componenti_venditore se non itemizzato dal venditore con un valore numerico specifico.

SPREAD: somma SEMPRE tutte le componenti additive sopra l'indice presenti nella CTE.
Esempio: "Contributo consumi 0,0120 €/kWh + Commercializzazione al dettaglio 0,0400 €/kWh" → spread=0.0520.
Aggiungi in componenti_venditore una riga per ogni componente con il valore originale: {"label":"Contributo consumi","valore":"0.0120 €/kWh"}, {"label":"Comm. al dettaglio","valore":"0.0400 €/kWh"}.

QUOTA FISSA MESE (OBBLIGATORIA — non lasciare null se c'è un valore annuo nel PDF):
Il corrispettivo fisso annuo del venditore può chiamarsi in modi diversi. Riconoscili tutti come la stessa cosa:
- "Corrispettivo di commercializzazione", "Commercializzazione" (Acea: riga di tabella tipo "Commercializzazione 156,00 €/POD/anno")
- "Corrispettivo annuo" (Acea Flex/Fix: "Corrispettivo annuo 108,00 €/POD/anno")
- "CCV" / "Corrispettivo di Commercializzazione e Vendita" (Enel: "Quota fissa = CCV")
- "Commercializzazione e Vendita" / "Corrispettivo annuo: Commercializzazione e Vendita" (Plenitude, Edison)
- "Quota fissa", "Corrispettivo fisso"
Qualunque valore espresso in €/POD/anno, €/PDR/anno o €/anno è la quota fissa annua.
quota_fissa_mese = valore_annuo / 12 (arrotonda a 2 decimali).
Esempi: 180 €/anno → 15.00 ; 156 €/anno → 13.00 ; 144 €/anno → 12.00 ; 108 €/anno → 9.00 ; 174 €/anno → 14.50 ; 145.23 €/anno → 12.10.

SCAGLIONI PER CONSUMO (es. <300 Smc vs ≥300 Smc): usa il valore PIÙ BASSO e aggiungi in componenti_venditore: {"label":"Scaglioni comm.","valore":"<300 Smc: 120 €/anno, ≥300: 144 €/anno"}.

QUOTA DECRESCENTE NEL TEMPO (scaglioni temporali, es. anno 1/2/3): usa il valore del PRIMO periodo (1° anno) / 12. NON usare il più basso. Aggiungi in componenti_venditore: {"label":"Quota fissa a scalare","valore":"144→126→108 €/anno (anni 1/2/3)"}. Esempio: "144 €/PdR/anno per i primi 12 mesi; 126 dal 13° al 24°; 108 dal 25° mese" → quota_fissa_mese=12.00, componente con la scaletta completa.

NON confondere con "Contributo sui consumi" o "Commercializzazione al dettaglio" espressi in €/kWh o €/Smc: quelli sono componenti dello spread, non quota fissa.

DISPACCIAMENTO EXTRA: cattura in dispacciamento_extra_kwh SOLO i corrispettivi che il VENDITORE itemizza esplicitamente: TIDE, mercato della capacità. Sommali. Aggiungi in componenti_venditore una riga per ciascuno (es. {"label":"TIDE","valore":"0.01155 €/kWh"}, {"label":"Mercato capacità","valore":"0.005589 €/kWh"}). NON includere: reintegrazione salvaguardia, trasporto rete, oneri di sistema ARERA, accise, IVA. Se non itemizzati dal venditore → dispacciamento_extra_kwh=null, nessuna riga.

DURATA E RINNOVO:
- durata_mesi: durata del blocco prezzo in mesi dall'attivazione (24, 12, ecc.). null se non specificata.
- prezzo_dopo_durata: formula o descrizione del prezzo al termine della durata (spesso contiene "Parametro GO"). Catturala testualmente. null se non indicata. Aggiungi in componenti_venditore: {"label":"Prezzo dopo durata","valore":"<formula>"}.

SCADENZA SOTTOSCRIZIONE: la data entro cui il cliente deve sottoscrivere l'offerta, formato DD/MM/YYYY. Riconosci tutti questi pattern:
- "valida per le richieste sottoscritte entro il GG/MM/AAAA" (Hera) → prendi quella data.
- "VALIDA DAL GG/MM/AAAA AL GG/MM/AAAA" (Acea) → prendi la SECONDA data.
- "Validità dal GG/MM/AA al GG/MM/AA" (Edison) → prendi la SECONDA data.
- "valida dal GG/MM/AA al GG/MM/AA" (Plenitude) → prendi la SECONDA data.
- "Valida fino al GG/MM/AAAA" (Enel) → prendi quella data.
- Testo che indica solo una durata in mesi senza data di fine ("per il periodo di N mesi") → scadenza_sottoscrizione = null; metti N in durata_mesi.
Output sempre in formato DD/MM/YYYY. NON confondere mai la data di fine validità dell'offerta con la durata del blocco prezzo (12/24/36 mesi → durata_mesi).

TETTO MASSIMO PREZZO: se la CTE prevede un cap sul prezzo materia prima applicato dal venditore (es. "Qualora il Prezzo Gas dovesse essere superiore a 0,80 €/Smc, Enel applicherà al massimo tale valore"), aggiungi in componenti_venditore: {"label":"Tetto massimo prezzo","valore":"0.80 €/Smc"}. Catturalo sempre quando presente.

SCONTO CONDIZIONATO VENDITORE: se la CTE prevede uno sconto condizionato applicato dal venditore (es. "Sconto Domiciliazione 5% sul Corrispettivo Luce con addebito SEPA" oppure "-1 €/mese sulla quota fissa con domiciliazione bancaria"), aggiungi in componenti_venditore: {"label":"Sconto domiciliazione","valore":"5% materia prima (con SEPA)"} oppure {"label":"Sconto domiciliazione","valore":"-1 €/mese quota fissa (con SEPA)"}. IMPORTANTE: NON modificare prezzo_materia_prima né quota_fissa_mese: i campi base restano i valori di listino pieni. Lo sconto va solo come componente informativa.

COMPONENTI VENDITORE — regole di esclusione ASSOLUTA:
Includi SOLO corrispettivi definiti/applicati dal VENDITORE.
ESCLUDI SEMPRE (statali/regolati): reintegrazione salvaguardia art.25bis/25ter, descrizione metodologica delle perdite di rete, fonte/metodologia dell'indice (ICIS-HEREN, PCS, GME), valori storici PUN/PSV, fattori di conversione, codici offerta interni, riferimenti delibere ARERA, compensazione CO2, trasporto/distribuzione/oneri/accise/IVA.
Se nessuna voce rilevante → componenti_venditore=[].

NOTE: max 1 frase, solo info commerciale utile in trattativa (es. "Energia 100% rinnovabile certificata GO"). Niente codici, niente delibere, niente testo burocratico.

Numeri con punto decimale (non virgola). Nessun simbolo €. Valori assenti: null per numeri/stringhe, 1.0 per moltiplicatore_indice se non specificato.`

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders })
  }

  try {
    const { pdfBase64 } = await req.json()

    if (!pdfBase64 || typeof pdfBase64 !== "string") {
      return new Response(
        JSON.stringify({ error: "pdfBase64 obbligatorio" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      )
    }

    if (!ANTHROPIC_API_KEY) {
      return new Response(
        JSON.stringify({ error: "ANTHROPIC_API_KEY non configurata sulla edge function" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      )
    }

    const claudeRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 2048,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "document",
                source: { type: "base64", media_type: "application/pdf", data: pdfBase64 },
              },
              { type: "text", text: PROMPT },
            ],
          },
        ],
      }),
    })

    if (!claudeRes.ok) {
      const raw = await claudeRes.text()
      return new Response(
        JSON.stringify({ error: "claude_failed", status: claudeRes.status, raw }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      )
    }

    const claudeJson = await claudeRes.json()
    const text: string =
      (claudeJson?.content ?? [])
        .filter((b: { type: string }) => b.type === "text")
        .map((b: { text: string }) => b.text)
        .join("\n") ?? ""

    try {
      const clean = text.replace(/```json|```/g, "").trim()
      const parsed = JSON.parse(clean)
      const items = Array.isArray(parsed)
        ? parsed
        : Array.isArray(parsed?.items)
          ? parsed.items
          : parsed && typeof parsed === "object"
            ? [parsed]
            : []
      return new Response(
        JSON.stringify({ items }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      )
    } catch {
      return new Response(
        JSON.stringify({ error: "parse_failed", raw: text }),
        { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      )
    }
  } catch (err) {
    return new Response(
      JSON.stringify({ error: String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    )
  }
})
