// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, act } from "@testing-library/react";
import { TenantBrandingProvider, useTenantBranding } from "./useTenantBranding";
import type { TenantBranding } from "./useTenantBranding";

// ── Mock supabase ─────────────────────────────────────────────────────────────

const maybeSingleMock = vi.fn();
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: vi.fn(() => ({ select: vi.fn(() => ({ maybeSingle: maybeSingleMock })) })),
    rpc: vi.fn(),
    storage: { from: vi.fn() },
  },
}));

beforeEach(() => {
  maybeSingleMock.mockReset();
});

// ── Consumer helper ───────────────────────────────────────────────────────────

function BrandingConsumer() {
  const { branding, loading, accentColor } = useTenantBranding();
  if (loading) return <div data-testid="state">loading</div>;
  return (
    <>
      <div data-testid="state">done</div>
      <div data-testid="branding">{branding === null ? "null" : branding.brand_name}</div>
      <div data-testid="accent">{accentColor}</div>
    </>
  );
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("useTenantBranding", () => {
  it("loading=true while fetch is pending", async () => {
    let resolvePromise!: (value: unknown) => void;
    maybeSingleMock.mockReturnValueOnce(new Promise((r) => { resolvePromise = r; }));

    render(
      <TenantBrandingProvider>
        <BrandingConsumer />
      </TenantBrandingProvider>,
    );

    expect(screen.getByTestId("state").textContent).toBe("loading");

    await act(async () => {
      resolvePromise({ data: null, error: null });
    });
  });

  it("branding=null and accentColor=fallback when data is null", async () => {
    maybeSingleMock.mockResolvedValueOnce({ data: null, error: null });

    render(
      <TenantBrandingProvider>
        <BrandingConsumer />
      </TenantBrandingProvider>,
    );

    await waitFor(() => expect(screen.getByTestId("state").textContent).toBe("done"));
    expect(screen.getByTestId("branding").textContent).toBe("null");
    expect(screen.getByTestId("accent").textContent).toBe("#534AB7");
  });

  it("branding populated and accentColor matches", async () => {
    const mockData: TenantBranding = {
      brand_name: "Test Broker SRL",
      brand_phone: "0123456789",
      brand_email: "test@broker.it",
      accent_color: "#FF5500",
      logo_url: null,
      ragione_sociale: "Test SRL",
      piva: "12345678901",
    };
    maybeSingleMock.mockResolvedValueOnce({ data: mockData, error: null });

    render(
      <TenantBrandingProvider>
        <BrandingConsumer />
      </TenantBrandingProvider>,
    );

    await waitFor(() => expect(screen.getByTestId("state").textContent).toBe("done"));
    expect(screen.getByTestId("branding").textContent).toBe("Test Broker SRL");
    expect(screen.getByTestId("accent").textContent).toBe("#FF5500");
  });

  it("error: loading=false + branding=null + console.warn, no throw", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    maybeSingleMock.mockResolvedValueOnce({ data: null, error: { message: "DB error" } });

    expect(() =>
      render(
        <TenantBrandingProvider>
          <BrandingConsumer />
        </TenantBrandingProvider>,
      ),
    ).not.toThrow();

    await waitFor(() => expect(screen.getByTestId("state").textContent).toBe("done"));
    expect(screen.getByTestId("branding").textContent).toBe("null");
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it("useTenantBranding throws if called outside TenantBrandingProvider", () => {
    function Orphan() {
      useTenantBranding();
      return null;
    }
    expect(() => render(<Orphan />)).toThrow(
      "useTenantBranding must be inside TenantBrandingProvider",
    );
  });
});
