import { describe, expect, test } from 'vitest'
import { graphData, indeks, tempat, edges } from './helpers'
import { dijkstra, aStar, floydWarshall, calculateEdgeWeight } from '../src/lib/graph'
import { hitungRute, jarakKeSemuaTempat, validasiSemuaTempat, geometriRute, langkahRute } from '../src/lib/routing'

const { graph, pointsById } = graphData
const titikTempat = (id) => indeks.byId.get(id).titik

describe('Algoritma jalur terpendek', () => {
  test('Dijkstra = Floyd-Warshall untuk semua pasangan tempat', () => {
    const hasil = validasiSemuaTempat(graphData, indeks)
    expect(hasil.pasangan).toBe(tempat.length ** 2)
    expect(hasil.valid).toBe(true)
  })

  test('Dijkstra = A* untuk semua pasangan tempat', () => {
    for (const a of tempat) {
      for (const b of tempat) {
        const d = dijkstra(graph, a.titik, b.titik)
        const s = aStar(graph, pointsById, a.titik, b.titik)
        expect(s.found).toBe(d.found)
        expect(Math.abs(s.distance - d.distance)).toBeLessThan(0.001)
      }
    }
  })

  test('bobot jalur = panjang garis yang digambar, bukan garis lurus', () => {
    let lebihPanjang = 0
    for (const f of edges.features) {
      const bobot = calculateEdgeWeight(f.geometry)
      const dari = pointsById[Number(f.properties.asal)]
      const ke = pointsById[Number(f.properties.tujuan)]
      const lurus = Math.hypot((dari.lat - ke.lat) * 110540, (dari.lon - ke.lon) * 111320 * Math.cos((3.607 * Math.PI) / 180))
      expect(bobot).toBeGreaterThanOrEqual(lurus - 1)
      if (bobot > lurus * 1.2) lebihPanjang += 1
    }
    expect(lebihPanjang).toBeGreaterThan(0)
  })

  test('Floyd-Warshall: diagonal nol dan simetris', () => {
    const d = floydWarshall(graph)
    for (const a of Object.keys(graph)) {
      expect(d[a][a]).toBe(0)
      for (const b of Object.keys(graph)) expect(Math.abs(d[a][b] - d[b][a])).toBeLessThan(1e-9)
    }
  })
})

describe('hitungRute', () => {
  test('asal sama dengan tujuan: satu titik, jarak nol', () => {
    const r = hitungRute(graphData, titikTempat('kimia'), titikTempat('kimia'))
    expect(r.found).toBe(true)
    expect(r.distance).toBe(0)
    expect(r.path).toHaveLength(1)
  })

  test('tujuan Syawal memilih salah satu dari empat lobi (yang terdekat)', () => {
    const r = hitungRute(graphData, titikTempat('belajar-bersama'), titikTempat('syawal'))
    expect(r.found).toBe(true)
    expect(titikTempat('syawal')).toContain(r.targetId)
    // tidak ada lobi lain yang lebih dekat
    for (const lobi of titikTempat('syawal')) {
      const lain = dijkstra(graph, titikTempat('belajar-bersama'), [lobi])
      expect(lain.distance).toBeGreaterThanOrEqual(r.distance - 1e-9)
    }
  })

  test('Dijkstra dan A* melaporkan jarak sama; metrik tersedia', () => {
    const r = hitungRute(graphData, titikTempat('lab-biologi'), titikTempat('matematika'))
    expect(r.perbandingan.selisih).toBeLessThan(0.001)
    expect(r.perbandingan.dijkstra.visitedCount).toBeGreaterThan(0)
    expect(r.perbandingan.aStar.ms).toBeGreaterThanOrEqual(0)
  })

  test('masukan kosong tidak menimbulkan galat', () => {
    expect(hitungRute(graphData, [], [1]).found).toBe(false)
    expect(hitungRute(graphData, [1], []).found).toBe(false)
  })

  test('jarak ke semua tempat dari satu titik awal', () => {
    const j = jarakKeSemuaTempat(graphData, titikTempat('syawal'), indeks)
    expect(j.get('syawal')).toBe(0)
    expect(j.size).toBe(tempat.length)
    for (const v of j.values()) expect(Number.isFinite(v)).toBe(true)
  })
})

describe('Geometri dan langkah rute', () => {
  const rute = hitungRute(graphData, titikTempat('lab-biologi'), titikTempat('matematika'))

  test('garis rute mengikuti jalur yang digambar dan berawal/berakhir di titik rute', () => {
    const garis = geometriRute(rute, edges, pointsById)
    expect(garis.length).toBeGreaterThan(rute.path.length)
    const awal = pointsById[rute.path[0]]
    const akhir = pointsById[rute.path.at(-1)]
    const dekat = (p, q) => Math.hypot((p[0] - q.lat) * 110540, (p[1] - q.lon) * 111320) < 3
    expect(dekat(garis[0], awal)).toBe(true)
    expect(dekat(garis.at(-1), akhir)).toBe(true)
  })

  test('langkah: mulai, jalan..., tiba; memakai nama tempat dan arah mata angin', () => {
    const langkah = langkahRute(rute, indeks, graphData)
    expect(langkah[0].jenis).toBe('mulai')
    expect(langkah[0].teks).toContain('Lab. Biologi')
    expect(langkah.at(-1).jenis).toBe('tiba')
    expect(langkah.at(-1).teks).toContain('Gedung Matematika')
    expect(langkah).toHaveLength(rute.path.length)
    const jumlah = langkah.reduce((s, l) => s + (l.jarak || 0), 0)
    expect(Math.abs(jumlah - rute.distance)).toBeLessThan(0.01)
    for (const l of langkah.slice(1)) expect(l.teks).toMatch(/arah (utara|timur laut|timur|tenggara|selatan|barat daya|barat laut|barat)/)
    expect(langkah.map((l) => l.teks).join(' ')).not.toMatch(/Titik \d/)
  })
})
