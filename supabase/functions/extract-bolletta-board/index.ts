// extract-bolletta-board
import "jsr:@supabase/functions-js/edge-runtime.d.ts"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY")!
const GEMINI_MODEL = Deno.env.get("GEMINI_MODEL") || "gemini-2.5-flash"
const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY") ?? ""
const OPENAI_VISION_MODEL = Deno.env.get("OPENAI_VISION_MODEL") || "gpt-4o"

const EXTRACTION_PROMPT = `Sei un esperto di bollette italiane luce e gas. Devi estrarre TUTTI i dati necessari per
ricalcolare la bolletta di un cliente in un comparatore offerte.

ESTRAI questi campi nello schema esatto:

{
  "tipo": "luce" | "gas" | "dual",
  "segmento": "family" | "business",
  "residente": boolean | null,
  "canone_rai": boolean | null,
  "fornitore_attuale": string,
  "nome_offerta": string | null,

  "luce": {
    "potenza_impegnata_kw": number,
    "consumo_annuo_kwh": number,
    "prezzo_materia_kwh": number,
    "fisso_mese_eur": number,
    "tipo_contatore": "monorario" | "fasce",
    "consumi_fasce_annui": { "f1_kwh": number, "f2_kwh": number, "f3_kwh": number } | null,
    "prezzi_fasce": { "f1_eur_kwh": number, "f2_eur_kwh": number, "f3_eur_kwh": number } | null
  } | null,

  "gas": {
    "consumo_annuo_smc": number,
    "prezzo_materia_smc": number,
    "fisso_mese_eur": number
  } | null,

  "confidence": number,
  "note": string
}

REGOLE CRITICHE:

1. CONSUMO ANNUO: NON usare il consumo del periodo (es. 366 kWh bimestrali).
   Cerca SEMPRE il valore annuo in box tipo "Consumo annuo dal X al Y: 2.743 kWh"
   o ricostruiscilo sommando lo storico 12 mesi.

2. PREZZO MATERIA LUCE: somma di
   (Corrispettivo Energia × 1,1 perdite) + Dispacciamento variabile − Sconto Domiciliazione × 1,1.
   Se trovi voce sintetica "Spesa per la vendita di energia elettrica" in €/kWh, usa quella direttamente.

3. FISSO MESE LUCE: somma di commercializzazione fissa €/mese + componente dispacciamento parte fissa €/mese.
   NON includere quota fissa rete (è ARERA, uguale per tutti).

4. CONSUMI FASCE: anche se la bolletta del cliente è MONORARIA, se trovi storico
   consumi annui suddivisi per F1/F2/F3 estraili comunque, servono per consigliare se passare a fasce.

5. POTENZA: cerca "Potenza Impegnata" (non "Disponibile"). Es: 5 kW.

6. SEGMENTO: "domestico residente" → family + residente=true.
   "domestico non residente" → family + residente=false.
   "altri usi" / "P.IVA" / "non domestico" → business.

7. CANONE RAI: se vedi "Canone di abbonamento alla televisione per uso privato" con importo > 0 → canone_rai=true.

8. DECIMALI: usa il punto (0.16, non 0,16).

9. CONFIDENCE: < 0.5 se manca consumo annuo o prezzo materia.

10. NOTE: scrivi SEMPRE da dove hai estratto ogni campo principale.

Restituisci SOLO JSON valido (no markdown, no backtick, no commenti).`

const ipHits = new Map<string, number[]>()
function rateLimited(ip: string): boolean {
  const now = Date.now()
  const window = 60 * 60 * 1000
  const arr = (ipHits.get(ip) || []).filter((t) => now - t < window)
  if (arr.length >= 30) return true
  arr.push(now)
  ipHits.set(ip, arr)
  return false
}

async function callGemini(base64: string, mime: string) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`
  const body = {
    contents: [
      { parts: [{ text: EXTRACTION_PROMPT }, { inline_data: { mime_type: mime, data: base64 } }] },
    ],
    generationConfig: { response_mime_type: "application/json", temperature: 0.1 },
  }
  const r = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
  const text = await r.text()
  if (!r.ok) throw new Error(`gemini ${r.status}: ${text.slice(0, 400)}`)
  const json = JSON.parse(text)
  const out = json?.candidates?.[0]?.content?.parts?.[0]?.text
  if (!out) throw new Error(`gemini empty: ${text.slice(0, 200)}`)
  return JSON.parse(out)
}

async function callOpenAI(base64: string, mime: string) {
  if (mime === "application/pdf") {
    const body = {
      model: OPENAI_VISION_MODEL,
      input: [
        {
          role: "user",
          content: [
            { type: "input_text", text: EXTRACTION_PROMPT },
            { type: "input_file", filename: "bolletta.pdf", file_data: `data:application/pdf;base64,${base64}` },
          ],
        },
      ],
      text: { format: { type: "json_object" } },
    }
    const r = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: { Authorization: `Bearer ${OPENAI_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
    const text = await r.text()
    if (!r.ok) throw new Error(`openai ${r.status}: ${text.slice(0, 400)}`)
    const json = JSON.parse(text)
    const out =
      json?.output_text ||
      json?.output?.[0]?.content?.[0]?.text ||
      json?.choices?.[0]?.message?.content
    if (!out) throw new Error(`openai empty: ${text.slice(0, 200)}`)
    return JSON.parse(out)
  }

  const body = {
    model: OPENAI_VISION_MODEL,
    messages: [
      {
        role: "user",
        content: [
          { type: "text", text: EXTRACTION_PROMPT },
          { type: "image_url", image_url: { url: `data:${mime};base64,${base64}` } },
        ],
      },
    ],
    response_format: { type: "json_object" },
    temperature: 0.1,
  }
  const r = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${OPENAI_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
  const text = await r.text()
  if (!r.ok) throw new Error(`openai ${r.status}: ${text.slice(0, 400)}`)
  const json = JSON.parse(text)
  const out = json?.choices?.[0]?.message?.content
  if (!out) throw new Error(`openai empty: ${text.slice(0, 200)}`)
  return JSON.parse(out)
}

async function extractWithFallback(base64: string, mime: string) {
  let geminiError: string | null = null
  try {
    const result = await callGemini(base64, mime)
    return { result, provider: "gemini" as const }
  } catch (e) {
    geminiError = (e as Error).message
    console.warn("[extract-bolletta-board] gemini failed:", geminiError)
  }
  try {
    const result = await callOpenAI(base64, mime)
    return { result, provider: "openai" as const }
  } catch (e) {
    throw new Error(`gemini: ${geminiError} | openai: ${(e as Error).message}`)
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders })
  try {
    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      req.headers.get("cf-connecting-ip") ||
      "unknown"
    if (rateLimited(ip)) {
      return new Response(JSON.stringify({ error: "rate_limited" }), {
        status: 429,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    const { file_base64, mime_type } = await req.json()
    if (!file_base64 || !mime_type) {
      return new Response(JSON.stringify({ error: "file_base64 and mime_type required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }
    if (!mime_type.startsWith("image/") && mime_type !== "application/pdf") {
      return new Response(JSON.stringify({ error: "unsupported mime" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    const { result, provider } = await extractWithFallback(file_base64, mime_type)
    return new Response(
      JSON.stringify({ ok: true, extracted: result, provider, raw: { source: provider } }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    )
  } catch (e) {
    console.error("[extract-bolletta-board] error:", e)
    return new Response(JSON.stringify({ ok: false, error: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  }
})
