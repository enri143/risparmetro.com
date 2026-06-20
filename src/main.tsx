import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import './index.css'
import App from './App.tsx'
import Board from './pages/Board.tsx'
import BoardLogin from './pages/BoardLogin.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<App />} />
        <Route path="/board/login" element={<BoardLogin />} />
        <Route path="/board" element={<Board />} />
      </Routes>
    </BrowserRouter>
  </StrictMode>,
)
