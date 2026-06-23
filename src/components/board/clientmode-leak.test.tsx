// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ConfrontoDettagliatoView } from "./ConfrontoDettagliatoView";
import { PresentazioneView } from "./PresentazioneView";
import type { RisultatoOfferta, CTE } from "@/lib/board/calcoloOfferte";

// Mocks — caricati prima di qualsiasi import che tocchi supabase / PDF
vi.mock("@/lib/pdf/generateReport", () => ({ generateReport: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { from: vi.fn(), rpc: vi.fn(), storage: { from: vi.fn() } },
}));

// Mocks per PresentazioneView (route /presenta)
vi.mock("react-router-dom", () => ({
  useOutletContext: () => ({
    risultatiLuce: [{
      cte_id: "cte-test-1",
      nome: "Offerta Prova Fisso 12M",
      fornitore_nome: "EnergiaCo SpA",
      tipo_prezzo: "fisso" as const,
      durata_blocco_mesi: 12,
      costo_materia_energia: 614.16,
      costo_trasporto: 0,
      costo_oneri: 0,
      costo_accise: 0,
      imponibile: 717.12,
      iva: 0,
      quota_fissa_annua: 102.96,
      sconti: 0,
      costo_annuo_totale: 717.12,
      risparmio_annuo: 280,
      risparmio_percentuale: 28.1,
      provvigione: 50,
      provvigione_tipo: "fisso",
      mesi_storno_rischio: 6,
    }],
    risultatiGas: [],
    spesaAnnuaLuce: 997.12,
    spesaAnnuaGas: 0,
    dati: { tipo_fornitura: "luce", tipo_cliente: "domestico_residente", consumo_annuo_kwh: 2700, potenza_impegnata_kw: 3 },
    parametriLuce: null,
    parametriGas: null,
    setShowDettagliato: vi.fn(),
  }),
  useNavigate: () => vi.fn(),
}));

vi.mock("@/hooks/useTenantBranding", () => ({
  useTenantBranding: () => ({ branding: null }),
}));

vi.mock("recharts", () => ({
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  BarChart: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  AreaChart: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Bar: () => null,
  Area: () => null,
  Cell: () => null,
  XAxis: () => null,
  YAxis: () => null,
  Tooltip: () => null,
  CartesianGrid: () => null,
}));

// ── Fixture ───────────────────────────────────────────────────────────────────

const OFFERTA: RisultatoOfferta = {
  cte_id: "cte-test-1",
  nome: "Offerta Prova Fisso 12M",
  fornitore_nome: "EnergiaCo SpA",
  tipo_prezzo: "fisso",
  durata_blocco_mesi: 12,
  costo_materia_energia: 614.16,
  costo_trasporto: 0,
  costo_oneri: 0,
  costo_accise: 0,
  imponibile: 717.12,
  iva: 0,
  quota_fissa_annua: 102.96,
  sconti: 0,
  costo_annuo_totale: 717.12,
  risparmio_annuo: 280,
  risparmio_percentuale: 28.1,
  // campi agente — NON devono mai comparire in clientMode
  provvigione: 50,
  provvigione_tipo: "fisso",
  mesi_storno_rischio: 6,
};

const CTE_FIXTURE: CTE = {
  id: "cte-test-1",
  nome: "Offerta Prova Fisso 12M",
  fornitore_nome: "EnergiaCo SpA",
  tipo_fornitura: "luce",
  tipo_prezzo: "fisso",
  prezzo_energia_luce: 0.2277,
  quota_fissa_luce: 8.58,
  durata_blocco_mesi: 12,
  provvigione: 50,
  provvigione_tipo: "fisso",
  mesi_storno_rischio: 6,
};

const BASE_PROPS = {
  risultatiLuce: [OFFERTA],
  risultatiGas: [],
  ctes: [CTE_FIXTURE],
  prezziMercato: { pun_medio: 0.115, psv_medio: 0.42 },
  parametriLuce: null,
  parametriGas: null,
  spesaAnnuaLuce: 997.12,
  spesaAnnuaGas: 0,
  onBack: vi.fn(),
  onToggleClientMode: vi.fn(),
  onToggleShowProvvigioni: vi.fn(),
  selectedCteId: null,
  onSelectCte: vi.fn(),
};

// ── Helpers ───────────────────────────────────────────────────────────────────

async function espandiDettagli() {
  // La sezione "Condizioni Agente" è dentro il pannello collassato "Vedi Dettagli"
  const btn = screen.getByRole("button", { name: /Vedi Dettagli/i });
  await userEvent.click(btn);
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("clientMode leak guard — ConfrontoDettagliatoView", () => {
  it("clientMode=true + showProvvigioni=true: dopo espansione NESSUN nodo contiene 'Provvigion' nel DOM", async () => {
    render(<ConfrontoDettagliatoView {...BASE_PROPS} clientMode={true} showProvvigioni={true} />);
    await espandiDettagli();

    // Regex copre "Provvigione", "Provvigioni", ecc.
    expect(screen.queryByText(/Provvigion/i)).toBeNull();
    expect(screen.queryByText(/Condizioni Agente/i)).toBeNull();
  });

  it("clientMode=true + showProvvigioni=true: dopo espansione il valore provvigione (50 €) non appare", async () => {
    const { container } = render(
      <ConfrontoDettagliatoView {...BASE_PROPS} clientMode={true} showProvvigioni={true} />,
    );
    await espandiDettagli();
    expect(container.textContent).not.toMatch(/50,00/);
  });

  it("clientMode=false + showProvvigioni=true (agente): dopo espansione 'Condizioni Agente' e 'Provvigione' visibili", async () => {
    render(<ConfrontoDettagliatoView {...BASE_PROPS} clientMode={false} showProvvigioni={true} />);
    await espandiDettagli();

    // "Condizioni Agente" è unico (non appare in bottoni)
    expect(screen.queryByText(/Condizioni Agente/i)).not.toBeNull();
    // "Provvigione" (exact) è la label del campo — diverso da "Provvigioni: ON/OFF" nel toggle
    expect(screen.queryByText("Provvigione")).not.toBeNull();
  });

  it("clientMode=false + showProvvigioni=false: dopo espansione sezione agente NON presente (toggle off)", async () => {
    render(<ConfrontoDettagliatoView {...BASE_PROPS} clientMode={false} showProvvigioni={false} />);
    await espandiDettagli();

    expect(screen.queryByText(/Condizioni Agente/i)).toBeNull();
    // "Provvigione" (exact) — il bottone "Provvigioni: OFF" NON matcha questa stringa esatta
    expect(screen.queryByText("Provvigione")).toBeNull();
  });
});

// ── Tests — route /presenta (PresentazioneView) ───────────────────────────────

describe("clientMode leak guard — PresentazioneView (route /presenta)", () => {
  it("PresentazioneView: risparmio visibile ma nessun riferimento a Provvigion* nel DOM", () => {
    render(<PresentazioneView />);
    expect(screen.queryByText(/Provvigion/i)).toBeNull();
    expect(screen.queryByText(/Condizioni Agente/i)).toBeNull();
  });

  it("PresentazioneView: valore provvigione agente (50 €) non appare nel DOM cliente", () => {
    const { container } = render(<PresentazioneView />);
    expect(container.textContent).not.toMatch(/50,00/);
  });
});
