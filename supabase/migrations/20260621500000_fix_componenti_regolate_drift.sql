-- ============================================================================
-- FIX DEBITO TECNICO #3: rende componenti_regolate riproducibile da zero.
--
-- Problema: 20260622000000_split_componenti_regolate.sql [sez. D] fa SELECT
--   su componenti_regolate.note e su righe tipo='gas', ma:
--   - la colonna `note` non è definita in 20260621210000_componenti_regolate.sql
--   - la riga tipo='gas' esiste solo nel DB di produzione via Dashboard (drift)
--
-- Su produzione questa migration aggiunge note (idempotente) e la riga gas è
-- già presente → ON CONFLICT DO NOTHING.
-- Su progetto TEST (schema pulito) sblocca l'applicazione dell'intera catena.
-- ============================================================================

-- 1. Colonna nota mancante in componenti_regolate (drift Dashboard)
alter table public.componenti_regolate
  add column if not exists note text null;

-- 2. Riga tipo='gas' mancante in componenti_regolate (drift Dashboard)
insert into public.componenti_regolate (
  tipo, zona, validita_da, validita_a,
  componente_copertura_rischi_gj, iva
)
values (
  'gas', null, '2026-04-01', '2026-06-30',
  null, 0.1000
)
on conflict (tipo, validita_da) where zona is null do nothing;
