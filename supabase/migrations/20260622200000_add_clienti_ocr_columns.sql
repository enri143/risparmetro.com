-- Colonne OCR per il profilo cliente (B10 — estrazione anagrafica da bolletta)
alter table public.clienti
  add column if not exists pod               text,      -- codice punto di prelievo luce (IT + ~14 char)
  add column if not exists pdr               text,      -- codice punto di riconsegna gas (14 cifre)
  add column if not exists ragione_sociale   text,      -- azienda/P.IVA; alternativo a nome+cognome
  add column if not exists fornitore_attuale text,      -- fornitore estratto dalla bolletta
  add column if not exists offerta_attuale   text,      -- nome commerciale offerta in corso
  add column if not exists scadenza_offerta  date;      -- fine validità offerta (YYYY-MM-DD)

comment on column public.clienti.pod is 'Punto di Prelievo luce (es. IT001E12345678). Estratto via OCR da bolletta.';
comment on column public.clienti.pdr is 'Punto di Riconsegna gas (14 cifre). Estratto via OCR da bolletta.';
comment on column public.clienti.ragione_sociale is 'Ragione sociale per clienti business (P.IVA/azienda). Mutuamente esclusivo con nome+cognome.';
comment on column public.clienti.fornitore_attuale is 'Fornitore attuale estratto dalla bolletta OCR.';
comment on column public.clienti.offerta_attuale is 'Nome commerciale offerta in corso estratto dalla bolletta.';
comment on column public.clienti.scadenza_offerta is 'Data di scadenza offerta estratta dalla bolletta. Null se non ricavabile.';
