# Peta FMIPA Unimed

Aplikasi web untuk mencari gedung dan ruangan di kawasan FMIPA Universitas Negeri Medan dan melihat rute jalan kaki tercepat. Dirancang agar mahasiswa baru yang belum mengenal kawasan ini bisa memakainya tanpa penjelasan.

Jalur terpendek dihitung dengan algoritma **Dijkstra** (utama) dan **A\*** (pembanding), dan hasilnya divalidasi dengan **Floyd-Warshall**. Semua implementasi ada di `src/lib/graph.js`.

## Fitur untuk pengguna

- **Cari tujuan dulu**: ketik nama gedung atau ruangan (mis. "dekan", "toilet", "lab komputer"). Singkatan dan sinonim dikenali (TU, WC, musholla, perpus), salah ketik diberi saran ("Maksud kamu ...?").
- **Titik awal dengan tiga cara**: lokasi saya (GPS), cari gedung, atau ketuk gedung di peta.
- **Rute otomatis**: jarak, perkiraan menit jalan kaki, pintu masuk yang disarankan, dan langkah-langkah bernama gedung dengan arah mata angin.
- **Hasil terdekat lebih dulu** setelah titik awal dipilih.
- **Jelajahi gedung**: penjelasan susunan kawasan, daftar gedung per kelompok, tetangga langsung tiap gedung, ringkasan isi (jumlah toilet, mushola, ruang penting), dan daftar ruangan per lantai.
- **Bagikan rute** lewat tautan; membuka tautan langsung menampilkan rute.
- **Panduan singkat** pada kunjungan pertama; bisa dibuka lagi lewat "Cara pakai".
- Nyaman di HP (panel bergeser dari bawah) dan di laptop, bisa dipakai dengan keyboard.

## Menjalankan

```bash
npm install
npm run dev        # pengembangan, http://localhost:5173
npm test           # 114 tes: data, algoritma, pencarian, tampilan
npm run lint
npm run build      # hasil di folder dist (statis, tanpa server)
```

Aplikasi sepenuhnya statis: data peta dan ruangan dibundel bersama aplikasi, jadi bisa dipasang di hosting statis mana pun (Cloudflare, Vercel, Netlify, GitHub Pages). Fitur GPS hanya berfungsi jika situs dibuka lewat **HTTPS** (atau `localhost`).

## Struktur

| Folder/berkas | Isi |
|---|---|
| `src/data/koordinat_fmipa.geojson` | Titik jaringan jalan: 93 simpul (18 pintu gedung + 75 persimpangan jalur) |
| `src/data/edges_fmipa.geojson` | Jalur jalan kaki: 133 ruas (MultiLineString), digambar di QGIS |
| `src/data/gedung_fmipa.geojson` | Poligon gedung untuk tampilan peta |
| `src/data/tempat.json` | **Sumber tunggal** daftar gedung: nama, kelompok, kode gedung kampus, titik jaringan, poligon |
| `src/data/rooms.json` | Data ruangan bawaan (dipakai jika Supabase belum diisi) |
| `src/lib/graph.js` | Graf, Dijkstra, A\*, Floyd-Warshall |
| `src/lib/routing.js` | Rute antar tempat, langkah rute, validasi |
| `src/lib/search.js`, `hasilCari.js` | Pencarian, sinonim, saran ejaan, pengurutan hasil |
| `src/lib/rooms.js`, `places.js` | Model ruangan dan tempat |
| `src/components/` | Tampilan |
| `scripts/bangun-jaringan.mjs` | Skrip noding & pembangun topologi jaringan dari data mentah QGIS |
| `supabase/schema.sql` | Tabel, keamanan (RLS), fungsi impor |
| `tests/` | Pengujian |

## Menambah data

**Gedung baru**: (1) gambar poligonnya di `gedung_fmipa.geojson`, (2) tambahkan titik dan jalurnya di `koordinat_fmipa.geojson` dan `edges_fmipa.geojson` (ID jalur harus unik), (3) tambahkan satu entri di `tempat.json`. Jalankan `npm test`: tes integritas data akan memberi tahu jika ada titik yang tidak dimiliki tempat, poligon yang tidak terpakai, ID ganda, atau jaringan yang terputus.

**Membangun ulang jaringan jalur**: Jika ada garis tengah pejalan kaki baru yang diekspor dari QGIS ke `scripts/data-mentah/edges_raw.geojson`:
```bash
node scripts/bangun-jaringan.mjs          # Mode kering (dry-run, validasi topologi & laporan)
node scripts/bangun-jaringan.mjs --tulis  # Mode tulis (mencadangkan ke scripts/cadangan/ lalu menulis src/data/)
```

**Ruangan baru**: lewat halaman admin (`#/admin`, butuh Supabase) atau dengan menambah baris di `rooms.json`. Kode ruangan mengikuti pola kampus `gedung.lantai.nomor` (mis. `001.1.12`).

## Supabase (opsional, untuk admin ruangan)

1. Buat project Supabase, jalankan `supabase/schema.sql` di SQL Editor.
2. Matikan pendaftaran publik (Authentication > Sign In / Providers > Allow new users to sign up = OFF), lalu buat satu user admin di Authentication > Users.
3. Salin `.env.example` menjadi `.env`, isi `VITE_SUPABASE_URL` dan `VITE_SUPABASE_ANON_KEY` (anon/publishable key). **Jangan pernah** memakai `service_role`/secret key di aplikasi ini.
4. Buka `#/admin`, masuk, lalu pakai "Salin data awal ke Supabase". Ruangan yang lantai atau kodenya belum jelas tercantum di "Perlu dilengkapi" dan harus dilengkapi lewat form. **Setelah Supabase berisi data, aplikasi memakai data Supabase sepenuhnya**, jadi lengkapi dulu ruangan penting (mis. ruang pimpinan fakultas) sebelum beralih.

Project Supabase paket gratis dijeda jika lama tidak aktif; buka aplikasinya sebelum demo.

## Yang diuji

- Integritas data: ID unik, ujung jalur menempel pada titiknya, jaringan terhubung, setiap titik dimiliki satu tempat, setiap poligon terpakai, lantai ruangan tidak melebihi jumlah lantai gedung.
- Algoritma: Dijkstra = Floyd-Warshall dan Dijkstra = A\* untuk semua pasangan tempat; bobot = panjang garis yang digambar.
- Pencarian: sinonim, saran ejaan, nama ganda per gedung dan lantai, ruangan tanpa lantai, pengurutan terdekat.
- Alur pengguna lengkap (cari, pilih titik awal, rute, tukar, bagikan, jelajah, GPS, panduan, admin) pada aplikasi utuh.
- Tampilan juga diperiksa di browser sungguhan (Chromium) pada layar 320 px, 390 px, dan desktop, termasuk ketukan pada poligon, izin GPS diberikan, ditolak, dan lokasi di luar kampus.

## Batasan

- Rute berakhir di gedung. Navigasi di dalam gedung (tangga, lift, koridor) belum tersedia.
- Jarak mengikuti jalur yang digambar manual; waktu memakai asumsi 1,2 m/detik dan belum diukur di lapangan.
- Peta dasar OpenStreetMap membutuhkan internet. Tidak ada mode offline.
- Beberapa data ruangan masih perlu dilengkapi (lihat daftar "Perlu dilengkapi" di halaman admin): lantai belum tercatat, kode sementara, dan dua kode ganda di Gedung Fisika.
