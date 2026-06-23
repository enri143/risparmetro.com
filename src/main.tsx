import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import * as Sentry from "@sentry/react";
import './index.css'
import App from './App.tsx'
import Board from './pages/Board.tsx'
import BoardLogin from './pages/BoardLogin.tsx'
import AdminConsole from './pages/AdminConsole.tsx'
import { initSentry } from "./lib/observability/sentry";

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
          <Route path="/board" element={<Board />} />
          <Route path="/admin" element={<AdminConsole />} />
        </Routes>
      </BrowserRouter>
    </Sentry.ErrorBoundary>
  </StrictMode>,
)
