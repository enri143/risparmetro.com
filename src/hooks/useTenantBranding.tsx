import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import { supabase } from "@/integrations/supabase/client";

const DEFAULT_ACCENT = "#534AB7";

export interface TenantBranding {
  brand_name: string | null;
  brand_phone: string | null;
  brand_email: string | null;
  accent_color: string | null;
  logo_url: string | null;
  ragione_sociale: string | null;
  piva: string | null;
}

export interface TenantBrandingCtx {
  branding: TenantBranding | null;
  loading: boolean;
  reload: () => Promise<void>;
  /** accent_color con fallback '#534AB7' se non impostato */
  accentColor: string;
}

const TenantBrandingContext = createContext<TenantBrandingCtx | null>(null);

export function TenantBrandingProvider({ children }: { children: ReactNode }) {
  const [branding, setBranding] = useState<TenantBranding | null>(null);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("tenant_branding")
      .select("brand_name, brand_phone, brand_email, accent_color, logo_url, ragione_sociale, piva")
      .maybeSingle();
    if (error) {
      console.warn("[TenantBranding] fetch error:", error.message);
      setBranding(null);
    } else {
      setBranding(data as TenantBranding | null);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  const accentColor = branding?.accent_color ?? DEFAULT_ACCENT;

  const style: React.CSSProperties & Record<string, string> | undefined =
    branding?.accent_color
      ? {
          "--color-brand": branding.accent_color,
          "--color-brand-foreground": "#ffffff",
        }
      : undefined;

  return (
    <TenantBrandingContext.Provider value={{ branding, loading, reload, accentColor }}>
      <div data-testid="tenant-branding-root" style={style}>
        {children}
      </div>
    </TenantBrandingContext.Provider>
  );
}

export function useTenantBranding(): TenantBrandingCtx {
  const ctx = useContext(TenantBrandingContext);
  if (!ctx) throw new Error("useTenantBranding must be inside TenantBrandingProvider");
  return ctx;
}
