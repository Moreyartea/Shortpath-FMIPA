import { describe, expect, test } from 'vitest'
import { graphData, indeks, ruangan, tempat } from './helpers'
import { kategoriDariNama, normalisasiRuangan, petaKodeKeTempat, ruanganPerLantai, ringkasanIsi, kunciRuangan, cariRuanganDariKunci } from '../src/lib/rooms'
import { namaTitik, posisiRelatif, ringkasOrientasi, tempatTerhubung } from '../src/lib/places'
import { bearing, namaArah, pusatPoligon } from '../src/lib/geo'
import { formatJarak, perkiraanMenit, teksMenit, teksLantai } from '../src/lib/format'
import { bacaUrl, tulisUrl } from '../src/lib/urlState'
import { pesanGalatGps } from '../src/lib/gps'

describe('Kategori dan normalisasi ruangan', () => {
  test('kategori dari nama', () => {
    expect(kategoriDariNama('Kamar Mandi Pria')).toBe('toilet')
    expect(kategoriDariNama('Toilet Lk')).toBe('toilet')
    expect(kategoriDariNama('Musholla')).toBe('ibadah')
    expect(kategoriDariNama('Ruang Laboran')).toBe('kantor')
    expect(kategoriDariNama('Lab Jaringan')).toBe('laboratorium')
    expect(kategoriDariNama('Ruang Kuliah 3')).toBe('kelas')
    expect(kategoriDariNama('Ruang Rapat Dekan')).toBe('kantor')
    expect(kategoriDariNama('Ruang Entah')).toBe('lainnya')
  })

  test('bentuk lokal dan bentuk Supabase sama-sama dikenali', () => {
    const peta = petaKodeKeTempat(tempat)
    const lokal = normalisasiRuangan({ kode: '002.1.01', kodeGedung: '002', lantai: 1, nama: ' Ruang A ', status: 'ok' }, 0, peta)
    const db = normalisasiRuangan({ kode: '002.1.01', gedung_id: '002', lantai: 1, nama: 'Ruang A', alias: null }, 1, peta)
    expect(lokal.tempatId).toBe('matematika')
    expect(db.tempatId).toBe('matematika')
    expect(lokal.nama).toBe('Ruang A')
    expect(lokal.kodeTampil).toBe('002.1.01')
    expect(db.kodeTampil).toBe('002.1.01')
  })

  test('kode sementara disembunyikan, lantai kosong menjadi null, kode tak dikenal tanpa tempat', () => {
    const peta = petaKodeKeTempat(tempat)
    expect(normalisasiRuangan({ kode: '003.1.01', kodeGedung: '003', lantai: 1, nama: 'X', status: 'kode_sementara' }, 0, peta).kodeTampil).toBe('')
    expect(normalisasiRuangan({ kode: '', kodeGedung: '001', lantai: null, nama: 'Dekan' }, 0, peta).lantai).toBeNull()
    expect(normalisasiRuangan({ kode: 'x', kodeGedung: '999', lantai: 1, nama: 'Y' }, 0, peta).tempatId).toBeNull()
    expect(peta.get('010')).toBe('lab-biologi')
    expect(peta.get('011')).toBe('lab-biologi')
    expect(peta.get('010/011?')).toBe('lab-biologi')
  })

  test('ID ruangan unik walau kode ganda', () => {
    const ids = ruangan.map((r) => r.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  test('kunci ruangan bisa dipakai untuk menemukan kembali ruangannya', () => {
    const r = ruangan.find((x) => x.nama === 'Dekan FMIPA')
    expect(cariRuanganDariKunci(ruangan, kunciRuangan(r))?.nama).toBe('Dekan FMIPA')
    expect(cariRuanganDariKunci(ruangan, 'tidak|ada|x')).toBeNull()
  })

  test('ruangan per lantai: urut lantai, lantai belum tercatat di akhir', () => {
    const per = ruanganPerLantai(ruangan, 'syawal')
    const lantai = per.map((p) => p.lantai)
    expect(lantai.at(-1)).toBeNull()
    expect(lantai.slice(0, -1)).toEqual([...lantai.slice(0, -1)].sort((a, b) => a - b))
  })

  test('ringkasan isi dihitung dari data', () => {
    const r = ringkasanIsi(ruangan, 'matematika')
    expect(r.total).toBeGreaterThan(50)
    expect(r.fasilitas.find((f) => f.kunci === 'toilet').jumlah).toBeGreaterThan(0)
    expect(r.penting.find((p) => p.label === 'Administrasi jurusan')).toBeTruthy()
    const s = ringkasanIsi(ruangan, 'syawal')
    expect(s.penting.find((p) => p.label === 'Pimpinan fakultas')).toBeTruthy()
  })
})

describe('Tempat, arah, dan orientasi', () => {
  test('nama titik ramah pengguna', () => {
    expect(namaTitik(indeks, 7)).toBe('Lobi Utara Gedung Syawal')
    expect(namaTitik(indeks, 1)).toBe('Gedung Fisika')
    expect(namaTitik(indeks, 999)).toBe('Titik 999')
  })

  test('arah mata angin', () => {
    expect(namaArah(0)).toBe('utara')
    expect(namaArah(44)).toBe('timur laut')
    expect(namaArah(180)).toBe('selatan')
    expect(namaArah(271)).toBe('barat')
    expect(namaArah(359)).toBe('utara')
    expect(namaArah(-10)).toBe('utara')
    expect(bearing(0, 0, 1, 0)).toBeCloseTo(0, 5)
    expect(bearing(0, 0, 0, 1)).toBeCloseTo(90, 5)
  })

  test('empat gedung jurusan berada di sekeliling Syawal pada empat sudut berbeda', () => {
    const arah = Object.fromEntries(['fisika', 'biologi', 'matematika', 'kimia'].map((id) => [id, posisiRelatif(indeks, 'syawal', id).arah]))
    expect(arah).toEqual({ fisika: 'barat laut', biologi: 'timur laut', matematika: 'tenggara', kimia: 'barat daya' })
  })

  test('orientasi: pusat adalah Syawal dan empat gedung jurusan tersambung langsung', () => {
    const o = ringkasOrientasi(indeks, graphData.graph)
    expect(o.pusat.id).toBe('syawal')
    const terhubung = o.terhubung.map((x) => x.tempat.id)
    for (const id of ['fisika', 'biologi', 'matematika', 'kimia']) expect(terhubung).toContain(id)
    expect(o.terhubung.length + o.lainnya.length).toBe(tempat.length - 1)
  })

  test('tempat terhubung diurutkan dari yang terdekat', () => {
    const t = tempatTerhubung(indeks, graphData.graph, 'fisika')
    expect(t.length).toBeGreaterThan(1)
    for (let i = 1; i < t.length; i += 1) expect(t[i].jarak).toBeGreaterThanOrEqual(t[i - 1].jarak)
  })

  test('pusat poligon persegi', () => {
    const p = pusatPoligon([[0, 0], [2, 0], [2, 2], [0, 2], [0, 0]])
    expect(p.lon).toBeCloseTo(1, 9)
    expect(p.lat).toBeCloseTo(1, 9)
  })
})

describe('Format, URL, dan GPS', () => {
  test('format jarak dan waktu', () => {
    expect(formatJarak(245.3)).toBe('245 m')
    expect(formatJarak(1234)).toBe('1,23 km')
    expect(formatJarak(NaN)).toBe('-')
    expect(perkiraanMenit(220)).toBe(3)
    expect(perkiraanMenit(5)).toBe(1)
    expect(perkiraanMenit(0)).toBe(0)
    expect(teksMenit(30)).toBe('sekitar 1 menit')
    expect(teksLantai(3)).toBe('Lantai 3')
    expect(teksLantai(null)).toBe('lantai belum tercatat')
  })

  test('URL: tulis lalu baca kembali', () => {
    const s = tulisUrl({ dari: 'syawal', ke: 'fisika', ruang: 'fisika|1|ruang-dosen' })
    expect(bacaUrl(s)).toEqual({ dari: 'syawal', ke: 'fisika', ruang: 'fisika|1|ruang-dosen' })
    expect(tulisUrl({})).toBe('')
    expect(tulisUrl({ dari: 'a', ruang: 'x' })).toBe('?dari=a') // ruang tanpa tujuan diabaikan
    expect(bacaUrl('')).toEqual({ dari: '', ke: '', ruang: '' })
  })

  test('pesan galat GPS', () => {
    expect(pesanGalatGps({ code: 1 })).toMatch(/ditolak/)
    expect(pesanGalatGps({ code: 2 })).toMatch(/tidak tersedia/)
    expect(pesanGalatGps({ code: 3 })).toMatch(/terlalu lama/)
  })
})

describe('Bentuk peta', () => {
  test('setiap tempat punya poligon, pusat berada di dalam batas, dan batas memuat semua titik', async () => {
    const { bentukPoligon, batasPeta } = await import('../src/lib/peta')
    const { poligon, tempat: t, graphData: g } = await import('./helpers')
    const bentuk = bentukPoligon(poligon, t)
    expect(bentuk).toHaveLength(t.length)
    const batas = batasPeta(bentuk, g.pointsById)
    for (const b of bentuk) {
      expect(b.pusat.lat).toBeGreaterThan(batas[0][0])
      expect(b.pusat.lat).toBeLessThan(batas[1][0])
      expect(b.pusat.lon).toBeGreaterThan(batas[0][1])
      expect(b.pusat.lon).toBeLessThan(batas[1][1])
      expect(b.positions[0][0]).toHaveLength(2)
    }
    for (const p of Object.values(g.pointsById)) {
      expect(p.lat).toBeGreaterThan(batas[0][0])
      expect(p.lon).toBeLessThan(batas[1][1])
    }
  })
})
