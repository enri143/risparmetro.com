import { useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { useSession } from "@/hooks/useSession";
import { TabBar, type BoardTab } from "@/components/board/TabBar";
import { ImpostazioniProvider } from "@/components/board/ImpostazioniContext";
import { AnalisiCockpit } from "@/components/board/AnalisiCockpit";
import { ListinoTab } from "@/components/board/listino/ListinoTab";
import { StoricoTab } from "@/components/board/analisi/StoricoTab";
import { ImpostazioniTab } from "@/components/board/impostazioni/ImpostazioniTab";
import { ModalitaAgenteSheet, AGENT_SHEET_EVENT } from "@/components/board/analisi/ModalitaAgenteSheet";
import { useLongPress } from "@/hooks/useLongPress";
import { useIsPlatformAdmin } from "@/hooks/useIsPlatformAdmin";
import { useState } from "react";
import { LogOut, ShieldCheck } from "lucide-react";

export default function Board() {
  const [tab, setTab] = useState<BoardTab>("analisi");
  const navigate = useNavigate();
  const { session, loading } = useSession();
  const { isAdmin } = useIsPlatformAdmin();

  useEffect(() => {
    if (!loading && !session) {
      navigate("/board/login", { replace: true });
    }
  }, [loading, session, navigate]);

  const longPress = useLongPress(() => {
    window.dispatchEvent(new Event(AGENT_SHEET_EVENT));
  }, 1200);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/board/login", { replace: true });
  };

  if (loading || !session) return null;

  return (
    <ImpostazioniProvider>
      <div className="min-h-screen bg-muted/30">
        <header className="bg-primary text-primary-foreground py-3 px-4 select-none">
          <div className="container mx-auto flex items-center justify-between">
            <div>
              <h1
                className="text-lg sm:text-xl font-bold cursor-default touch-none"
                {...longPress}
                title="Tieni premuto 1.2s per modalità agente"
              >
                Salesboard — Confronto Offerte
              </h1>
              <p className="text-xs opacity-80">Strumento agenti commerciali energia</p>
            </div>
            <div className="flex items-center gap-3">
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
    </ImpostazioniProvider>
  );
}
