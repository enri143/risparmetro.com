-- ============================================================================
-- RISPARMETRO — Bucket bollette (privato) + persistenza OCR su simulazioni
-- Data: 2026-06-21
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Bucket 'bollette' — PRIVATO (public = false)
-- ----------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('bollette', 'bollette', false)
on conflict (id) do nothing;

-- ----------------------------------------------------------------------------
-- 2. RLS Storage: isolamento per tenant
--    Convenzione path: {tenant_id}/{uuid}.{ext}
-- ----------------------------------------------------------------------------
create policy "bollette_select_own"
  on storage.objects for select
  using (
    bucket_id = 'bollette'
    and (storage.foldername(name))[1] = public.current_tenant_id()::text
  );

create policy "bollette_insert_own"
  on storage.objects for insert
  with check (
    bucket_id = 'bollette'
    and (storage.foldername(name))[1] = public.current_tenant_id()::text
  );

create policy "bollette_update_own"
  on storage.objects for update
  using (
    bucket_id = 'bollette'
    and (storage.foldername(name))[1] = public.current_tenant_id()::text
  );

create policy "bollette_delete_own"
  on storage.objects for delete
  using (
    bucket_id = 'bollette'
    and (storage.foldername(name))[1] = public.current_tenant_id()::text
  );

-- ----------------------------------------------------------------------------
-- 3. Colonne OCR su simulazioni
-- ----------------------------------------------------------------------------
alter table public.simulazioni
  add column if not exists bolletta_ocr       jsonb,
  add column if not exists bolletta_file_path text;

comment on column public.simulazioni.bolletta_ocr is
  'Esito OCR completo: { extracted, confidence, raw, source: "gemini+claude", extracted_at }';
comment on column public.simulazioni.bolletta_file_path is
  'Path nel bucket bollette (es. {tenant_id}/{uuid}.pdf). Null se inserimento manuale.';
