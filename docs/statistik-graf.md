# Statistik Graf & Analisa Topologi Jaringan FMIPA Unimed

Dokumen ini dihasilkan secara otomatis oleh \`scripts/statistik-graf.mjs\` berdasarkan data jaringan jalan pejalan kaki FMIPA Unimed di \`src/data/\` dan data cadangan historis tertua di \`scripts/cadangan/\`.

Tanggal Analisis: 2026-10-13T11:59:16.734Z

---

## 1. Perbandingan Jaringan: Lama vs Baru

Jaringan lama merujuk pada berkas cadangan paling awal (\`koordinat_fmipa_2026-10-10T13-10-21-064Z.geojson\` & \`edges_fmipa_2026-10-10T13-10-21-064Z.geojson\`) yang hanya menghubungkan 18 pintu gedung secara langsung. Jaringan baru merupakan model graf topologi pejalan kaki berpresisi tinggi dengan persimpangan noded.

| Metrik | Jaringan Lama (Cadangan Awal) | Jaringan Baru (Aktif) | Perubahan / Keterangan |
| :--- | :---: | :---: | :--- |
| **Jumlah Simpul** | **18** | **92** | +74 simpul |
| • Simpul Pintu (1–18) | 18 | 18 | Tetap (18 pintu) |
| • Simpul Persimpangan | 0 | 74 | +74 persimpangan noded |
| **Jumlah Ruas (Edges)** | **51** | **132** | +81 ruas |
| **Komponen Terhubung** | **1** | **1** | 1 (100% terhubung penuh) |
| **Distribusi Derajat Simpul** | | | |
| • Derajat Minimum | 1 | 1 | |
| • Derajat Maksimum | 10 | 4 | Penurunan dari 10 ke 4 (graf planar) |
| • Derajat Rata-rata | 5.67 | 2.87 | Penyesuaian topologi riil |
| • Histogram Derajat | Derajat 1: 1 simpul, Derajat 2: 1 simpul, Derajat 3: 1 simpul, Derajat 5: 5 simpul, Derajat 6: 4 simpul, Derajat 7: 3 simpul, Derajat 8: 2 simpul, Derajat 10: 1 simpul | Derajat 1: 7 simpul, Derajat 2: 9 simpul, Derajat 3: 65 simpul, Derajat 4: 11 simpul | |
| **Panjang Ruas Jalan** | | | |
| • Ruas Terpendek | 7.37 m | 0.97 m | Ruas mikro telah dibersihkan (>= 0,25 m) |
| • Ruas Terpanjang | 429.12 m | 182.37 m | Pecah menjadi segmen-segmen jalan riil |
| • Panjang Rata-rata Ruas | 97.09 m | 22.71 m | |
| • Total Panjang Jaringan | **4951.48 m** | **2997.46 m** | Efisiensi & penghapusan garis tumpang tindih |
| **Diameter Jaringan** | | | |
| • Diameter Antar-Simpul | 297.60 m (Simpul 3 ↔ 11) | 362.18 m (Simpul 55 ↔ 79) | Jalur terjauh di koridor kampus |
| • Diameter Antar-Tempat | 297.60 m (Gedung Matematika ↔ Lab. Biologi) | 257.75 m (Gedung Biologi ↔ Lab. Biologi) | Jarak pejalan kaki terjauh antar-gedung |

---

## 2. Struktur & Konektivitas Topologi Jaringan Aktif

### A. Simpul Berderajat 1 (Dead Ends)
Seluruh nama simpul diambil langsung dari \`src/data/tempat.json\` (nama tempat riil atau \`namaTitik\`):
* Jumlah: **7 simpul**
* **Simpul 9** — **Lab. Kimia** (Pintu Gedung): [lon: 98.7147639, lat: 3.6068333]
* **Simpul 12** — **Gedung Belajar Bersama** (Pintu Gedung): [lon: 98.7143417, lat: 3.6073667]
* **Simpul 13** — **Lab. Fisika** (Pintu Gedung): [lon: 98.7146833, lat: 3.6076250]
* **Simpul 14** — **Gedung Bilingual** (Pintu Gedung): [lon: 98.7154056, lat: 3.6066333]
* **Simpul 15** — **Rumah Hewan FMIPA** (Pintu Gedung): [lon: 98.7144638, lat: 3.6067057]
* **Simpul 16** — **Ruang Serbaguna Taman Biologi** (Pintu Gedung): [lon: 98.7145135, lat: 3.6064989]
* **Simpul 79** — **Non-pintu (jalur ke jalan raya)** (Batas Jalan): [lon: 98.7160069, lat: 3.6063310]

> **Catatan Validitas**: Simpul 79 adalah satu-satunya ujung buntu non-pintu yang sah, mewakili jalur pejalan kaki yang mengarah ke jalan raya (batas selatan kawasan FMIPA).

### B. Analisa Jembatan (Bridges) & Titik Potong (Cut Vertices)
* **Jumlah Jembatan**: **7 ruas** (\`19, 28, 48, 69, 94, 110, 111\`)
* **Jumlah Titik Potong**: **7 simpul** (\`17, 29, 35, 50, 62, 78, 86\`)

#### Verifikasi Struktural:
1. **Apakah seluruh 7 jembatan menyentuh simpul berderajat 1?**
   **YA (100%)**. Setiap jembatan merupakan ruas cabang tunggal (*pendant edge*) yang menghubungkan simpul berderajat 1 ke simpul tetangganya:
   - **Jembatan Ruas #19**: Ruas (14 ↔ 29) menghubungkan Simpul 14 (**Gedung Bilingual**, der. 1) dengan Simpul 29 (**Persimpangan #29**)
   - **Jembatan Ruas #28**: Ruas (9 ↔ 35) menghubungkan Simpul 9 (**Lab. Kimia**, der. 1) dengan Simpul 35 (**Persimpangan #35**)
   - **Jembatan Ruas #48**: Ruas (50 ↔ 12) menghubungkan Simpul 12 (**Gedung Belajar Bersama**, der. 1) dengan Simpul 50 (**Persimpangan #50**)
   - **Jembatan Ruas #69**: Ruas (13 ↔ 62) menghubungkan Simpul 13 (**Lab. Fisika**, der. 1) dengan Simpul 62 (**Persimpangan #62**)
   - **Jembatan Ruas #94**: Ruas (78 ↔ 79) menghubungkan Simpul 79 (**Non-pintu (jalur ke jalan raya)**, der. 1) dengan Simpul 78 (**Persimpangan #78**)
   - **Jembatan Ruas #110**: Ruas (86 ↔ 15) menghubungkan Simpul 15 (**Rumah Hewan FMIPA**, der. 1) dengan Simpul 86 (**Persimpangan #86**)
   - **Jembatan Ruas #111**: Ruas (17 ↔ 16) menghubungkan Simpul 16 (**Ruang Serbaguna Taman Biologi**, der. 1) dengan Simpul 17 (**Taman Biologi**)

2. **Apakah seluruh 7 titik potong adalah tetangga simpul berderajat 1?**
   **YA (100% Bijeksi)**. Himpunan titik potong persis sama dengan himpunan tetangga dari ketujuh simpul berderajat 1:
   - Simpul 9 (Lab. Kimia) ↔ Titik Potong **35**
   - Simpul 12 (Gedung Belajar Bersama) ↔ Titik Potong **50**
   - Simpul 13 (Lab. Fisika) ↔ Titik Potong **62**
   - Simpul 14 (Gedung Bilingual) ↔ Titik Potong **29**
   - Simpul 15 (Rumah Hewan FMIPA) ↔ Titik Potong **86**
   - Simpul 16 (Ruang Serbaguna Taman Biologi) ↔ Titik Potong **17**
   - Simpul 79 (Non-pintu jalan raya) ↔ Titik Potong **78**

3. **Analisa Graf Inti (Core Graph) setelah Ruas Ujung Dibuang**:
   Ketika seluruh 7 ruas ujung (jembatan) beserta 7 simpul berderajat 1 dilepas dari graf:
   - Jumlah Simpul Inti: **85 simpul** (92 - 7)
   - Jumlah Ruas Inti: **125 ruas** (132 - 7)
   - Komponen Terhubung: **1 komponen tunggal**
   - **Jumlah Titik Potong Graf Inti**: **0** (NOL)
   - **Jumlah Jembatan Graf Inti**: **0** (NOL)
   
   > **Kesimpulan Ketahanan Graf**: Graf inti bersifat **2-vertex-connected** dan **2-edge-connected** (*biconnected*). Seluruh koridor utama pejalan kaki FMIPA membentuk siklus tertutup (loop redundan), sehingga tidak memiliki *single point of failure* (titik kegagalan tunggal).

## 3. Daftar Ruas Pendek (< 3 Meter)

Pemeriksaan seluruh ruas dengan panjang \`< 3 m\`:

| ID Ruas | Panjang | Asal (Derajat) | Koordinat Asal (Lat, Lon) | Tujuan (Derajat) | Koordinat Tujuan (Lat, Lon) |
| :---: | :---: | :---: | :---: | :---: | :---: |
| **2** | **0.973 m** | Simpul 5 (der. 2) | 3.6071000, 98.7155444 | Simpul 20 (der. 3) | 3.6070913, 98.7155443 |
| **117** | **1.832 m** | Simpul 88 (der. 3) | 3.6068084, 98.7140802 | Simpul 89 (der. 3) | 3.6068249, 98.7140807 |
| **19** | **2.269 m** | Simpul 14 (der. 1) | 3.6066333, 98.7154056 | Simpul 29 (der. 4) | 3.6066320, 98.7154260 |

> **Catatan**: Kelayakan ruas pendek di lapangan belum diverifikasi; hanya data yang dilaporkan.

---

## 4. Validasi Algoritma Rute Terpendek (225 Pasangan Tempat)

Pengujian kesetaraan algoritma **Dijkstra**, **A***, dan **Floyd-Warshall** pada seluruh 225 pasangan tempat (15 × 15 tempat):

1. **Tanpa Aturan Jalur (\`aturanJalur.json = null\`)**:
   * Jumlah pasangan diuji: **225**
   * Status: **VALID (Dijkstra = A* = Floyd-Warshall)**
   * Selisih Maksimum: **5.6843e-14 m** (presisi mesin floating-point, << 0,001 m)
2. **Dengan Aturan Jalur (\`aturanJalur.json\` Aktif)**:
   * Jumlah pasangan diuji: **225**
   * Status: **VALID (Dijkstra = A* = Floyd-Warshall)**
   * Selisih Maksimum: **5.6843e-14 m** (presisi mesin floating-point, << 0,001 m)

---

## 5. Dampak Aturan Jalur (\`aturanJalur.json\`) Terhadap Jarak Antar-Tempat

* **Pasangan Tempat Terdampak**: **18 pasangan** dari 225 (8.0%)
* **Perubahan Jarak Rata-rata (pada pasangan terdampak)**: **23.00 meter**
* **Perubahan Jarak Rata-rata (seluruh 225 pasangan)**: **1.84 meter**
* **Perubahan Jarak Maksimum**: **47.27 meter**
* **Daftar Pasangan dengan Perubahan Jarak Signifikan**:
  1. **Gedung Syawal** ↔ **Gedung Fisika**: 37.35 m → 40.55 m (selisih: +3.21 m)
  2. **Gedung Syawal** ↔ **Gedung Biologi**: 31.64 m → 33.89 m (selisih: +2.25 m)
  3. **Gedung Syawal** ↔ **Lab. Fisika**: 122.05 m → 125.26 m (selisih: +3.21 m)
  4. **Gedung Fisika** ↔ **Gedung Syawal**: 37.35 m → 40.55 m (selisih: +3.21 m)
  5. **Gedung Fisika** ↔ **Rumah Hewan FMIPA**: 152.10 m → 173.98 m (selisih: +21.88 m)
  6. **Gedung Fisika** ↔ **Taman Biologi**: 161.37 m → 178.67 m (selisih: +17.30 m)
  7. **Gedung Fisika** ↔ **Ruang Serbaguna Taman Biologi**: 169.20 m → 186.49 m (selisih: +17.30 m)
  8. **Gedung Biologi** ↔ **Gedung Syawal**: 31.64 m → 33.89 m (selisih: +2.25 m)
  9. **Lab. Fisika** ↔ **Gedung Syawal**: 122.05 m → 125.26 m (selisih: +3.21 m)
  10. **Lab. Fisika** ↔ **Rumah Hewan FMIPA**: 187.00 m → 234.28 m (selisih: +47.27 m)
  *(dan 8 pasangan lainnya)*

* **Penyebab Perubahan**:
  1. Penutupan Pintu 7 (Lobi Utara Gedung Syawal) mengalihkan rute masuk/keluar ke Lobi Barat (Pintu 6) atau Lobi Timur (Pintu 5).
  2. Kebijakan Rumah Kaca (Simpul 18) hanya sebagai titik awal/tujuan mencegah jalur pejalan kaki transit menembus area Rumah Kaca.
