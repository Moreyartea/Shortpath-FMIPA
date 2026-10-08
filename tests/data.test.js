import { describe, expect, test } from 'vitest'
import { koordinat, edges, poligon, tempat, ruanganMentah, graphData, ruangan } from './helpers'
import { dijkstra } from '../src/lib/graph'

describe('Integritas data peta', () => {
  const idTitik = koordinat.features.map((f) => Number(f.properties.id))

  test('ID titik unik dan semua jalur merujuk titik yang ada', () => {
    expect(new Set(idTitik).size).toBe(idTitik.length)
    for (const f of edges.features) {
      expect(idTitik).toContain(Number(f.properties.asal))
      expect(idTitik).toContain(Number(f.properties.tujuan))
      expect(Number(f.properties.asal)).not.toBe(Number(f.properties.tujuan))
    }
  })

  test('ID jalur unik (kalau ganda, rute yang disorot bisa menggambar garis yang salah)', () => {
    const ids = edges.features.map((f) => Number(f.properties.id))
    const ganda = ids.filter((id, i) => ids.indexOf(id) !== i)
    expect(ganda).toEqual([])
  })

  test('ujung setiap garis jalur menempel pada titiknya (maks. 3 m)', () => {
    const jarak = (a, b) => Math.hypot((a[0] - b[0]) * 111320 * Math.cos((3.607 * Math.PI) / 180), (a[1] - b[1]) * 110540)
    const pos = Object.fromEntries(koordinat.features.map((f) => [Number(f.properties.id), f.geometry.coordinates]))
    for (const f of edges.features) {
      const c = f.geometry.type === 'MultiLineString' ? f.geometry.coordinates.flat() : f.geometry.coordinates
      const a = pos[Number(f.properties.asal)]
      const b = pos[Number(f.properties.tujuan)]
      const normal = Math.max(jarak(c[0], a), jarak(c[c.length - 1], b))
      const terbalik = Math.max(jarak(c[0], b), jarak(c[c.length - 1], a))
      expect(Math.min(normal, terbalik)).toBeLessThan(3)
    }
  })

  test('jaringan terhubung penuh', () => {
    const hasil = dijkstra(graphData.graph, [idTitik[0]], [])
    for (const id of idTitik) expect(Number.isFinite(hasil.distance[id])).toBe(true)
  })
})

describe('Integritas data tempat', () => {
  test('ID tempat unik; setiap titik jaringan dimiliki tepat satu tempat', () => {
    expect(new Set(tempat.map((t) => t.id)).size).toBe(tempat.length)
    const semua = tempat.flatMap((t) => t.titik.map(Number)).sort((a, b) => a - b)
    const idTitik = koordinat.features.map((f) => Number(f.properties.id)).sort((a, b) => a - b)
    expect(semua).toEqual(idTitik)
  })

  test('setiap poligon dipakai tepat satu tempat dan sebaliknya', () => {
    const idPoligon = poligon.features.map((f) => String(f.properties.id)).sort()
    expect(tempat.map((t) => t.poligon).sort()).toEqual(idPoligon)
  })

  test('kode gedung kampus tidak dipakai dua tempat', () => {
    const kode = tempat.flatMap((t) => t.gedung.map((g) => g.kode))
    expect(new Set(kode).size).toBe(kode.length)
  })

  test('tempat bersimpul banyak (Syawal) punya nama untuk setiap titiknya', () => {
    for (const t of tempat.filter((x) => x.titik.length > 1)) {
      for (const id of t.titik) expect(t.namaTitik[String(id)]).toBeTruthy()
    }
  })
})

describe('Integritas data ruangan', () => {
  test('semua baris data lokal terbaca dan setiap ruangan terpetakan ke tempat', () => {
    expect(ruangan.length).toBe(ruanganMentah.length)
    expect(ruangan.filter((r) => !r.tempatId)).toEqual([])
  })

  test('lantai ruangan tidak melebihi jumlah lantai gedungnya', () => {
    for (const t of tempat) {
      const maksTempat = Math.max(0, ...t.gedung.map((g) => g.lantai))
      for (const r of ruangan.filter((x) => x.tempatId === t.id && x.lantai !== null)) {
        const gedung = t.gedung.find((g) => g.kode === r.kodeGedung)
        const batas = gedung ? gedung.lantai : maksTempat
        expect(r.lantai, `${r.kode} ${r.nama}`).toBeLessThanOrEqual(batas)
      }
    }
  })

  test('kode yang belum final tidak ditampilkan ke pengguna', () => {
    const sementara = ruanganMentah.filter((r) => ['kode_sementara', 'diperbaiki_otomatis', 'perlu_dicek'].includes(r.status))
    expect(sementara.length).toBeGreaterThan(0)
    for (const r of ruangan.filter((x) => x.kode)) {
      const asli = ruanganMentah.find((m) => m.kode === r.kode && m.nama.trim() === r.nama)
      if (asli && ['kode_sementara', 'diperbaiki_otomatis', 'perlu_dicek'].includes(asli.status)) expect(r.kodeTampil).toBe('')
    }
  })
})
