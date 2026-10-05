# Pemetaan Digital FMIPA Unimed

Aplikasi React + Vite + Tailwind + Leaflet untuk pemetaan jaringan lintasan dan shortest path FMIPA Unimed.

## Menjalankan

```bash
npm install
npm run dev
```

Untuk production:

```bash
npm run build
npm run preview
```

## Supabase

Salin `.env.example` menjadi `.env` lalu isi:

```text
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
```

Jalankan `supabase/schema.sql` pada SQL Editor Supabase. Pendaftaran publik harus dimatikan. Jangan masukkan `service_role` key ke frontend atau repository.

Tanpa konfigurasi Supabase, pencarian ruangan menggunakan data lokal hasil ekstraksi CSV. Setelah Supabase dikonfigurasi dan tabel berisi data, aplikasi membaca data Supabase.

## Fitur

- Peta gedung dan seluruh jalur.
- Rute Dijkstra dan perbandingan A*.
- Pencarian ruangan berdasarkan kode, nama, alias, dan gedung.
- GPS sebagai lokasi asal dan titik jaringan terdekat.
- Admin ruangan: login, tambah, ubah, hapus, filter, dan import massal.
- Mobile-first.

## Deploy

Project adalah static frontend. Deploy dapat dilakukan ke Vercel, Netlify, atau Cloudflare sesuai konfigurasi platform terbaru. Variabel `VITE_SUPABASE_URL` dan `VITE_SUPABASE_ANON_KEY` diisi pada environment variables platform.
