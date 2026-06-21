-- ============================================================================
-- RISPARMETRO — Tabella componenti_regolate
-- Fonte di verità per parametri ARERA luce e indici mercato (PUN/PSV)
-- dal 2026-04-01. Gas servito ancora da parametri_regolati.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Tabella (idempotente: IF NOT EXISTS)
-- ----------------------------------------------------------------------------
create table if not exists public.componenti_regolate (
  id                              uuid primary key default gen_random_uuid(),
  tipo                            text not null check (tipo in ('luce', 'gas', 'mercato')),
  validita_da                     date not null,
  validita_a                      date not null,

  -- Luce (ARERA)
  trasporto_gestione              numeric(10,6) null,  -- €/kWh
  oneri_sistema                   numeric(10,6) null,  -- €/kWh
  accisa_aliquota                 numeric(10,6) null,  -- €/kWh
  accisa_soglia_kwh               integer null,
  iva                             numeric(6,4) null,

  -- Gas (uso futuro)
  componente_copertura_rischi_gj  numeric(10,6) null,  -- €/GJ

  -- Mercato
  pun_mensile                     numeric(10,6) null,  -- €/kWh
  psv_mensile                     numeric(10,6) null,  -- €/Smc

  created_at                      timestamptz not null default now(),

  constraint componenti_regolate_periodo_check check (validita_da <= validita_a)
);

-- Aggiungi colonne opzionali non presenti in versioni precedenti della tabella
alter table public.componenti_regolate
  add column if not exists zona text null;
    -- NULL = nazionale. 'NORD'|'CNOR'|'CSUD'|'SUD'|'SICI'|'SARD' per uso futuro.

comment on table public.componenti_regolate is
  'GLOBALE. Parametri regolati ARERA (luce) e indici mercato (PUN/PSV), nazionali o per zona, '
  'versionati per trimestre. Fonte di verità per date >= 2026-04-01. Gas su parametri_regolati.';

-- ----------------------------------------------------------------------------
-- 2. Indici (idempotenti: IF NOT EXISTS)
-- ----------------------------------------------------------------------------
create index if not exists idx_componenti_regolate_tipo_periodo
  on public.componenti_regolate (tipo, validita_da, validita_a);

-- Unique per righe nazionali (zona IS NULL) — abilita ON CONFLICT nei seed
create unique index if not exists uq_componenti_regolate_nazionale
  on public.componenti_regolate (tipo, validita_da)
  where zona is null;

-- ----------------------------------------------------------------------------
-- 3. RLS (idempotente via DO $$ ... IF NOT EXISTS check)
-- ----------------------------------------------------------------------------
alter table public.componenti_regolate enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename  = 'componenti_regolate'
      and policyname = 'cr_select'
  ) then
    create policy cr_select on public.componenti_regolate
      for select to authenticated using (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename  = 'componenti_regolate'
      and policyname = 'cr_insert_admin'
  ) then
    create policy cr_insert_admin on public.componenti_regolate
      for insert to authenticated
      with check (public.is_platform_admin());
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename  = 'componenti_regolate'
      and policyname = 'cr_update_admin'
  ) then
    create policy cr_update_admin on public.componenti_regolate
      for update to authenticated
      using (public.is_platform_admin())
      with check (public.is_platform_admin());
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename  = 'componenti_regolate'
      and policyname = 'cr_delete_admin'
  ) then
    create policy cr_delete_admin on public.componenti_regolate
      for delete to authenticated
      using (public.is_platform_admin());
  end if;
end $$;

-- ----------------------------------------------------------------------------
-- 4. Seed: II trimestre 2026 (2026-04-01 → 2026-06-30), idempotente
-- ----------------------------------------------------------------------------
insert into public.componenti_regolate
  (tipo, zona, validita_da, validita_a,
   trasporto_gestione, oneri_sistema, accisa_aliquota, accisa_soglia_kwh, iva)
values
  ('luce', null, '2026-04-01', '2026-06-30',
   0.015000, 0.020000, 0.022700, null, 0.1000)
on conflict (tipo, validita_da) where zona is null do nothing;

insert into public.componenti_regolate
  (tipo, zona, validita_da, validita_a, pun_mensile, psv_mensile)
values
  ('mercato', null, '2026-04-01', '2026-06-30', 0.115000, 0.420000)
on conflict (tipo, validita_da) where zona is null do nothing;
