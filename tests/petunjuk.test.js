import { describe, expect, test } from 'vitest'
import { graphData, indeks, tempat, edges, poligon } from './helpers'
import { hitungRute, langkahRute } from '../src/lib/routing'
import {
  MIN_PANJANG_LANGKAH,
  cariPenandaLangkah,
  hitungSelisihSudut,
  tentukanBelokan,
} from '../src/lib/petunjuk'

describe('Petunjuk rute pejalan kaki berbasis geometri & poligon', () => {
  test('trigonometri sudut belok dan arah belokan relatif', () => {
    expect(hitungSelisihSudut(0, 90)).toBe(90)
    expect(hitungSelisihSudut(90, 0)).toBe(-90)
    expect(hitungSelisihSudut(350, 10)).toBe(20)
    expect(hitungSelisihSudut(10, 350)).toBe(-20)

    expect(tentukanBelokan(null, 90)).toBeNull()
    expect(tentukanBelokan(0, 50)).toBe('kanan')
    expect(tentukanBelokan(0, -50)).toBe('kiri')
    expect(tentukanBelokan(0, 10)).toBeNull()
  })

  test('(a) konservasi jarak untuk semua pasangan tempat: sum jarak langkah == rute.distance', () => {
    for (const a of tempat) {
      for (const b of tempat) {
        if (a.id === b.id) continue
        const r = hitungRute(graphData, a.titik, b.titik)
        if (!r.found) continue
        const langkah = langkahRute(r, indeks, graphData, { edges, poligon, tempat })
        const total = langkah.reduce((s, l) => s + (l.jarak || 0), 0)
        expect(Math.abs(total - r.distance)).toBeLessThan(0.01)
      }
    }
  })

  test('(b) tidak ada "Titik N" dan semua nama penanda ada di tempat.json', () => {
    const daftarNama = new Set(tempat.map((t) => t.nama))
    for (const a of tempat) {
      for (const b of tempat) {
        if (a.id === b.id) continue
        const r = hitungRute(graphData, a.titik, b.titik)
        if (!r.found) continue
        const langkah = langkahRute(r, indeks, graphData, { edges, poligon, tempat })
        for (const l of langkah) {
          expect(l.teks).not.toMatch(/Titik \d+/)
          if (l.penanda) {
            const cocok = [...daftarNama].some((n) => l.penanda.includes(n))
            expect(cocok).toBe(true)
          }
        }
      }
    }
  })

  test('(c) rute lab-komputer -> fisika: langkah pertama arah utara, berikutnya belok kanan arah timur, berakhir di pintu fisika', () => {
    const r = hitungRute(graphData, indeks.byId.get('lab-komputer').titik, indeks.byId.get('fisika').titik)
    expect(r.found).toBe(true)
    const langkah = langkahRute(r, indeks, graphData, { edges, poligon, tempat })
    expect(langkah[0].jenis).toBe('mulai')

    // Langkah jalan pertama
    expect(langkah[1].arah).toBe('utara')
    expect(langkah[1].belokan).toBeNull()
    expect(langkah[1].teks).toMatch(/Jalan ke arah utara/)

    // Ada langkah berikutnya yang belok kanan ke arah timur
    const adaBelokKananTimur = langkah.slice(2).some(
      (l) => l.belokan === 'kanan' && (l.arah === 'timur' || l.arah === 'timur laut')
    )
    expect(adaBelokKananTimur).toBe(true)

    // Langkah terakhir berakhir di pintu fisika
    const akhir = langkah.at(-1)
    expect(akhir.jenis).toBe('tiba')
    expect(akhir.teks).toContain('Gedung Fisika')
    expect(indeks.byId.get('fisika').titik).toContain(akhir.titikId)
  })

  test('(d) langkah di dalam poligon memakai "lewat selasar"', () => {
    const pFisika = graphData.pointsById[1]
    const garis = [
      [pFisika.lat, pFisika.lon],
      [pFisika.lat + 0.00005, pFisika.lon],
    ]
    const penanda = cariPenandaLangkah({
      garis,
      distKumulatif: [0, 10],
      sAwal: 0,
      sAkhir: 10,
      poligonGeoJson: poligon,
      daftarTempat: tempat,
    })
    expect(penanda).not.toBeNull()
    expect(penanda.jenis).toBe('selasar')
    expect(penanda.teks).toContain('lewat selasar Gedung Fisika')
  })

  test('(e) tanpa poligon di dekatnya jatuh ke teks arah biasa', () => {
    const garis = [
      [3.6085, 98.7170],
      [3.6085, 98.7172],
    ]
    const penanda = cariPenandaLangkah({
      garis,
      distKumulatif: [0, 20],
      sAwal: 0,
      sAkhir: 20,
      poligonGeoJson: poligon,
      daftarTempat: tempat,
    })
    expect(penanda).toBeNull()
  })

  test('(f) langkah < MIN_PANJANG_LANGKAH (6 m) tidak muncul kecuali satu-satunya langkah', () => {
    for (const a of tempat) {
      for (const b of tempat) {
        if (a.id === b.id) continue
        const r = hitungRute(graphData, a.titik, b.titik)
        if (!r.found) continue
        const langkah = langkahRute(r, indeks, graphData, { edges, poligon, tempat })
        const langkahJalan = langkah.slice(1)
        if (langkahJalan.length > 1) {
          for (const l of langkahJalan) {
            expect(l.jarak).toBeGreaterThanOrEqual(MIN_PANJANG_LANGKAH - 0.01)
          }
        }
      }
    }
  })

  test('fallback langkahRute tanpa konteks berjalan aman', () => {
    const r = hitungRute(graphData, indeks.byId.get('kimia').titik, indeks.byId.get('fisika').titik)
    const langkah = langkahRute(r, indeks, graphData)
    expect(langkah.length).toBeGreaterThanOrEqual(2)
    expect(langkah[0].jenis).toBe('mulai')
    expect(langkah.at(-1).jenis).toBe('tiba')
  })

  test('tampilkan teks langkah nyata untuk 3 rute', () => {
    const pairs = [
      ['lab-komputer', 'fisika'],
      ['belajar-bersama', 'fisika'],
      ['lab-biologi', 'matematika']
    ]
    for (const [dariId, keId] of pairs) {
      const dari = indeks.byId.get(dariId)
      const ke = indeks.byId.get(keId)
      const rute = hitungRute(graphData, dari.titik, ke.titik)
      const steps = langkahRute(rute, indeks, graphData, { edges, poligon, tempat })
      expect(steps.length).toBeGreaterThanOrEqual(4)
      expect(steps[0].jenis).toBe('mulai')
      expect(steps.at(-1).jenis).toBe('tiba')
      const totalDist = steps.reduce((acc, s) => acc + (s.jarak || 0), 0)
      expect(Math.abs(totalDist - rute.distance)).toBeLessThan(0.01)
    }
  })
})
