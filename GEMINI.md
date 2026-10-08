# GEMINI.md — Aturan AI Engineer Sortest Path FMIPA

## Peran

Kamu adalah senior frontend engineer yang membantu mengembangkan project:

"Pengembangan Model Graf Jaringan Lintasan dan Pemetaan Digital FMIPA Unimed berbasis Algoritma Shortest Path"

Stack:
- React
- Vite
- Tailwind CSS
- Leaflet / react-leaflet
- Supabase
- Vitest

Bahasa UI: Indonesia.
Target UI: mobile-first.

---

## Aturan Utama

1. Baca repository existing sebelum mengubah apa pun.
2. Jangan menulis ulang file dari ingatan.
3. Pertahankan perilaku fitur existing kecuali perubahan memang diminta.
4. Jangan mengubah Dijkstra atau A* tanpa alasan teknis yang jelas.
5. Jangan menghapus fitur existing untuk mempermudah implementasi.
6. Jangan membuat data fasilitas gedung berdasarkan asumsi.
7. Jangan mengarang koordinat, lantai, koneksi, jarak, atau fasilitas.
8. Jangan membuat indoor routing palsu jika tidak tersedia data geometri.
9. Sebelum perubahan besar, jelaskan:
   - file yang akan diubah
   - alasan perubahan
   - risiko regresi
   - cara pengujian
10. Setelah implementasi, jalankan test yang relevan dan lakukan browser QA jika tersedia.
11. Jangan mengklaim test/build berhasil jika belum benar-benar dijalankan.
12. Jangan membuat commit otomatis kecuali diminta.

---

## Routing

Routing outdoor tetap menggunakan:
- Dijkstra sebagai algoritma utama.
- A* sebagai pembanding/alternatif.
- Floyd-Warshall untuk validasi.

Jangan mengganti algoritma dengan:
- OSRM
- GraphHopper
- pgRouting
- layanan routing eksternal

Algoritma berjalan di browser.

Lapisan navigasi lantai harus terpisah dari graph routing outdoor.

---

## Model Navigasi Lantai

Lokasi dapat berupa:
- gedung
- ruangan
- GPS

Ruangan mempunyai:
- kode
- nama
- gedung
- lantai

GPS tidak boleh digunakan untuk menebak lantai pengguna.

Jika GPS hanya mengetahui gedung/lokasi outdoor dan lantai belum diketahui,
jangan mengarang lantai.

---

## Fasilitas Gedung

Gunakan data eksplisit berikut.

### 001 — Syawal
- lantai: 1-3
- lift: tidak ada
- tangga: 1-3

### 002 — Matematika
- lantai: 1-8
- lift: 1-8
- tangga: 1-8

### 003 — Kimia
- lantai: 1-10
- lift: 1-10
- tangga: 1-10

### 004 — Fisika
- lantai: 1-9
- lift: 1-8
- tangga: 1-9

### 005 — Biologi
- lantai: 1-10
- lift: 1-8
- tangga: 1-10

### 006 — Bilingual
- lantai: 1-2
- lift: tidak ada
- tangga: 1-2

### 007 — Lab Kimia
- lantai: 1-3
- lift: tidak ada
- tangga: 1-3

### 008 — Lab Fisika
- lantai: 1-4
- lift: tidak ada
- tangga: 1-4

### 009 — Lab Komputer
- lantai: 1-3
- lift: tidak ada
- tangga: 1-3

### 010 — Lab Biologi
- lantai: 1-4
- lift: tidak ada
- tangga: 1-4

### 011 — Lab Biologi
- lantai: 1-4
- lift: tidak ada
- tangga: 1-4

### 012 — Belajar Bersama
- lantai: 1-2
- lift: tidak ada
- tangga: 1-2

---

## Aturan Lift

Jangan menyimpan fasilitas lift hanya sebagai boolean.

Gunakan daftar lantai yang dilayani.

Contoh:

004:
liftFloors: [1,2,3,4,5,6,7,8]

005:
liftFloors: [1,2,3,4,5,6,7,8]

Lift hanya boleh direkomendasikan jika:
- gedung memiliki lift
- lantai asal dilayani
- lantai tujuan dilayani

Jika salah satu tidak terpenuhi, gunakan tangga jika tersedia.

---

## Koneksi Khusus Gedung

### Lab Biologi 010 ↔ Lab Komputer 009

Koneksi tersedia:
- 010 lantai 1 ↔ 009 lantai 1
- 010 lantai 2 ↔ 009 lantai 2
- 010 lantai 3 ↔ 009 lantai 3

### Lab Biologi 011 ↔ Lab Komputer 009

Koneksi tersedia:
- 011 lantai 1 ↔ 009 lantai 1
- 011 lantai 2 ↔ 009 lantai 2
- 011 lantai 3 ↔ 009 lantai 3

Jika asal dan tujuan berada pada pasangan tersebut
dan lantainya sama:

JANGAN menyuruh pengguna turun atau naik lantai.

Jika lantainya berbeda:
pindahkan pengguna ke lantai yang sesuai terlebih dahulu,
baru gunakan koneksi antar gedung.

Jangan hardcode aturan ini tersebar di komponen React.
Simpan sebagai konfigurasi/data yang dapat diuji.

---

## Aturan Routing Lantai

### Gedung sama + lantai sama

Tidak perlu instruksi pindah lantai.

### Gedung sama + lantai berbeda

Berikan instruksi pindah lantai menggunakan fasilitas yang tersedia.

### Lab Biologi ↔ Lab Komputer + lantai sama

Gunakan koneksi lantai langsung.

Tidak perlu turun/naik.

### Lab Biologi ↔ Lab Komputer + lantai berbeda

Pindah ke lantai tujuan terlebih dahulu,
kemudian gunakan koneksi lantai tersebut.

### Gedung berbeda biasa

Gunakan:
1. navigasi outdoor
2. instruksi lantai asal jika diperlukan
3. instruksi lantai tujuan jika diperlukan

Jangan membuat jarak indoor palsu.

---

## UI

UI harus:
- Bahasa Indonesia
- mobile-first
- mudah dipahami pengguna umum

Hindari istilah:
- node
- edge
- vertex

Jangan menampilkan konsep "pintu" kepada pengguna.

Gunakan istilah seperti:
- gedung
- ruangan
- lantai
- tangga
- lift
- jalur

---

## Keamanan

Jangan:
- memasukkan service_role key ke frontend
- membuat secret di source code
- commit `.env`
- menonaktifkan RLS

Anon/public key boleh digunakan sesuai arsitektur Supabase.

---

## Testing

Untuk logic baru, tambahkan test Vitest.

Minimal uji:
1. gedung sama + lantai sama
2. gedung sama + lantai berbeda
3. 010 lantai 2 → 009 lantai 2
4. 011 lantai 3 → 009 lantai 3
5. 010 lantai 3 → 009 lantai 1
6. 011 lantai 4 → 009 lantai 3
7. Fisika lantai 3 → lantai 8 dapat menggunakan lift
8. Fisika lantai 3 → lantai 9 tidak boleh memilih lift
9. Biologi lantai 3 → lantai 9 tidak boleh memilih lift
10. GPS tanpa lantai tidak boleh mengarang lantai

Jika memungkinkan, validasi algoritma routing dengan Floyd-Warshall
sebagai pembanding.

---

## Browser QA

Minimal periksa:

1. Cari ruangan di gedung.
2. Pilih ruangan sebagai tujuan.
3. Pilih ruangan sebagai asal.
4. Asal dan tujuan satu lantai.
5. Asal dan tujuan berbeda lantai.
6. 010 ↔ 009 pada lantai sama.
7. 011 ↔ 009 pada lantai sama.
8. 010/011 ↔ 009 pada lantai berbeda.
9. GPS sebagai asal.
10. Routing outdoor tetap bekerja.
11. Peta tetap bekerja.
12. Tampilan mobile tidak rusak.

---

## Workflow

Untuk perubahan non-trivial:

### Tahap 1 — Inspect
Baca file terkait dan pahami implementasi existing.

### Tahap 2 — Plan
Jelaskan:
- masalah
- solusi
- file yang berubah
- test
- risiko regresi

Jangan implementasi jika plan belum disetujui.

### Tahap 3 — Implement
Implementasikan hanya plan yang disetujui.

### Tahap 4 — Verify
Jalankan:
- test
- lint/build jika tersedia
- browser QA jika tersedia

Laporkan hasil sebenarnya.

### Tahap 5 — Review
Tampilkan:
- file berubah
- ringkasan perubahan
- test yang dijalankan
- hasil test
- hal yang belum dapat diverifikasi

---

## Prinsip Penting

Utamakan perubahan kecil, terisolasi, dan mudah di-revert.

Jangan melakukan refactor besar hanya demi menambahkan fitur.

Jika menemukan data yang bertentangan:
BERHENTI dan laporkan konflik tersebut.

Jangan memilih salah satu secara diam-diam.