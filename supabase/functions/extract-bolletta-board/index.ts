import "jsr:@supabase/functions-js/edge-runtime.d.ts"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY") ?? ""

const PROMPT = `Sei un sistema OCR specializzato in bollette energia italiane.
Analizza il documento allegato ed estrai questi campi in JSON puro (nessun markdown, nessun testo extra):
{
  "pod_pdr": "stringa o null",
  "consumo_annuo_kwh": numero o null,
  "consumo_annuo_smc": numero o null,
  "spesa_annua_totale": numero o null,
  "fornitore_attuale": "stringa o null",
  "tipo_fornitura": "luce" | "gas" | "dual" | null,
  "zona_arera": "stringa o null",
  "potenza_impegnata_kw": numero o null
}
Se un campo non è presente, usa null. Rispondi SOLO con il JSON.`

function uint8ArrayToBase64(bytes: Uint8Array): string {
  let binary = ""
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  return btoa(binary)
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders })
  }

  try {
    const contentType = req.headers.get("content-type") ?? ""
    if (!contentType.includes("multipart/form-data")) {
      return new Response(
        JSON.stringify({ error: "Richiesto multipart/form-data con campo 'file'" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      )
    }

    const formData = await req.formData()
    const file = formData.get("file") as File | null
    if (!file) {
      return new Response(
        JSON.stringify({ error: "Campo 'file' mancante" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      )
    }

    const bytes = new Uint8Array(await file.arrayBuffer())
    const base64 = uint8ArrayToBase64(bytes)
    const mimeType = file.type || "application/pdf"

    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{
            parts: [
              { text: PROMPT },
              { inlineData: { mimeType, data: base64 } },
            ],
          }],
          generationConfig: { temperature: 0, maxOutputTokens: 512 },
        }),
      },
    )

    if (!geminiRes.ok) {
      const raw = await geminiRes.text()
      return new Response(
        JSON.stringify({ error: "extraction_failed", raw }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      )
    }

    const geminiJson = await geminiRes.json()
    const text: string = geminiJson?.candidates?.[0]?.content?.parts?.[0]?.text ?? ""

    try {
      const clean = text.replace(/```json|```/g, "").trim()
      const parsed = JSON.parse(clean)
      return new Response(
        JSON.stringify(parsed),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      )
    } catch {
      return new Response(
        JSON.stringify({ error: "extraction_failed", raw: text }),
        { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      )
    }
  } catch (err) {
    return new Response(
      JSON.stringify({ error: "extraction_failed", raw: String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    )
  }
})
