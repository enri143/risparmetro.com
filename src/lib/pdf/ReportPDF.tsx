import { Document, Font, Image, Page, StyleSheet, Text, View, pdf } from '@react-pdf/renderer'
import type { RisultatoOfferta } from '@/lib/board/calcoloOfferte'
import InterRegular from '@/assets/fonts/Inter-Regular.ttf?url'
import InterBold from '@/assets/fonts/Inter-Bold.ttf?url'

Font.register({
  family: 'Inter',
  fonts: [
    { src: InterRegular as string, fontWeight: 400 },
    { src: InterBold as string, fontWeight: 700 },
  ],
})

const NERO = '#1F2937'
const GRIGIO = '#6B7280'
const VERDE = '#1D9E75'
const BIANCO = '#FFFFFF'
const SURFACE = '#F9FAFB'
const BORDER = '#E5E7EB'

export interface TenantBranding {
  brand_name: string
  brand_phone: string
  brand_email?: string | null
  accent_color: string
  logo_url?: string | null
  ragione_sociale?: string | null
  piva?: string | null
}

export interface ReportPDFProps {
  branding: TenantBranding
  luce: RisultatoOfferta | null
  gas: RisultatoOfferta | null
  spesaAnnuaLuce: number
  spesaAnnuaGas: number
  dataSimulazione: string
}

function eur(n: number): string {
  return Math.round(n).toLocaleString('it-IT')
}

const s = StyleSheet.create({
  page: {
    fontFamily: 'Inter',
    fontSize: 10,
    color: NERO,
    paddingBottom: 52,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 40,
    paddingTop: 28,
    paddingBottom: 16,
    gap: 14,
  },
  logoBox: {
    width: 52,
    height: 52,
    borderRadius: 8,
    backgroundColor: SURFACE,
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: BORDER,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoImg: {
    width: 44,
    height: 44,
    objectFit: 'contain',
  },
  logoInitial: {
    fontSize: 22,
    fontWeight: 700,
    color: NERO,
  },
  brandName: {
    fontSize: 15,
    fontWeight: 700,
    color: NERO,
  },
  brandMeta: {
    fontSize: 8,
    color: GRIGIO,
    marginTop: 2,
  },
  dateText: {
    fontSize: 8,
    color: GRIGIO,
    textAlign: 'right',
  },
  accentBar: {
    height: 2,
    marginHorizontal: 40,
  },
  body: {
    paddingHorizontal: 40,
    paddingTop: 20,
  },
  pageTitle: {
    fontSize: 17,
    fontWeight: 700,
    color: NERO,
    marginBottom: 4,
    marginTop: 12,
  },
  pageSub: {
    fontSize: 9,
    color: GRIGIO,
    marginBottom: 18,
  },
  heroCard: {
    backgroundColor: '#ECFDF5',
    borderRadius: 10,
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: '#A7F3D0',
    padding: 20,
    marginBottom: 20,
    alignItems: 'center',
  },
  heroLabel: {
    fontSize: 8,
    fontWeight: 700,
    color: VERDE,
    letterSpacing: 1,
    marginBottom: 4,
  },
  heroAmount: {
    fontSize: 34,
    fontWeight: 700,
    color: VERDE,
  },
  heroSub: {
    fontSize: 8,
    color: GRIGIO,
    marginTop: 4,
  },
  sectionLabel: {
    fontSize: 8,
    fontWeight: 700,
    color: GRIGIO,
    letterSpacing: 1,
    marginBottom: 6,
    marginTop: 4,
  },
  offerCard: {
    backgroundColor: BIANCO,
    borderRadius: 10,
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: BORDER,
    marginBottom: 14,
  },
  cardHead: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderBottomWidth: 1,
    borderBottomStyle: 'solid',
    borderBottomColor: BORDER,
    gap: 10,
  },
  avatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: SURFACE,
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: BORDER,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: {
    fontSize: 15,
    fontWeight: 700,
    color: '#534AB7',
  },
  offerName: {
    fontSize: 11,
    fontWeight: 700,
    color: NERO,
  },
  offerSub: {
    fontSize: 8,
    color: GRIGIO,
    marginTop: 2,
  },
  badge: {
    backgroundColor: VERDE,
    borderRadius: 4,
    paddingVertical: 3,
    paddingHorizontal: 7,
  },
  badgeText: {
    fontSize: 7,
    fontWeight: 700,
    color: BIANCO,
  },
  breakdownArea: {
    padding: 14,
  },
  bRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  bLabel: { fontSize: 9, color: GRIGIO },
  bValue: { fontSize: 9, color: NERO },
  bValueGreen: { fontSize: 9, color: VERDE },
  divider: {
    height: 1,
    backgroundColor: BORDER,
    marginVertical: 7,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  totalLabel: { fontSize: 11, fontWeight: 700, color: NERO },
  totalValue: { fontSize: 11, fontWeight: 700, color: NERO },
  risparmioRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 5,
  },
  risparmioText: { fontSize: 9, fontWeight: 700, color: VERDE },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 40,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopStyle: 'solid',
    borderTopColor: BORDER,
  },
  footerText: { fontSize: 6.5, color: GRIGIO },
  footerPage: { fontSize: 6.5, color: GRIGIO },
})

function OfferCard({ r, tipo }: { r: RisultatoOfferta; tipo: 'Luce' | 'Gas' }) {
  const hasRisparmio = r.risparmio_annuo > 0
  const tipoLabel = r.tipo_prezzo === 'fisso' ? 'Prezzo Fisso' : 'Prezzo Variabile'
  return (
    <View style={s.offerCard}>
      <View style={s.cardHead}>
        <View style={s.avatar}>
          <Text style={s.avatarInitial}>{r.fornitore_nome.charAt(0).toUpperCase()}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={s.offerName}>{r.nome}</Text>
          <Text style={s.offerSub}>{r.fornitore_nome} · {tipo} · {tipoLabel}</Text>
        </View>
        {hasRisparmio && (
          <View style={s.badge}>
            <Text style={s.badgeText}>CONSIGLIATA</Text>
          </View>
        )}
      </View>
      <View style={s.breakdownArea}>
        <View style={s.bRow}>
          <Text style={s.bLabel}>Materia energia</Text>
          <Text style={s.bValue}>{eur(r.costo_materia_energia)} €</Text>
        </View>
        <View style={s.bRow}>
          <Text style={s.bLabel}>Trasporto e gestione</Text>
          <Text style={s.bValue}>{eur(r.costo_trasporto)} €</Text>
        </View>
        <View style={s.bRow}>
          <Text style={s.bLabel}>Oneri di sistema</Text>
          <Text style={s.bValue}>{eur(r.costo_oneri)} €</Text>
        </View>
        <View style={s.bRow}>
          <Text style={s.bLabel}>Accise</Text>
          <Text style={s.bValue}>{eur(r.costo_accise)} €</Text>
        </View>
        <View style={s.bRow}>
          <Text style={s.bLabel}>IVA</Text>
          <Text style={s.bValue}>{eur(r.iva)} €</Text>
        </View>
        {r.quota_fissa_annua > 0 && (
          <View style={s.bRow}>
            <Text style={s.bLabel}>Quota fissa annua</Text>
            <Text style={s.bValue}>{eur(r.quota_fissa_annua)} €</Text>
          </View>
        )}
        {r.sconti > 0 && (
          <View style={s.bRow}>
            <Text style={s.bLabel}>Sconti applicati</Text>
            <Text style={s.bValueGreen}>−{eur(r.sconti)} €</Text>
          </View>
        )}
        <View style={s.divider} />
        <View style={s.totalRow}>
          <Text style={s.totalLabel}>Totale annuo stimato</Text>
          <Text style={s.totalValue}>{eur(r.costo_annuo_totale)} €</Text>
        </View>
        {hasRisparmio && (
          <View style={s.risparmioRow}>
            <Text style={s.risparmioText}>Risparmio stimato</Text>
            <Text style={s.risparmioText}>
              +{eur(r.risparmio_annuo)} € ({r.risparmio_percentuale.toFixed(1)}%)
            </Text>
          </View>
        )}
      </View>
    </View>
  )
}

export function ReportPDF({
  branding,
  luce,
  gas,
  spesaAnnuaLuce,
  spesaAnnuaGas,
  dataSimulazione,
}: ReportPDFProps) {
  const risparmioLuce = luce && luce.risparmio_annuo > 0 ? luce.risparmio_annuo : 0
  const risparmioGas = gas && gas.risparmio_annuo > 0 ? gas.risparmio_annuo : 0
  const totaleRisparmio = risparmioLuce + risparmioGas
  const accent = branding.accent_color || VERDE

  const dataFmt = (() => {
    try {
      return new Date(dataSimulazione + 'T12:00:00').toLocaleDateString('it-IT', {
        day: '2-digit',
        month: 'long',
        year: 'numeric',
      })
    } catch {
      return dataSimulazione
    }
  })()

  const spesaTotale = spesaAnnuaLuce + spesaAnnuaGas
  const spesaLabel =
    spesaAnnuaLuce > 0 && spesaAnnuaGas > 0
      ? `Risparmio rispetto alla spesa attuale (luce + gas: ${eur(spesaTotale)} €/anno)`
      : spesaAnnuaLuce > 0
        ? `Risparmio rispetto alla spesa attuale (luce: ${eur(spesaAnnuaLuce)} €/anno)`
        : `Risparmio rispetto alla spesa attuale (gas: ${eur(spesaAnnuaGas)} €/anno)`

  const disclaimer =
    `I valori riportati sono stime basate sui consumi dichiarati e sui prezzi alla data di simulazione. Non costituiscono offerta contrattuale.` +
    (branding.ragione_sociale ? ` ${branding.ragione_sociale}` : '') +
    (branding.piva ? ` — P.IVA ${branding.piva}` : '')

  return (
    <Document title={`Report Offerte — ${branding.brand_name}`} author={branding.brand_name}>
      <Page size="A4" style={s.page}>
        {/* Header */}
        <View style={s.header}>
          <View style={s.logoBox}>
            {branding.logo_url ? (
              <Image src={branding.logo_url} style={s.logoImg} />
            ) : (
              <Text style={s.logoInitial}>{branding.brand_name.charAt(0).toUpperCase()}</Text>
            )}
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.brandName}>{branding.brand_name}</Text>
            <Text style={s.brandMeta}>{branding.brand_phone}</Text>
            {branding.brand_email ? (
              <Text style={s.brandMeta}>{branding.brand_email}</Text>
            ) : null}
          </View>
          <Text style={s.dateText}>{'Report del\n' + dataFmt}</Text>
        </View>

        {/* Accent bar */}
        <View style={[s.accentBar, { backgroundColor: accent }]} />

        {/* Body */}
        <View style={s.body}>
          <Text style={s.pageTitle}>Report di Confronto Offerte Energia</Text>
          <Text style={s.pageSub}>
            Simulazione basata sui consumi dichiarati. I valori sono stime e potrebbero variare.
          </Text>

          {totaleRisparmio > 0 && (
            <View style={s.heroCard}>
              <Text style={s.heroLabel}>RISPARMIO ANNUO STIMATO</Text>
              <Text style={s.heroAmount}>+{eur(totaleRisparmio)} €</Text>
              <Text style={s.heroSub}>{spesaLabel}</Text>
            </View>
          )}

          {luce ? (
            <View>
              <Text style={s.sectionLabel}>OFFERTA ELETTRICITÀ</Text>
              <OfferCard r={luce} tipo="Luce" />
            </View>
          ) : null}

          {gas ? (
            <View>
              <Text style={s.sectionLabel}>OFFERTA GAS NATURALE</Text>
              <OfferCard r={gas} tipo="Gas" />
            </View>
          ) : null}
        </View>

        {/* Footer — fixed: si ripete su ogni pagina */}
        <View style={s.footer} fixed>
          <Text style={s.footerText}>{disclaimer}</Text>
          <Text
            style={s.footerPage}
            render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`}
          />
        </View>
      </Page>
    </Document>
  )
}

export async function renderToPDFBlob(props: ReportPDFProps): Promise<Blob> {
  return pdf(<ReportPDF {...props} />).toBlob()
}
