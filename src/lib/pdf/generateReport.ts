import { supabase } from '@/integrations/supabase/client'
import { toast } from 'sonner'
import { renderToPDFBlob } from './ReportPDF'
import type { RisultatoOfferta } from '@/lib/board/calcoloOfferte'

export interface GenerateReportParams {
  risultatiLuce: RisultatoOfferta[]
  risultatiGas: RisultatoOfferta[]
  spesaAnnuaLuce: number
  spesaAnnuaGas: number
}

export async function generateReport({
  risultatiLuce,
  risultatiGas,
  spesaAnnuaLuce,
  spesaAnnuaGas,
}: GenerateReportParams): Promise<void> {
  const { data: branding, error } = await supabase
    .from('tenant_branding')
    .select('brand_name, brand_phone, brand_email, accent_color, logo_url, ragione_sociale, piva')
    .maybeSingle()

  if (error) {
    toast.error('Errore recupero dati branding: ' + error.message)
    return
  }

  if (!branding?.brand_name || !branding?.brand_phone) {
    toast.error(
      'Configura nome brand e telefono in Impostazioni → Branding prima di generare il PDF.',
    )
    return
  }

  const blob = await renderToPDFBlob({
    branding: {
      brand_name: branding.brand_name,
      brand_phone: branding.brand_phone,
      brand_email: branding.brand_email,
      accent_color: branding.accent_color ?? '#1D9E75',
      logo_url: branding.logo_url,
      ragione_sociale: branding.ragione_sociale,
      piva: branding.piva,
    },
    luce: risultatiLuce[0] ?? null,
    gas: risultatiGas[0] ?? null,
    spesaAnnuaLuce,
    spesaAnnuaGas,
    dataSimulazione: new Date().toISOString().slice(0, 10),
  })

  const safeName = branding.brand_name.replace(/[^a-zA-Z0-9À-ɏ]/g, '_')
  const now = new Date()
  const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '')
  const timeStr = now.toTimeString().slice(0, 5).replace(':', '')

  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = `${safeName}_Report_${dateStr}_${timeStr}.pdf`
  anchor.click()
  URL.revokeObjectURL(url)
}
