import { describe, expect, test } from 'vitest'
import { aturan, edges, graphData, indeks, poligon, tempat } from './helpers'
import {
  hitungRute,
  jarakKeSemuaTempat,
  langkahRute,
  terapkanAturan,
  titikAktif,
  validasiSemuaTempat,
} from '../src/lib/routing'
import { findNearestPoint } from '../src/lib/gps'

describe('Aturan Jalur FMIPA (aturanJalur.json)', () => {
  test('titikAktif menyaring pintuTertutup dari tempat', () => {
    const syawal = indeks.byId.get('syawal')
    const aktif = titikAktif(syawal, aturan)
    expect(aktif).toEqual([5, 6, 8])
    expect(aktif).not.toContain(7)

    // Tempat tanpa pintu tertutup tetap utuh
    const fisika = indeks.byId.get('fisika')
    expect(titikAktif(fisika, aturan)).toEqual([1])

    // Tempat tanpa aturan mengembalikan semua titik
    expect(titikAktif(syawal, null)).toEqual([5, 6, 7, 8])
  })

  test('terapkanAturan mengosongkan ruas keluar titikUjungSaja kecuali dariTitik', () => {
    const gTersaring = terapkanAturan(graphData.graph, aturan, { dariTitik: [] })
    expect(gTersaring[18]).toEqual([])
    const gPulih = terapkanAturan(graphData.graph, aturan, { dariTitik: [18] })
    expect(gPulih[18].length).toBeGreaterThan(0)
  })

  test('jika semua titik sebuah tempat tertutup menghasilkan { found: false, alasan: "titik-tertutup" }', () => {
    const aturanPalsu = {
      pintuTertutup: [{ id: 1, alasan: 'Semua pintu Fisika ditutup' }],
      titikUjungSaja: [],
    }
    const tempatTertutup = { id: 'fisika', titik: [1], titikSemua: [1] }
    const titikKosong = titikAktif(tempatTertutup, aturanPalsu)
    expect(titikKosong).toHaveLength(0)

    titikKosong.alasan = 'titik-tertutup'
    const hasil = hitungRute(graphData, [3], titikKosong, aturanPalsu)
    expect(hasil.found).toBe(false)
    expect(hasil.alasan).toBe('titik-tertutup')
  })

  test('titikUjungSaja: tidak ada rute yang melewati simpul 18 sebagai titik antara', () => {
    let diuji = 0
    for (const a of indeks.daftar) {
      for (const b of indeks.daftar) {
        const r = hitungRute(graphData, a.titik, b.titik, aturan)
        if (!r.found) continue
        const titikAntara = r.path.slice(1, -1)
        expect(titikAntara).not.toContain(18)
        diuji += 1
      }
    }
    expect(diuji).toBe(indeks.daftar.length * indeks.daftar.length)
  })

  test('rumah-kaca (titik 18) sah berfungsi sebagai titik awal dan tujuan', () => {
    // 18 sebagai awal
    const ruteAwal = hitungRute(graphData, [18], indeks.byId.get('fisika').titik, aturan)
    expect(ruteAwal.found).toBe(true)
    expect(ruteAwal.path[0]).toBe(18)
    expect(ruteAwal.distance).toBeGreaterThan(0)

    // 18 sebagai tujuan
    const ruteTujuan = hitungRute(graphData, indeks.byId.get('fisika').titik, [18], aturan)
    expect(ruteTujuan.found).toBe(true)
    expect(ruteTujuan.path.at(-1)).toBe(18)
    expect(ruteTujuan.distance).toBeGreaterThan(0)
  })

  test('pintuTertutup: tidak ada rute yang memulai atau berakhir di titik 7, tetapi rute yang melewati 7 tetap boleh', () => {
    let ruteLewat7 = 0
    for (const a of indeks.daftar) {
      for (const b of indeks.daftar) {
        const r = hitungRute(graphData, a.titik, b.titik, aturan)
        if (!r.found) continue
        expect(r.path[0]).not.toBe(7)
        expect(r.path.at(-1)).not.toBe(7)
        if (r.path.slice(1, -1).includes(7)) {
          ruteLewat7 += 1
        }
      }
    }
    // Titik 7 tetap dilalui di koridor jaringan pejalan kaki
    expect(ruteLewat7).toBeGreaterThan(0)
  })

  test('tujuan Syawal selalu memilih lobi 5, 6, atau 8 (tidak pernah 7)', () => {
    for (const a of indeks.daftar) {
      if (a.id === 'syawal') continue
      const r = hitungRute(graphData, a.titik, indeks.byId.get('syawal').titik, aturan)
      expect(r.found).toBe(true)
      expect([5, 6, 8]).toContain(r.targetId)
      expect(r.targetId).not.toBe(7)
    }
  })

  test('jaringan tetap 100% terhubung untuk seluruh 225 pasangan tempat', () => {
    let terhubung = 0
    for (const a of indeks.daftar) {
      for (const b of indeks.daftar) {
        const r = hitungRute(graphData, a.titik, b.titik, aturan)
        expect(r.found).toBe(true)
        terhubung += 1
      }
    }
    expect(terhubung).toBe(indeks.daftar.length * indeks.daftar.length)
  })

  test('Dijkstra = A* = Floyd-Warshall pada graf tersaring (validasiSemuaTempat)', () => {
    const hasil = validasiSemuaTempat(graphData, indeks, aturan)
    expect(hasil.valid).toBe(true)
    expect(hasil.pasangan).toBe(indeks.daftar.length * indeks.daftar.length)
    expect(hasil.selisihMaks).toBeLessThan(0.001)
  })

  test('ruteTanpaAturan memakai titikSemua dan graf tanpa penyaringan (aturan=null)', () => {
    const dari = indeks.byId.get('belajar-bersama')
    const ke = indeks.byId.get('syawal')

    // Tanpa aturan: memakai titikSemua dan graf asli tanpa penyaringan
    const ruteTanpaAturan = hitungRute(graphData, dari.titikSemua, ke.titikSemua, null)
    expect(ruteTanpaAturan.found).toBe(true)
    expect(ruteTanpaAturan.path.length).toBeGreaterThan(1)

    // Dengan aturan: rute sah terbentuk menuju pintu aktif (lobi barat/6)
    const rute = hitungRute(graphData, dari.titik, ke.titik, aturan)
    expect(rute.found).toBe(true)
    expect(rute.targetId).toBe(6)

    // Untuk rute asal fisika -> syawal, tanpa aturan memilih pintu 7, dengan aturan dialihkan ke pintu 6
    const fisika = indeks.byId.get('fisika')
    const rFisikaTanpa = hitungRute(graphData, fisika.titikSemua, ke.titikSemua, null)
    expect(rFisikaTanpa.targetId).toBe(7)
    const rFisikaDengan = hitungRute(graphData, fisika.titik, ke.titik, aturan)
    expect(rFisikaDengan.targetId).toBe(6)

    // Alasan pintu tertutup syawal
    const pintu7 = aturan.pintuTertutup.find((p) => p.id === 7)
    expect(pintu7.alasan).toBe('Pintu utara Gedung Syawal tidak dibuka.')
  })

  test('GPS di titik 7 tetap menghasilkan rute (bukan titik-tertutup)', () => {
    // GPS menempel ke simpul 7 yang merupakan simpul sah di jaringan
    const rKeFisika = hitungRute(graphData, [7], indeks.byId.get('fisika').titik, aturan)
    expect(rKeFisika.found).toBe(true)
    expect(rKeFisika.path[0]).toBe(7)
    expect(rKeFisika.distance).toBeGreaterThan(0)

    const rKeSyawal = hitungRute(graphData, [7], indeks.byId.get('syawal').titik, aturan)
    expect(rKeSyawal.found).toBe(true)
    expect(rKeSyawal.path[0]).toBe(7)
    expect(rKeSyawal.distance).toBeGreaterThan(0)
  })

  test('Snapping GPS di dekat Rumah Kaca tidak menghasilkan dariTitik=[18]', () => {
    const posDekat18 = {
      lat: graphData.pointsById[18].lat,
      lon: graphData.pointsById[18].lon,
    }
    const kecualikan = aturan.titikUjungSaja.map((u) => u.id)
    const snap = findNearestPoint(posDekat18, graphData.pointsById, { kecualikanTitik: kecualikan })
    expect(snap).not.toBeNull()
    expect(snap.id).not.toBe(18)
    expect(graphData.graph[18].map((e) => e.to)).toContain(snap.id)
  })

  test('Teks langkah: penanda tidak sama dengan tempat tujuan langkah, dan langkah identik digabung', () => {
    const rute = hitungRute(graphData, indeks.byId.get('taman-biologi').titik, indeks.byId.get('fisika').titik, aturan)
    expect(rute.found).toBe(true)
    const steps = langkahRute(rute, indeks, graphData, { edges, poligon, tempat })

    // Tidak boleh ada teks "lewat selasar Gedung Syawal menuju Gedung Syawal"
    for (const s of steps) {
      expect(s.teks).not.toContain('lewat selasar Gedung Syawal menuju Gedung Syawal')
    }

    // Tidak boleh ada dua langkah jalan berurutan dengan penanda identik
    for (let i = 1; i < steps.length - 1; i += 1) {
      const s1 = steps[i]
      const s2 = steps[i + 1]
      if (s1.jenis === 'jalan' && s2.jenis === 'jalan' && s1.penanda && s2.penanda) {
        expect(s1.penanda).not.toBe(s2.penanda)
      }
    }
  })

  test('jarakKeSemuaTempat dengan aturan menerapkan penyaringan graf dan pintu aktif', () => {
    const j = jarakKeSemuaTempat(graphData, [18], indeks, aturan)
    expect(j.size).toBe(indeks.daftar.length)
    expect(j.get('rumah-kaca')).toBe(0)
    for (const v of j.values()) {
      expect(Number.isFinite(v)).toBe(true)
    }
  })
})
