-- ============================================================================
-- RLS TEST HELPERS — migration definitiva (unica)
--
-- Funzioni SECURITY DEFINER per il test di isolamento cross-tenant.
-- Gli utenti auth vengono creati/eliminati tramite Admin API (service_role)
-- nel codice di test. Queste funzioni gestiscono solo dati tenant pubblici.
-- ============================================================================

-- ── Crea un tenant e lega l'utente corrente come membro ────────────────────
create or replace function public.rls_test_create_tenant_and_link(p_slug text)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_tenant_id uuid;
  v_user_id   uuid := auth.uid();
begin
  if p_slug not like 'rls-test-%' then
    raise exception 'rls_test_create_tenant_and_link: solo slug rls-test-* ammessi';
  end if;
  if v_user_id is null then
    raise exception 'rls_test_create_tenant_and_link: richiede sessione autenticata';
  end if;

  insert into public.tenants (slug, nome, piano)
  values (p_slug, p_slug, 'base')
  returning id into v_tenant_id;

  insert into public.tenant_members (tenant_id, user_id, ruolo)
  values (v_tenant_id, v_user_id, 'admin');

  return v_tenant_id;
end;
$$;

grant execute on function public.rls_test_create_tenant_and_link(text)
  to authenticated;

-- ── Pulisce tutti i dati tenant di test (cascade elimina le righe figlio) ──
create or replace function public.rls_test_cleanup()
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  delete from public.tenants where slug like 'rls-test-%';
end;
$$;

grant execute on function public.rls_test_cleanup()
  to anon, authenticated;

-- ── Toggle RLS su una tabella (solo per controprova nel test) ───────────────
create or replace function public.rls_test_toggle_rls(p_table text, p_enable bool)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if p_table not in ('cte', 'clienti', 'simulazioni') then
    raise exception 'rls_test_toggle_rls: tabella non ammessa';
  end if;
  if p_enable then
    execute format('alter table public.%I enable row level security', p_table);
  else
    execute format('alter table public.%I disable row level security', p_table);
  end if;
end;
$$;

grant execute on function public.rls_test_toggle_rls(text, bool)
  to anon, authenticated;
