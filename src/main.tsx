import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import * as Sentry from "@sentry/react";
import './index.css'
import App from './App.tsx'
import Board from './pages/Board.tsx'
import BoardLogin from './pages/BoardLogin.tsx'
import AdminConsole from './pages/AdminConsole.tsx'
import { initSentry } from "./lib/observability/sentry";
import { AnalisiCockpit } from "./components/board/AnalisiCockpit";
import { ListinoTab } from "./components/board/listino/ListinoTab";
import { StoricoRoute } from "./components/board/analisi/StoricoRoute";
import { ImpostazioniTab } from "./components/board/impostazioni/ImpostazioniTab";

initSentry();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Sentry.ErrorBoundary
      fallback={
        <div style={{ padding: 24, fontFamily: "sans-serif" }}>
          Si è verificato un errore. Ricarica la pagina.
        </div>
      }
    >
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<App />} />
          <Route path="/board/login" element={<BoardLogin />} />
          <Route path="/board" element={<Board />}>
            <Route index element={<Navigate to="analisi" replace />} />
            <Route path="analisi" element={<AnalisiCockpit />} />
            <Route path="listino" element={<ListinoTab />} />
            <Route path="storico" element={<StoricoRoute />} />
            <Route path="impostazioni" element={<ImpostazioniTab />} />
            <Route path="*" element={<Navigate to="/board/analisi" replace />} />
          </Route>
          <Route path="/admin" element={<AdminConsole />} />
        </Routes>
      </BrowserRouter>
    </Sentry.ErrorBoundary>
  </StrictMode>,
)
