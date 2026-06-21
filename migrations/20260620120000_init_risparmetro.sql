-- ============================================================================
-- RISPARMETRO — Migration iniziale (Strada A: schema completo multi-tenant)
-- Target: progetto Supabase risparmetro (yrwjsztbibhnrlbvkayh)
-- Data: 2026-06-20
--
-- COSA FA:
--   - Crea tutte le tabelle (globali + per-tenant) con RLS multi-tenant.
--   - Crea funzioni helper, trigger updated_at, indici.
--   - Inserisce seed minimi (5 fornitori, 30 gg PUN+PSV, 6 zone elettriche /
--     6 ambiti gas mappati su 20 regioni, parametri regolati di esempio).
--
-- IMPORTANTE — DIPENDENZA DA SUPABASE AUTH:
--   La RLS qui sotto si basa su auth.uid() (Supabase Auth). Finché il /board
--   usa la password locale "energia2026" senza una sessione Supabase reale,
--   le tabelle PER-TENANT (cte, clienti, simulazioni) restituiranno 0 righe
--   con la chiave anon. Il primo step dopo questa migration è collegare
--   Supabase Auth e fare il bootstrap in fondo a questo file.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 0. Estensioni
-- ----------------------------------------------------------------------------
create extension if not exists pgcrypto with schema extensions; -- gen_random_uuid()

-- ----------------------------------------------------------------------------
-- 1. Enum (idempotenti)
-- ----------------------------------------------------------------------------
do $$ begin
  create type public.piano_tenant as enum ('free','starter','pro','business');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.tenant_role as enum ('owner','admin','agent');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.segmento_cliente as enum ('residenziale','business','entrambi');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.tipo_fornitura as enum ('luce','gas','dual');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.tipo_prezzo as enum ('fisso','variabile','indicizzato');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.provvigione_tipo as enum ('fisso','percentuale');
exception when duplicate_object then null; end $$;

-- ----------------------------------------------------------------------------
-- 2. Funzione trigger updated_at
-- ----------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ============================================================================
-- 3. TABELLE
-- ============================================================================

-- ---- 3.1 platform_admins (io) ----------------------------------------------
create table if not exists public.platform_admins (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  nome       text,
  created_at timestamptz not null default now()
);
comment on table public.platform_admins is 'Super-admin di piattaforma. Bypassano la RLS per-tenant.';

-- ---- 3.2 tenants (i broker/agenzie) ----------------------------------------
create table if not exists public.tenants (
  id                   uuid primary key default gen_random_uuid(),
  slug                 text not null unique,
  nome                 text not null,
  logo_url             text,
  colore_primario      text default '#4f46e5',
  piano                public.piano_tenant not null default 'free',
  attivo               boolean not null default true,
  live_pricing_enabled boolean not null default false, -- false = snapshot (default); true = pricing live (fase futura)
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);
comment on column public.tenants.live_pricing_enabled is 'Decisione #5: snapshot di default, flag per future modalità live.';

-- ---- 3.3 tenant_members (futuri agenti sotto il broker) --------------------
create table if not exists public.tenant_members (
  id         uuid primary key default gen_random_uuid(),
  tenant_id  uuid not null references public.tenants(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  role       public.tenant_role not null default 'owner',
  created_at timestamptz not null default now(),
  unique (tenant_id, user_id)
);
comment on table public.tenant_members is 'Decisione #4: single-user MVP, schema pronto per multi-utente.';

-- ---- 3.4 fornitori (GLOBALE) -----------------------------------------------
create table if not exists public.fornitori (
  id                  uuid primary key default gen_random_uuid(),
  slug                text not null unique,
  nome                text not null,
  logo_url            text,
  colore              text,
  provvigione_default numeric(10,2) not null default 0,  -- provvigione "suggerita" ereditabile dalle CTE
  provvigione_tipo    public.provvigione_tipo not null default 'fisso',
  attivo              boolean not null default true,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
comment on table public.fornitori is 'GLOBALE. Decisione #2: provvigione default ereditabile dalla CTE.';

-- ---- 3.5 cte (PER-TENANT: le offerte del broker) ---------------------------
create table if not exists public.cte (
  id                            uuid primary key default gen_random_uuid(),
  tenant_id                     uuid not null references public.tenants(id) on delete cascade,
  fornitore_id                  uuid references public.fornitori(id) on delete set null,
  nome                          text not null,
  tipo_fornitura                public.tipo_fornitura not null default 'luce',
  tipo_prezzo                   public.tipo_prezzo not null default 'variabile',
  segmento                      public.segmento_cliente not null default 'residenziale',

  -- pricing luce
  prezzo_energia_luce           numeric(12,6),   -- €/kWh (componente energia, offerte fisse)
  spread_luce                   numeric(12,6),   -- €/kWh sopra indice (variabili/indicizzate)
  quota_fissa_luce              numeric(10,2),   -- €/mese
  -- pricing gas
  prezzo_energia_gas            numeric(12,6),   -- €/Smc
  spread_gas                    numeric(12,6),   -- €/Smc
  quota_fissa_gas               numeric(10,2),   -- €/mese
  sconto_percentuale            numeric(5,2),
  durata_blocco_mesi            int,

  -- targeting cliente
  consumo_luce_min              numeric(12,2),
  consumo_luce_max              numeric(12,2),
  consumo_gas_min               numeric(12,2),
  consumo_gas_max               numeric(12,2),
  regioni_applicabili           text[],          -- NULL = tutte le regioni
  richiede_rid                  boolean not null default false,
  richiede_fattura_elettronica  boolean not null default false,
  eta_min                       int,
  eta_max                       int,

  -- vendibilità
  priorita                      int not null default 0,    -- ordinamento board
  provvigione_override          numeric(10,2),             -- se NULL eredita da fornitore
  provvigione_tipo              public.provvigione_tipo,   -- se NULL eredita da fornitore
  mesi_storno_rischio           int,
  target_note                   text,

  -- validità temporale
  valida_da                     date,
  valida_a                      date,
  auto_archivia                 boolean not null default false,

  -- materiali
  pdf_cte_url                   text,
  pdf_scheda_url                text,
  script_apertura               text,
  obiezioni_comuni              jsonb not null default '[]'::jsonb,

  tags                          text[] not null default '{}',
  attiva                        boolean not null default true,
  created_at                    timestamptz not null default now(),
  updated_at                    timestamptz not null default now()
);
comment on table public.cte is 'PER-TENANT. Offerte del broker con targeting, vendibilità, validità, materiali.';

-- ---- 3.6 clienti (PER-TENANT: CRM minimo) ----------------------------------
create table if not exists public.clienti (
  id         uuid primary key default gen_random_uuid(),
  tenant_id  uuid not null references public.tenants(id) on delete cascade,
  nome       text,
  cognome    text,
  telefono   text,
  email      text,
  segmento   public.segmento_cliente not null default 'residenziale',
  codice_ateco text,                 -- Decisione #1: opzionale per business
  indirizzo  text,
  comune     text,
  cap        text,
  provincia  text,
  regione    text,
  note       text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on table public.clienti is 'PER-TENANT. Anagrafica CRM minima (residenziale + business).';

-- ---- 3.7 simulazioni (PER-TENANT: snapshot immutabili) ---------------------
create table if not exists public.simulazioni (
  id                   uuid primary key default gen_random_uuid(),
  tenant_id            uuid not null references public.tenants(id) on delete cascade,
  cliente_id           uuid references public.clienti(id) on delete set null,
  agente_user_id       uuid references auth.users(id) on delete set null,
  dati_input           jsonb not null default '{}'::jsonb,   -- consumi, F1/F2/F3, spesa attuale
  snapshot_offerte     jsonb not null default '[]'::jsonb,   -- IMMUTABILE: prezzi congelati al salvataggio
  offerta_scelta_id    uuid,                                  -- riferimento logico (no FK: lo snapshot deve sopravvivere)
  risparmio_annuo      numeric(12,2),
  risparmio_percentuale numeric(5,2),
  pdf_url              text,
  stato                text not null default 'bozza' check (stato in ('bozza','inviata','firmata')),
  created_at           timestamptz not null default now()
);
comment on table public.simulazioni is 'PER-TENANT. Decisione #5: snapshot immutabili dei prezzi al salvataggio.';

-- ---- 3.8 mercato_prezzi (GLOBALE: serie temporale) -------------------------
create table if not exists public.mercato_prezzi (
  id         uuid primary key default gen_random_uuid(),
  indice     text not null,            -- PUN, PSV, futures...
  data       date not null,
  valore     numeric(14,6) not null,
  unita      text not null default '€/kWh',
  created_at timestamptz not null default now(),
  unique (indice, data)
);
comment on table public.mercato_prezzi is 'GLOBALE. Serie temporale PUN/PSV. Popolata a mano ora, cron in fase 4.';

-- ---- 3.9 parametri_regolati (GLOBALE: ARERA per zona/periodo) --------------
create table if not exists public.parametri_regolati (
  id             uuid primary key default gen_random_uuid(),
  tipo_fornitura public.tipo_fornitura not null,  -- luce | gas
  ambito         text not null,                    -- zona elettrica o ambito gas
  trimestre      text not null,                    -- es. '2026-Q2'
  periodo_da     date not null,
  periodo_a      date not null,
  valori         jsonb not null default '{}'::jsonb, -- componenti regolate (trasporto, oneri, IVA, ecc.)
  created_at     timestamptz not null default now(),
  unique (tipo_fornitura, ambito, trimestre)
);
comment on table public.parametri_regolati is 'GLOBALE. Decisione #6: tariffe ARERA per zona, versionate trimestralmente.';

-- ---- 3.10 zone_territoriali (GLOBALE: regione -> zona) ---------------------
create table if not exists public.zone_territoriali (
  id             uuid primary key default gen_random_uuid(),
  regione        text not null unique,
  zona_elettrica text not null,   -- NORD, CNOR, CSUD, SUD, SICI, SARD
  ambito_gas     text,            -- 6 ambiti; NULL per Sardegna (storicamente fuori rete metano)
  created_at     timestamptz not null default now()
);
comment on table public.zone_territoriali is 'GLOBALE. Mapping regione -> 6 zone elettriche / 6 ambiti gas ARERA.';

-- ============================================================================
-- 4. INDICI
-- ============================================================================
create index if not exists idx_tenant_members_user      on public.tenant_members(user_id);
create index if not exists idx_cte_tenant               on public.cte(tenant_id);
create index if not exists idx_cte_fornitore            on public.cte(fornitore_id);
create index if not exists idx_cte_tenant_attiva        on public.cte(tenant_id, attiva);
create index if not exists idx_clienti_tenant           on public.clienti(tenant_id);
create index if not exists idx_simulazioni_tenant       on public.simulazioni(tenant_id);
create index if not exists idx_simulazioni_cliente      on public.simulazioni(cliente_id);
create index if not exists idx_mercato_prezzi_idx_data  on public.mercato_prezzi(indice, data desc);
create index if not exists idx_parametri_lookup         on public.parametri_regolati(tipo_fornitura, ambito, periodo_da desc);

-- ============================================================================
-- 5. TRIGGER updated_at
-- ============================================================================
drop trigger if exists trg_tenants_updated   on public.tenants;
create trigger trg_tenants_updated   before update on public.tenants   for each row execute function public.set_updated_at();
drop trigger if exists trg_fornitori_updated on public.fornitori;
create trigger trg_fornitori_updated before update on public.fornitori for each row execute function public.set_updated_at();
drop trigger if exists trg_cte_updated       on public.cte;
create trigger trg_cte_updated       before update on public.cte       for each row execute function public.set_updated_at();
drop trigger if exists trg_clienti_updated   on public.clienti;
create trigger trg_clienti_updated   before update on public.clienti   for each row execute function public.set_updated_at();

-- ============================================================================
-- 6. FUNZIONI HELPER (security definer: bypassano RLS al loro interno)
-- ============================================================================
create or replace function public.current_tenant_id()
returns uuid
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select tenant_id
  from public.tenant_members
  where user_id = auth.uid()
  order by created_at
  limit 1;
$$;
comment on function public.current_tenant_id is 'Tenant del login corrente (single-tenant per utente nell''MVP).';

create or replace function public.is_platform_admin()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (select 1 from public.platform_admins where user_id = auth.uid());
$$;

-- ============================================================================
-- 7. GRANT (la RLS restringe sopra a questi privilegi)
-- ============================================================================
grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;

-- ============================================================================
-- 8. RLS
-- ============================================================================
alter table public.platform_admins   enable row level security;
alter table public.tenants            enable row level security;
alter table public.tenant_members     enable row level security;
alter table public.fornitori          enable row level security;
alter table public.cte                enable row level security;
alter table public.clienti            enable row level security;
alter table public.simulazioni        enable row level security;
alter table public.mercato_prezzi     enable row level security;
alter table public.parametri_regolati enable row level security;
alter table public.zone_territoriali  enable row level security;

-- ---- 8.1 platform_admins: leggi solo te stesso; scrittura solo service_role
create policy pa_select_self on public.platform_admins
  for select to authenticated using (user_id = auth.uid());

-- ---- 8.2 tenants: vedi/aggiorna il tuo tenant; admin vede tutto -------------
create policy tenants_select on public.tenants
  for select to authenticated
  using (id = public.current_tenant_id() or public.is_platform_admin());
create policy tenants_update on public.tenants
  for update to authenticated
  using (id = public.current_tenant_id() or public.is_platform_admin())
  with check (id = public.current_tenant_id() or public.is_platform_admin());
-- INSERT/DELETE tenant solo via service_role / platform admin
create policy tenants_admin_write on public.tenants
  for insert to authenticated with check (public.is_platform_admin());
create policy tenants_admin_delete on public.tenants
  for delete to authenticated using (public.is_platform_admin());

-- ---- 8.3 tenant_members: vedi i membri del tuo tenant ----------------------
create policy tm_select on public.tenant_members
  for select to authenticated
  using (tenant_id = public.current_tenant_id() or public.is_platform_admin());
create policy tm_admin_write on public.tenant_members
  for all to authenticated
  using (public.is_platform_admin())
  with check (public.is_platform_admin());

-- ---- 8.4 Tabelle PER-TENANT: pattern isolamento completo -------------------
-- cte
create policy cte_select on public.cte for select to authenticated
  using (tenant_id = public.current_tenant_id() or public.is_platform_admin());
create policy cte_insert on public.cte for insert to authenticated
  with check (tenant_id = public.current_tenant_id() or public.is_platform_admin());
create policy cte_update on public.cte for update to authenticated
  using (tenant_id = public.current_tenant_id() or public.is_platform_admin())
  with check (tenant_id = public.current_tenant_id() or public.is_platform_admin());
create policy cte_delete on public.cte for delete to authenticated
  using (tenant_id = public.current_tenant_id() or public.is_platform_admin());

-- clienti
create policy clienti_select on public.clienti for select to authenticated
  using (tenant_id = public.current_tenant_id() or public.is_platform_admin());
create policy clienti_insert on public.clienti for insert to authenticated
  with check (tenant_id = public.current_tenant_id() or public.is_platform_admin());
create policy clienti_update on public.clienti for update to authenticated
  using (tenant_id = public.current_tenant_id() or public.is_platform_admin())
  with check (tenant_id = public.current_tenant_id() or public.is_platform_admin());
create policy clienti_delete on public.clienti for delete to authenticated
  using (tenant_id = public.current_tenant_id() or public.is_platform_admin());

-- simulazioni (snapshot: niente UPDATE per gli utenti, solo admin)
create policy sim_select on public.simulazioni for select to authenticated
  using (tenant_id = public.current_tenant_id() or public.is_platform_admin());
create policy sim_insert on public.simulazioni for insert to authenticated
  with check (tenant_id = public.current_tenant_id() or public.is_platform_admin());
create policy sim_update_admin on public.simulazioni for update to authenticated
  using (public.is_platform_admin())
  with check (public.is_platform_admin());
create policy sim_delete on public.simulazioni for delete to authenticated
  using (tenant_id = public.current_tenant_id() or public.is_platform_admin());

-- ---- 8.5 Tabelle GLOBALI: lettura per tutti gli autenticati, scrittura admin
-- fornitori
create policy fornitori_select on public.fornitori for select to authenticated using (true);
create policy fornitori_write_admin on public.fornitori for insert to authenticated with check (public.is_platform_admin());
create policy fornitori_update_admin on public.fornitori for update to authenticated using (public.is_platform_admin()) with check (public.is_platform_admin());
create policy fornitori_delete_admin on public.fornitori for delete to authenticated using (public.is_platform_admin());

-- mercato_prezzi
create policy mp_select on public.mercato_prezzi for select to authenticated using (true);
create policy mp_write_admin on public.mercato_prezzi for insert to authenticated with check (public.is_platform_admin());
create policy mp_update_admin on public.mercato_prezzi for update to authenticated using (public.is_platform_admin()) with check (public.is_platform_admin());
create policy mp_delete_admin on public.mercato_prezzi for delete to authenticated using (public.is_platform_admin());

-- parametri_regolati
create policy pr_select on public.parametri_regolati for select to authenticated using (true);
create policy pr_write_admin on public.parametri_regolati for insert to authenticated with check (public.is_platform_admin());
create policy pr_update_admin on public.parametri_regolati for update to authenticated using (public.is_platform_admin()) with check (public.is_platform_admin());
create policy pr_delete_admin on public.parametri_regolati for delete to authenticated using (public.is_platform_admin());

-- zone_territoriali
create policy zt_select on public.zone_territoriali for select to authenticated using (true);
create policy zt_write_admin on public.zone_territoriali for insert to authenticated with check (public.is_platform_admin());
create policy zt_update_admin on public.zone_territoriali for update to authenticated using (public.is_platform_admin()) with check (public.is_platform_admin());
create policy zt_delete_admin on public.zone_territoriali for delete to authenticated using (public.is_platform_admin());

-- ============================================================================
-- 9. SEED DATA
-- ============================================================================

-- ---- 9.1 fornitori (5 principali) ------------------------------------------
insert into public.fornitori (slug, nome, colore, provvigione_default, provvigione_tipo) values
  ('enel',       'Enel Energia',   '#0d4f8b', 60.00, 'fisso'),
  ('eni',        'Eni Plenitude',  '#f7c700', 65.00, 'fisso'),
  ('hera',       'Hera Comm',      '#e2001a', 55.00, 'fisso'),
  ('edison',     'Edison Energia', '#e30613', 58.00, 'fisso'),
  ('a2a',        'A2A Energia',    '#009b3a', 50.00, 'fisso')
on conflict (slug) do nothing;

-- ---- 9.2 zone_territoriali (20 regioni) ------------------------------------
insert into public.zone_territoriali (regione, zona_elettrica, ambito_gas) values
  ('Valle d''Aosta',         'NORD', 'NORD_OVEST'),
  ('Piemonte',               'NORD', 'NORD_OVEST'),
  ('Liguria',                'NORD', 'NORD_OVEST'),
  ('Lombardia',              'NORD', 'NORD_EST'),
  ('Trentino-Alto Adige',    'NORD', 'NORD_EST'),
  ('Veneto',                 'NORD', 'NORD_EST'),
  ('Friuli-Venezia Giulia',  'NORD', 'NORD_EST'),
  ('Emilia-Romagna',         'NORD', 'NORD_EST'),
  ('Toscana',                'CNOR', 'CENTRALE'),
  ('Umbria',                 'CNOR', 'CENTRALE'),
  ('Marche',                 'CNOR', 'CENTRALE'),
  ('Lazio',                  'CSUD', 'CENTRO_SUD_OCC'),
  ('Abruzzo',                'CSUD', 'CENTRO_SUD_OR'),
  ('Campania',               'CSUD', 'CENTRO_SUD_OCC'),
  ('Molise',                 'SUD',  'CENTRO_SUD_OR'),
  ('Puglia',                 'SUD',  'CENTRO_SUD_OR'),
  ('Basilicata',             'SUD',  'CENTRO_SUD_OR'),
  ('Calabria',               'SUD',  'MERIDIONALE'),
  ('Sicilia',                'SICI', 'MERIDIONALE'),
  ('Sardegna',               'SARD', null)
on conflict (regione) do nothing;

-- ---- 9.3 mercato_prezzi: 30 giorni PUN (€/kWh) + 30 giorni PSV (€/Smc) ------
insert into public.mercato_prezzi (indice, data, valore, unita)
select 'PUN',
       (current_date - g)::date,
       round((0.1150 + 0.0100 * sin(g::numeric / 3))::numeric, 5),
       '€/kWh'
from generate_series(0, 29) as g
on conflict (indice, data) do nothing;

insert into public.mercato_prezzi (indice, data, valore, unita)
select 'PSV',
       (current_date - g)::date,
       round((0.4200 + 0.0300 * sin(g::numeric / 4))::numeric, 5),
       '€/Smc'
from generate_series(0, 29) as g
on conflict (indice, data) do nothing;

-- ---- 9.4 parametri_regolati: esempio trimestre corrente (2026-Q2) ----------
-- Valori PLACEHOLDER: da sostituire con dati ARERA reali.
insert into public.parametri_regolati (tipo_fornitura, ambito, trimestre, periodo_da, periodo_a, valori) values
  ('luce','NORD','2026-Q2','2026-04-01','2026-06-30','{"trasporto_gestione":0.0150,"oneri_sistema":0.0200,"iva":0.10,"accise":0.0227}'),
  ('luce','CNOR','2026-Q2','2026-04-01','2026-06-30','{"trasporto_gestione":0.0150,"oneri_sistema":0.0200,"iva":0.10,"accise":0.0227}'),
  ('luce','CSUD','2026-Q2','2026-04-01','2026-06-30','{"trasporto_gestione":0.0150,"oneri_sistema":0.0200,"iva":0.10,"accise":0.0227}'),
  ('luce','SUD','2026-Q2','2026-04-01','2026-06-30','{"trasporto_gestione":0.0150,"oneri_sistema":0.0200,"iva":0.10,"accise":0.0227}'),
  ('luce','SICI','2026-Q2','2026-04-01','2026-06-30','{"trasporto_gestione":0.0150,"oneri_sistema":0.0200,"iva":0.10,"accise":0.0227}'),
  ('luce','SARD','2026-Q2','2026-04-01','2026-06-30','{"trasporto_gestione":0.0150,"oneri_sistema":0.0200,"iva":0.10,"accise":0.0227}'),
  ('gas','NORD_OVEST','2026-Q2','2026-04-01','2026-06-30','{"trasporto":0.0900,"oneri":0.0400,"iva":0.10,"accise":0.0440}'),
  ('gas','NORD_EST','2026-Q2','2026-04-01','2026-06-30','{"trasporto":0.0900,"oneri":0.0400,"iva":0.10,"accise":0.0440}'),
  ('gas','CENTRALE','2026-Q2','2026-04-01','2026-06-30','{"trasporto":0.0950,"oneri":0.0400,"iva":0.10,"accise":0.0440}'),
  ('gas','CENTRO_SUD_OR','2026-Q2','2026-04-01','2026-06-30','{"trasporto":0.1000,"oneri":0.0400,"iva":0.10,"accise":0.0440}'),
  ('gas','CENTRO_SUD_OCC','2026-Q2','2026-04-01','2026-06-30','{"trasporto":0.1000,"oneri":0.0400,"iva":0.10,"accise":0.0440}'),
  ('gas','MERIDIONALE','2026-Q2','2026-04-01','2026-06-30','{"trasporto":0.1050,"oneri":0.0400,"iva":0.10,"accise":0.0440}')
on conflict (tipo_fornitura, ambito, trimestre) do nothing;

-- ============================================================================
-- 10. BOOTSTRAP (eseguire DOPO aver collegato Supabase Auth e fatto signup)
--     Da lanciare nel SQL editor (gira come service_role -> bypassa la RLS).
-- ============================================================================
-- -- 1) crea il tuo tenant
-- insert into public.tenants (slug, nome, piano)
-- values ('lucegas-vicenza', 'Luce Gas Vicenza', 'pro')
-- returning id;
--
-- -- 2) collega il tuo utente Auth come owner (sostituisci gli UUID)
-- insert into public.tenant_members (tenant_id, user_id, role)
-- values ('<TENANT_ID>', '<AUTH_UID>', 'owner');
--
-- -- 3) registrati come platform admin
-- insert into public.platform_admins (user_id, nome)
-- values ('<AUTH_UID>', 'Enrico');
-- ============================================================================
