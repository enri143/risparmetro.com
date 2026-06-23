import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { LogOut, ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useTenantBranding } from "@/hooks/useTenantBranding";
import { useIsPlatformAdmin } from "@/hooks/useIsPlatformAdmin";
import { useLongPress } from "@/hooks/useLongPress";
import { AGENT_SHEET_EVENT } from "@/components/board/analisi/ModalitaAgenteSheet";

export function BoardHeader() {
  const { branding } = useTenantBranding();
  const { isAdmin } = useIsPlatformAdmin();
  const navigate = useNavigate();
  const [logoFailed, setLogoFailed] = useState(false);

  const longPress = useLongPress(() => {
    window.dispatchEvent(new Event(AGENT_SHEET_EVENT));
  }, 1200);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/board/login", { replace: true });
  };

  const brandName = branding?.brand_name || "Salesboard";

  return (
    <header className="bg-brand text-brand-foreground py-3 px-4 select-none">
      <div className="container mx-auto flex items-center justify-between">
        <div className="flex items-center gap-3 min-w-0">
          {branding?.logo_url && !logoFailed && (
            <div className="shrink-0 flex items-center justify-center bg-white rounded-md p-1 h-9">
              <img
                src={branding.logo_url}
                alt={brandName}
                onError={() => setLogoFailed(true)}
                className="h-7 max-w-[120px] object-contain"
              />
            </div>
          )}
          <div className="min-w-0">
            <h1
              className="text-lg sm:text-xl font-bold cursor-default touch-none truncate"
              {...longPress}
              title="Tieni premuto 1.2s per modalità agente"
            >
              {brandName}
            </h1>
            <p className="text-xs opacity-80">Strumento agenti commerciali energia</p>
          </div>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          {isAdmin && (
            <Link
              to="/admin"
              className="flex items-center gap-1.5 text-xs opacity-70 hover:opacity-100 transition-opacity px-2 py-1 rounded"
              title="Console Admin"
            >
              <ShieldCheck className="w-4 h-4" />
              <span className="hidden sm:inline">Admin</span>
            </Link>
          )}
          <button
            onClick={handleLogout}
            className="flex items-center gap-1.5 text-xs opacity-70 hover:opacity-100 transition-opacity px-2 py-1 rounded"
            title="Esci"
          >
            <LogOut className="w-4 h-4" />
            <span className="hidden sm:inline">Esci</span>
          </button>
        </div>
      </div>
    </header>
  );
}
