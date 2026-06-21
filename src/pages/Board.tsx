import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { useSession } from "@/hooks/useSession";
import { TabBar, type BoardTab } from "@/components/board/TabBar";
import { ImpostazioniProvider } from "@/components/board/ImpostazioniContext";
import { AnalisiCockpit } from "@/components/board/AnalisiCockpit";
import { ListinoTab } from "@/components/board/listino/ListinoTab";
import { ImpostazioniTab } from "@/components/board/impostazioni/ImpostazioniTab";
import { ModalitaAgenteSheet, AGENT_SHEET_EVENT } from "@/components/board/analisi/ModalitaAgenteSheet";
import { useLongPress } from "@/hooks/useLongPress";
import { useState } from "react";
import { LogOut } from "lucide-react";

export default function Board() {
  const [tab, setTab] = useState<BoardTab>("analisi");
  const navigate = useNavigate();
  const { session, loading } = useSession();

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
            <button
              onClick={handleLogout}
              className="flex items-center gap-1.5 text-xs opacity-70 hover:opacity-100 transition-opacity px-2 py-1 rounded"
              title="Esci"
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:inline">Esci</span>
            </button>
          </div>
        </header>
        <TabBar active={tab} onChange={setTab} />
        {tab === "analisi" && <AnalisiCockpit />}
        {tab === "listino" && <ListinoTab />}
        {tab === "impostazioni" && <ImpostazioniTab />}
        <ModalitaAgenteSheet />
      </div>
    </ImpostazioniProvider>
  );
}
