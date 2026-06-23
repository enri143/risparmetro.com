import { useEffect } from "react";
import { useNavigate, useLocation, Outlet } from "react-router-dom";
import { useSession } from "@/hooks/useSession";
import { TabBar, type BoardTab } from "@/components/board/TabBar";
import { ImpostazioniProvider } from "@/components/board/ImpostazioniContext";
import { TenantBrandingProvider } from "@/hooks/useTenantBranding";
import { BoardHeader } from "@/components/board/BoardHeader";
import { ModalitaAgenteSheet } from "@/components/board/analisi/ModalitaAgenteSheet";

const BOARD_TABS: BoardTab[] = ["analisi", "listino", "storico", "impostazioni"];

export default function Board() {
  const navigate = useNavigate();
  const location = useLocation();
  const { session, loading } = useSession();

  useEffect(() => {
    if (!loading && !session) {
      navigate("/board/login", { replace: true });
    }
  }, [loading, session, navigate]);

  if (loading || !session) return null;

  const segment = location.pathname.split("/")[2];
  const activeTab: BoardTab = BOARD_TABS.includes(segment as BoardTab)
    ? (segment as BoardTab)
    : "analisi";

  return (
    <ImpostazioniProvider>
      <TenantBrandingProvider>
        <div className="min-h-screen bg-muted/30">
          <BoardHeader />
          <TabBar
            active={activeTab}
            onChange={(t) => navigate(`/board/${t}`)}
          />
          <Outlet />
          <ModalitaAgenteSheet />
        </div>
      </TenantBrandingProvider>
    </ImpostazioniProvider>
  );
}
