-- Aggiunge colonna componenti_venditore alla tabella cte (additivo, non rompe nulla)
alter table public.cte
  add column if not exists componenti_venditore jsonb not null default '[]'::jsonb;
