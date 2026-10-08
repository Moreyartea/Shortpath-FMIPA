create table if not exists public.ruangan (
  kode text primary key,
  gedung_id text not null,
  lantai integer not null,
  nomor text not null,
  nama text not null,
  alias text,
  kategori text,
  status text,
  catatan text,
  updated_at timestamptz not null default now(),
  constraint ruangan_lantai_check check (lantai >= 1),
  constraint ruangan_nama_check check (length(trim(nama)) > 0)
);

create index if not exists ruangan_gedung_idx on public.ruangan (gedung_id);
create index if not exists ruangan_lantai_idx on public.ruangan (gedung_id, lantai);

alter table public.ruangan enable row level security;

drop policy if exists "ruangan_public_read" on public.ruangan;
create policy "ruangan_public_read" on public.ruangan
  for select using (true);

drop policy if exists "ruangan_authenticated_insert" on public.ruangan;
create policy "ruangan_authenticated_insert" on public.ruangan
  for insert to authenticated with check (true);

drop policy if exists "ruangan_authenticated_update" on public.ruangan;
create policy "ruangan_authenticated_update" on public.ruangan
  for update to authenticated using (true) with check (true);

drop policy if exists "ruangan_authenticated_delete" on public.ruangan;
create policy "ruangan_authenticated_delete" on public.ruangan
  for delete to authenticated using (true);

-- Matikan pendaftaran publik di Authentication > Providers > Email.
-- Jangan pernah memasukkan service_role key ke frontend.

create or replace function public.bulk_upsert_rooms(payload jsonb)
returns integer
language plpgsql
security invoker
set search_path = public
as $$
declare
  item jsonb;
  total integer := 0;
  kode_value text;
  nama_value text;
  alias_value text;
  kategori_value text;
  status_value text;
  gedung_value text;
  lantai_value integer;
  nomor_value text;
begin
  if auth.uid() is null then
    raise exception 'Akses admin diperlukan';
  end if;

  if jsonb_typeof(payload) <> 'array' then
    raise exception 'Payload import harus berupa array';
  end if;

  for item in select * from jsonb_array_elements(payload)
  loop
    kode_value := trim(item->>'kode');
    nama_value := trim(item->>'nama');
    alias_value := nullif(trim(item->>'alias'), '');
    kategori_value := nullif(trim(item->>'kategori'), '');
    status_value := nullif(trim(item->>'status'), '');
    gedung_value := trim(item->>'gedung_id');
    lantai_value := (item->>'lantai')::integer;
    nomor_value := trim(item->>'nomor');

    if kode_value = '' or nama_value = '' or gedung_value = '' or lantai_value < 1 or nomor_value = '' then
      raise exception 'Ada baris import yang tidak valid';
    end if;

    insert into public.ruangan (kode, gedung_id, lantai, nomor, nama, alias, kategori, status)
    values (kode_value, gedung_value, lantai_value, nomor_value, nama_value, alias_value, kategori_value, status_value)
    on conflict (kode) do update set
      gedung_id = excluded.gedung_id,
      lantai = excluded.lantai,
      nomor = excluded.nomor,
      nama = excluded.nama,
      alias = excluded.alias,
      kategori = coalesce(excluded.kategori, public.ruangan.kategori),
      status = excluded.status,
      updated_at = now();

    total := total + 1;
  end loop;

  return total;
end;
$$;
