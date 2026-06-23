import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useSession } from "@/hooks/useSession";
import { TabBar, type BoardTab } from "@/components/board/TabBar";
import { ImpostazioniProvider } from "@/components/board/ImpostazioniContext";
import { TenantBrandingProvider } from "@/hooks/useTenantBranding";
import { BoardHeader } from "@/components/board/BoardHeader";
import { AnalisiCockpit } from "@/components/board/AnalisiCockpit";
import { ListinoTab } from "@/components/board/listino/ListinoTab";
import { StoricoTab } from "@/components/board/analisi/StoricoTab";
import { ImpostazioniTab } from "@/components/board/impostazioni/ImpostazioniTab";
import { ModalitaAgenteSheet } from "@/components/board/analisi/ModalitaAgenteSheet";

export default function Board() {
  const [tab, setTab] = useState<BoardTab>("analisi");
  const navigate = useNavigate();
  const { session, loading } = useSession();

  useEffect(() => {
    if (!loading && !session) {
      navigate("/board/login", { replace: true });
    }
  }, [loading, session, navigate]);

  if (loading || !session) return null;

  return (
    <ImpostazioniProvider>
      <TenantBrandingProvider>
        <div className="min-h-screen bg-muted/30">
          <BoardHeader />
          <TabBar active={tab} onChange={setTab} />
          {tab === "analisi" && <AnalisiCockpit />}
          {tab === "listino" && <ListinoTab />}
          {tab === "storico" && (
            <div className="container mx-auto px-4 py-6 max-w-2xl">
              <StoricoTab />
            </div>
          )}
          {tab === "impostazioni" && <ImpostazioniTab />}
          <ModalitaAgenteSheet />
        </div>
      </TenantBrandingProvider>
    </ImpostazioniProvider>
  );
}
