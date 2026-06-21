import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from "jsr:@supabase/supabase-js@2"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? ""
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY") ?? ""

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders })
  }

  try {
    const { cte_id, dati_bolletta } = await req.json()

    if (!cte_id) {
      return new Response(
        JSON.stringify({ error: "cte_id obbligatorio" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      )
    }

    // Leggi la CTE dal DB con service role (bypassa RLS)
    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)
    const { data: cte, error: dbError } = await supabase
      .from("cte")
      .select("*")
      .eq("id", cte_id)
      .single()

    if (dbError || !cte) {
      return new Response(
        JSON.stringify({ error: "CTE non trovata", detail: dbError?.message }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      )
    }

    const prompt = `Sei un consulente esperto di mercato energia italiano.
Ti fornisco i dati di un contratto energia (CTE) e i consumi del cliente dalla bolletta.

CTE:
${JSON.stringify(cte, null, 2)}

Dati consumo cliente:
${JSON.stringify(dati_bolletta, null, 2)}

Analizza e rispondi SOLO con questo JSON (nessun markdown, nessun testo extra):
{
  "punti_forza": ["..."],
  "obiezioni_probabili": ["..."],
  "script_apertura_suggerito": "...",
  "risparmio_stimato_annuo": 0
}

- punti_forza: 3-5 vantaggi concreti di questa offerta per questo cliente
- obiezioni_probabili: 2-4 obiezioni che il cliente potrebbe sollevare
- script_apertura_suggerito: frase di apertura naturale (max 3 frasi) adatta al profilo del cliente
- risparmio_stimato_annuo: stima numerica in euro del risparmio annuo (0 se non calcolabile)`

    const claudeRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 1024,
        messages: [{ role: "user", content: prompt }],
      }),
    })

    if (!claudeRes.ok) {
      const raw = await claudeRes.text()
      return new Response(
        JSON.stringify({ error: "claude_failed", raw }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      )
    }

    const claudeJson = await claudeRes.json()
    const text: string = claudeJson?.content?.[0]?.text ?? ""

    try {
      const clean = text.replace(/```json|```/g, "").trim()
      const parsed = JSON.parse(clean)
      return new Response(
        JSON.stringify(parsed),
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
