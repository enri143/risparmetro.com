import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from "jsr:@supabase/supabase-js@2"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders })
  const json = (b: unknown, status = 200) =>
    new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } })
  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!
    const authHeader = req.headers.get("Authorization") ?? ""

    // 1) il chiamante DEVE essere platform_admin (verifica col suo JWT)
    const userClient = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: authHeader } } })
    const { data: isAdmin, error: adminErr } = await userClient.rpc("is_platform_admin")
    if (adminErr || isAdmin !== true) return json({ error: "Accesso negato" }, 403)

    // 2) input
    const { tenant_id, email, password, role } = await req.json()
    if (!tenant_id || !email || !password) return json({ error: "tenant_id, email, password obbligatori" }, 400)

    // 3) service_role: crea utente confermato + mappa al tenant
    const admin = createClient(SUPABASE_URL, SERVICE_KEY)
    const { data: created, error: createErr } = await admin.auth.admin.createUser({ email, password, email_confirm: true })
    if (createErr || !created?.user) return json({ error: createErr?.message ?? "Creazione utente fallita" }, 409)

    const { error: memberErr } = await admin.from("tenant_members").insert({ tenant_id, user_id: created.user.id, role: role ?? "owner" })
    if (memberErr) {
      await admin.auth.admin.deleteUser(created.user.id) // rollback: no utente orfano
      return json({ error: "Mapping tenant fallito: " + memberErr.message }, 500)
    }
    return json({ ok: true, user_id: created.user.id }, 200)
  } catch (e) {
    return json({ error: String(e) }, 500)
  }
})
