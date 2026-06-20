import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { TabBar, type BoardTab } from "@/components/board/TabBar";
import { ImpostazioniProvider } from "@/components/board/ImpostazioniContext";
import { AnalisiTab } from "@/components/board/analisi/AnalisiTab";
import { ListinoTab } from "@/components/board/listino/ListinoTab";
import { ImpostazioniTab } from "@/components/board/impostazioni/ImpostazioniTab";
import { ModalitaAgenteSheet, AGENT_SHEET_EVENT } from "@/components/board/analisi/ModalitaAgenteSheet";
import { useLongPress } from "@/hooks/useLongPress";
import { BOARD_AUTH_KEY, BOARD_PWD_KEY } from "./BoardLogin";

export default function Board() {
  const [tab, setTab] = useState<BoardTab>("analisi");
  const navigate = useNavigate();
  const [authed, setAuthed] = useState(false);

  useEffect(() => {
    if (sessionStorage.getItem(BOARD_AUTH_KEY) !== "1" || !sessionStorage.getItem(BOARD_PWD_KEY)) {
      sessionStorage.removeItem(BOARD_AUTH_KEY);
      sessionStorage.removeItem(BOARD_PWD_KEY);
      navigate("/board/login", { replace: true });
    } else {
      setAuthed(true);
    }
  }, [navigate]);

  const longPress = useLongPress(() => {
    window.dispatchEvent(new Event(AGENT_SHEET_EVENT));
  }, 1200);

  if (!authed) return null;

  return (
    <ImpostazioniProvider>
      <div className="min-h-screen bg-muted/30">
        <header className="bg-primary text-primary-foreground py-3 px-4 select-none">
          <div className="container mx-auto">
            <h1
              className="text-lg sm:text-xl font-bold cursor-default touch-none"
              {...longPress}
              title="Tieni premuto 1.2s per modalità agente"
            >
              Salesboard — Confronto Offerte
            </h1>
            <p className="text-xs opacity-80">Strumento agenti commerciali energia</p>
          </div>
        </header>
        <TabBar active={tab} onChange={setTab} />
        {tab === "analisi" && <AnalisiTab />}
        {tab === "listino" && <ListinoTab />}
        {tab === "impostazioni" && <ImpostazioniTab />}
        <ModalitaAgenteSheet />
      </div>
    </ImpostazioniProvider>
  );
}
