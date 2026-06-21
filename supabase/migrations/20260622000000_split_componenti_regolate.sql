-- ============================================================================
-- RISPARMETRO — A0: Split componenti_regolate in tabelle dedicate luce/gas
--               + UNIQUE + migrazione dati su mercato_prezzi
-- ============================================================================
--
-- DEBITO TECNICO #1: tabella `impostazioni` non esiste nel DB remoto.
-- L'app legge valori da DEFAULTS hardcoded in ImpostazioniTab.tsx via
-- fallback null→DEFAULTS. Il seed luce di questa migration replica quei
-- DEFAULTS per garantire parità con lo stato operativo attuale.
--
-- DEBITO TECNICO #2: `simulaBollettaGas` legge iva_dom/iva_bus da
-- `impostazioni` → null → DEFAULTS UI. Il gas oggi gira su default UI,
-- non su valori ARERA reali. Da affrontare quando si costruisce
-- componenti_regolate_gas seriamente (Blocco GAS / Step 19).
--
-- DEBITO TECNICO #3: questa migration non è 100% riproducibile da zero
-- per i seed gas/mercato. Dipende da righe tipo='gas' e tipo='mercato'
-- presenti nel DB remoto ma non in migration (drift Dashboard).
-- Consolidamento: rinviato a sessione A0-ter dopo A1.
--
-- ============================================================================

-- ----------------------------------------------------------------------------
-- [A] componenti_regolate_luce
-- ----------------------------------------------------------------------------
create table if not exists public.componenti_regolate_luce (
  id                        uuid          primary key default gen_random_uuid(),
  validita_da               date          not null,
  validita_a                date          not null,

  -- Rete (ARERA σ)
  sigma1_mese               numeric(10,6) not null,   -- €/mese   quota fissa rete
  sigma2_kw_mese            numeric(10,6) not null,   -- €/kW/mese quota potenza
  sigma3_uc3_kwh            numeric(10,6) not null,   -- €/kWh    quota variabile rete + UC3

  -- Oneri di sistema
  oneri_luce_fisso_mese     numeric(10,6) not null,   -- €/mese
  oneri_luce_var_kwh        numeric(10,6) not null,   -- €/kWh
  oneri_asos_fisso_nonres   numeric(10,6) null,       -- €/anno   solo non-residenti family

  -- Imposte
  accise_luce_dom           numeric(10,6) not null,   -- €/kWh   domestico
  accise_luce_bus           numeric(10,6) not null,   -- €/kWh   business
  soglia_esenzione_kwh_mese integer       not null,   -- kWh/mese soglia esenzione accise
  iva_dom                   numeric(6,4)  not null,   -- decimale es. 0.10
  iva_bus                   numeric(6,4)  not null,   -- decimale es. 0.22

  -- Altri costi fissi annui
  perdite_rete              numeric(10,6) not null,   -- moltiplicatore es. 1.10
  cdispd_anno               numeric(10,6) not null,   -- €/anno
  canone_rai_anno           numeric(10,4) not null,   -- €/anno

  note                      text          null,
  created_at                timestamptz   not null default now(),

  constraint crl_periodo_check check (validita_da <= validita_a)
);

create unique index if not exists uq_crl_periodo
  on public.componenti_regolate_luce (validita_da, validita_a);

create index if not exists idx_crl_periodo
  on public.componenti_regolate_luce (validita_da, validita_a);

comment on table public.componenti_regolate_luce is
  'GLOBALE. Parametri regolati ARERA luce versionati per trimestre. '
  'Fonte di verità per calcoli bolletta luce. Scrittura solo platform_admins.';

-- RLS
alter table public.componenti_regolate_luce enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'componenti_regolate_luce' and policyname = 'crl_select'
  ) then
    create policy crl_select on public.componenti_regolate_luce
      for select to authenticated using (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'componenti_regolate_luce' and policyname = 'crl_insert_admin'
  ) then
    create policy crl_insert_admin on public.componenti_regolate_luce
      for insert to authenticated
      with check (public.is_platform_admin());
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'componenti_regolate_luce' and policyname = 'crl_update_admin'
  ) then
    create policy crl_update_admin on public.componenti_regolate_luce
      for update to authenticated
      using  (public.is_platform_admin())
      with check (public.is_platform_admin());
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'componenti_regolate_luce' and policyname = 'crl_delete_admin'
  ) then
    create policy crl_delete_admin on public.componenti_regolate_luce
      for delete to authenticated
      using (public.is_platform_admin());
  end if;
end $$;

-- ----------------------------------------------------------------------------
-- [B] componenti_regolate_gas
--     Schema ridotto: accisa_aliquota e accisa_soglia_kwh escluse
--     (NULL su tutte le righe gas in DB — YAGNI fino a Blocco GAS)
-- ----------------------------------------------------------------------------
create table if not exists public.componenti_regolate_gas (
  id                              uuid          primary key default gen_random_uuid(),
  validita_da                     date          not null,
  validita_a                      date          not null,

  componente_copertura_rischi_gj  numeric(10,6) null,   -- €/GJ
  iva                             numeric(6,4)  null,   -- decimale (IVA gas per soglia gestita in calcoli)

  note                            text          null,
  created_at                      timestamptz   not null default now(),

  constraint crg_periodo_check check (validita_da <= validita_a)
);

create unique index if not exists uq_crg_periodo
  on public.componenti_regolate_gas (validita_da, validita_a);

create index if not exists idx_crg_periodo
  on public.componenti_regolate_gas (validita_da, validita_a);

comment on table public.componenti_regolate_gas is
  'GLOBALE. Parametri regolati ARERA gas versionati per trimestre. '
  'Scrittura solo platform_admins.';

-- RLS
alter table public.componenti_regolate_gas enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'componenti_regolate_gas' and policyname = 'crg_select'
  ) then
    create policy crg_select on public.componenti_regolate_gas
      for select to authenticated using (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'componenti_regolate_gas' and policyname = 'crg_insert_admin'
  ) then
    create policy crg_insert_admin on public.componenti_regolate_gas
      for insert to authenticated
      with check (public.is_platform_admin());
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'componenti_regolate_gas' and policyname = 'crg_update_admin'
  ) then
    create policy crg_update_admin on public.componenti_regolate_gas
      for update to authenticated
      using  (public.is_platform_admin())
      with check (public.is_platform_admin());
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'componenti_regolate_gas' and policyname = 'crg_delete_admin'
  ) then
    create policy crg_delete_admin on public.componenti_regolate_gas
      for delete to authenticated
      using (public.is_platform_admin());
  end if;
end $$;

-- ----------------------------------------------------------------------------
-- [C] Seed componenti_regolate_luce — II trim 2026
--     Valori da DEFAULTS ImpostazioniTab.tsx:21-24 (fonte operativa attuale).
--     Allineati ai valori usati dall'app oggi (impostazioni non esiste in DB).
--     NON necessariamente identici ai valori ARERA ufficiali: verifica delibera
--     in sessione successiva (DEBITO TECNICO #1).
-- ----------------------------------------------------------------------------
insert into public.componenti_regolate_luce (
  validita_da, validita_a,
  sigma1_mese, sigma2_kw_mese, sigma3_uc3_kwh,
  oneri_luce_fisso_mese, oneri_luce_var_kwh, oneri_asos_fisso_nonres,
  accise_luce_dom, accise_luce_bus, soglia_esenzione_kwh_mese,
  iva_dom, iva_bus,
  perdite_rete, cdispd_anno, canone_rai_anno,
  note
)
values (
  '2026-04-01', '2026-06-30',
  1.90, 2.106, 0.01057,
  0.50, 0.0350, null,
  0.0227, 0.0125, 150,
  0.10, 0.22,
  1.10, 1.23, 90,
  'Seed II trim 2026 — valori da DEFAULTS ImpostazioniTab.tsx. ' ||
  'Allineati ai valori operativi dell''app, NON necessariamente ' ||
  'identici ai valori ARERA ufficiali. Verifica delibera ARERA ' ||
  'in sessione successiva.'
)
on conflict (validita_da, validita_a) do nothing;

-- ----------------------------------------------------------------------------
-- [D] Seed componenti_regolate_gas — II trim 2026 da componenti_regolate
--     Dipende da: riga tipo='gas' validita_da='2026-04-01' nel DB remoto
--     (drift Dashboard — DEBITO TECNICO #3).
-- ----------------------------------------------------------------------------
insert into public.componenti_regolate_gas (
  validita_da, validita_a,
  componente_copertura_rischi_gj, iva,
  note
)
select
  validita_da, validita_a,
  componente_copertura_rischi_gj, iva,
  note
from public.componenti_regolate
where tipo = 'gas'
  and validita_da = '2026-04-01'
on conflict (validita_da, validita_a) do nothing;

-- ----------------------------------------------------------------------------
-- [E] mercato_prezzi — UNIQUE constraint + migrazione 4 righe
--     Dipende da: righe tipo='mercato' con validita_da 2026-04-01 e 2026-06-01
--     nel DB remoto (DEBITO TECNICO #3).
-- ----------------------------------------------------------------------------

-- Vincolo idempotente
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.mercato_prezzi'::regclass
      and conname  = 'mercato_prezzi_indice_data_unique'
  ) then
    alter table public.mercato_prezzi
      add constraint mercato_prezzi_indice_data_unique unique (indice, data);
  end if;
end $$;

-- Migrazione: righe tipo='mercato' × 2 indici → mercato_prezzi
-- Atteso: 2 date × 2 indici = 4 righe (ON CONFLICT DO NOTHING se già presenti)
insert into public.mercato_prezzi (indice, data, valore, unita)
select
  v.indice,
  cr.validita_da,
  case v.indice
    when 'PUN' then cr.pun_mensile
    else            cr.psv_mensile
  end,
  v.unita
from public.componenti_regolate cr
cross join (values ('PUN', '€/kWh'), ('PSV', '€/Smc')) as v(indice, unita)
where cr.tipo = 'mercato'
on conflict (indice, data) do nothing;

-- ----------------------------------------------------------------------------
-- [F] DROP posticipato
-- DROP componenti_regolate posticipato a sessione A0-bis dopo verifica parità A1.
-- ----------------------------------------------------------------------------
