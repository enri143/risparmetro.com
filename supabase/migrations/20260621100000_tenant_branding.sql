-- ============================================================================
-- RISPARMETRO — tenant_branding + bucket brand-assets
-- Data: 2026-06-21
-- ============================================================================

-- ---- Tabella branding (1:1 con tenants) ------------------------------------
create table if not exists public.tenant_branding (
  tenant_id       uuid primary key references public.tenants(id) on delete cascade,
  brand_name      text not null,
  logo_url        text,                          -- nullable: obbligatorio in UI, non nel seed
  brand_phone     text not null,
  brand_email     text,
  accent_color    text not null default '#1D9E75',
  ragione_sociale text,
  piva            text,
  updated_at      timestamptz not null default now()
);

comment on table public.tenant_branding is
  'PER-TENANT 1:1. Dati branding white-label: logo, colori, recapiti per PDF.';

-- Trigger updated_at
drop trigger if exists trg_tenant_branding_updated on public.tenant_branding;
create trigger trg_tenant_branding_updated
  before update on public.tenant_branding
  for each row execute function public.set_updated_at();

-- Grant
grant select, insert, update, delete on public.tenant_branding to authenticated;

-- RLS
alter table public.tenant_branding enable row level security;

create policy branding_select on public.tenant_branding
  for select to authenticated
  using (tenant_id = public.current_tenant_id() or public.is_platform_admin());

create policy branding_insert on public.tenant_branding
  for insert to authenticated
  with check (tenant_id = public.current_tenant_id() or public.is_platform_admin());

create policy branding_update on public.tenant_branding
  for update to authenticated
  using  (tenant_id = public.current_tenant_id() or public.is_platform_admin())
  with check (tenant_id = public.current_tenant_id() or public.is_platform_admin());

create policy branding_delete on public.tenant_branding
  for delete to authenticated
  using (tenant_id = public.current_tenant_id() or public.is_platform_admin());

-- ---- Bucket Storage: brand-assets (pubblico in lettura) --------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'brand-assets',
  'brand-assets',
  true,
  2097152,   -- 2 MB
  array['image/png','image/jpeg','image/svg+xml','image/webp']
)
on conflict (id) do nothing;

-- Lettura pubblica (URL pubblici nei PDF)
create policy "brand_assets_public_read" on storage.objects
  for select using (bucket_id = 'brand-assets');

-- Write solo al proprio prefix {tenant_id}/
create policy "brand_assets_tenant_insert" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'brand-assets'
    and (storage.foldername(name))[1] = (public.current_tenant_id())::text
  );

create policy "brand_assets_tenant_update" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'brand-assets'
    and (storage.foldername(name))[1] = (public.current_tenant_id())::text
  );

create policy "brand_assets_tenant_delete" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'brand-assets'
    and (storage.foldername(name))[1] = (public.current_tenant_id())::text
  );
