// routing.js - menjalankan algoritma pada tempat (bukan hanya simpul), menyusun langkah dan geometri rute.

import { aStar, dijkstra, floydWarshall, haversineDistance, pathToLatLng } from './graph'
import { susunPetunjukRute } from './petunjuk'

/** Fungsi murni: menyaring titik aktif sebuah tempat dengan mengeluarkan pintuTertutup. */
export function titikAktif(tempat, aturan = null) {
  if (!tempat) return []
  const semua = tempat.titikSemua || tempat.titik || []
  if (!aturan?.pintuTertutup?.length) return [...semua]
  const tertutup = new Set(aturan.pintuTertutup.map((p) => Number(p.id)))
  return semua.filter((id) => !tertutup.has(Number(id)))
}

/** Terapkan aturan: kosongkan ruas KELUAR dari titikUjungSaja kecuali jika titik tersebut ada di dariTitik. */
export function terapkanAturan(graph, aturan = null, { dariTitik = [] } = {}) {
  if (!aturan?.titikUjungSaja?.length) return graph
  const dariSet = new Set((dariTitik || []).map(Number))
  const ujungSet = new Set(aturan.titikUjungSaja.map((u) => Number(u.id)))

  const copy = {}
  for (const k of Object.keys(graph)) {
    const kNum = Number(k)
    if (ujungSet.has(kNum) && !dariSet.has(kNum)) {
      copy[k] = []
    } else {
      copy[k] = graph[k].map((e) => ({ ...e }))
    }
  }
  return copy
}

/** Jalankan Dijkstra (utama) dan A* (pembanding) lalu kembalikan hasil dan metriknya. */
export function hitungRute(graphData, dariTitik, keTitik, aturan = null) {
  const { pointsById } = graphData
  if (!dariTitik.length || !keTitik.length) {
    if (dariTitik?.alasan === 'titik-tertutup' || keTitik?.alasan === 'titik-tertutup') {
      return { found: false, alasan: 'titik-tertutup' }
    }
    return { found: false, alasan: 'titik-kosong' }
  }

  const graphTersaring = terapkanAturan(graphData.graph, aturan, { dariTitik })

  const t0 = performance.now()
  const d = dijkstra(graphTersaring, dariTitik, keTitik)
  const t1 = performance.now()
  const a = aStar(graphTersaring, pointsById, dariTitik, keTitik)
  const t2 = performance.now()

  if (!d.found) return { found: false, alasan: 'tidak-terhubung' }
  return {
    found: true,
    distance: d.distance,
    path: d.path,
    edgeIds: d.edgeIds,
    startId: d.path[0],
    targetId: d.targetId,
    latLng: pathToLatLng(d.path, pointsById),
    perbandingan: {
      dijkstra: { distance: d.distance, visitedCount: d.visitedCount, ms: t1 - t0 },
      aStar: { distance: a.distance, visitedCount: a.visitedCount, ms: t2 - t1 },
      selisih: Math.abs(d.distance - a.distance),
    },
  }
}

/** Jarak terpendek dari titik awal ke setiap tempat (tempatId -> meter). */
export function jarakKeSemuaTempat(graphData, dariTitik, indeks, aturan = null) {
  const hasil = new Map()
  if (!dariTitik.length) return hasil
  const graphTersaring = terapkanAturan(graphData.graph, aturan, { dariTitik })
  const { distance } = dijkstra(graphTersaring, dariTitik, [])
  for (const t of indeks.daftar) {
    const titikTarget = t.titik || []
    if (!titikTarget.length) continue
    const j = Math.min(...titikTarget.map((id) => distance[id] ?? Infinity))
    if (Number.isFinite(j)) hasil.set(t.id, j)
  }
  return hasil
}

function koordinatGaris(feature) {
  const c = feature.geometry.coordinates
  const datar = feature.geometry.type === 'MultiLineString' ? c.flat() : c
  return datar.map(([lon, lat]) => [lat, lon])
}

/** Garis rute yang mengikuti jalur yang digambar (bukan garis lurus antar titik). */
export function geometriRute(rute, edgesGeoJson, pointsById) {
  const edgeById = new Map(edgesGeoJson.features.map((f) => [Number(f.properties.id), f]))
  const hasil = []
  for (let i = 0; i < rute.path.length - 1; i += 1) {
    const dari = pointsById[rute.path[i]]
    const feature = edgeById.get(Number(rute.edgeIds[i]))
    let garis = feature ? koordinatGaris(feature) : [[dari.lat, dari.lon], [pointsById[rute.path[i + 1]].lat, pointsById[rute.path[i + 1]].lon]]
    const ke = (p) => haversineDistance(dari.lat, dari.lon, p[0], p[1])
    if (ke(garis[0]) > ke(garis[garis.length - 1])) garis = [...garis].reverse()
    hasil.push(...(hasil.length ? garis.slice(1) : garis))
  }
  if (!hasil.length && rute.path.length === 1) {
    const p = pointsById[rute.path[0]]
    hasil.push([p.lat, p.lon])
  }
  return hasil
}

/** Langkah rute yang mudah dibaca: arah belokan, arah mata angin, dan penanda gedung. */
export function langkahRute(rute, indeks, graphData, konteks = {}) {
  return susunPetunjukRute({ rute, indeks, graphData, konteks })
}

/** Bandingkan Dijkstra dengan Floyd-Warshall untuk semua pasangan tempat (bukti kebenaran untuk laporan). */
export function validasiSemuaTempat(graphData, indeks, aturan = null) {
  const { graph } = graphData
  let selisihMaks = 0
  let pasangan = 0

  if (!aturan?.titikUjungSaja?.length) {
    const lantai = floydWarshall(graph)
    for (const asal of indeks.daftar) {
      for (const tujuan of indeks.daftar) {
        let referensi = Infinity
        for (const s of asal.titik) for (const t of tujuan.titik) referensi = Math.min(referensi, lantai[s]?.[t] ?? Infinity)
        const d = dijkstra(graph, asal.titik, tujuan.titik)
        const jarak = d.found ? d.distance : Infinity
        pasangan += 1
        if (jarak === Infinity && referensi === Infinity) continue
        selisihMaks = Math.max(selisihMaks, Math.abs(jarak - referensi))
      }
    }
    return { valid: selisihMaks <= 0.001, pasangan, selisihMaks }
  }

  // Sesuai revisi poin 5: Dua varian graf dihitung sekali per varian
  // (a) Graf tersaring biasa: ruas keluar 18 dibuang
  const grafBiasa = terapkanAturan(graph, aturan, { dariTitik: [] })
  const floydBiasa = floydWarshall(grafBiasa)

  // (b) Graf dengan ruas keluar 18 dipulihkan, khusus asal rumah-kaca
  const titikRumahKaca = indeks.byId.get('rumah-kaca')?.titikSemua || indeks.byId.get('rumah-kaca')?.titik || [18]
  const grafRumahKaca = terapkanAturan(graph, aturan, { dariTitik: titikRumahKaca })
  const floydRumahKaca = floydWarshall(grafRumahKaca)

  for (const asal of indeks.daftar) {
    const isRumahKaca = asal.id === 'rumah-kaca' || (asal.titikSemua || asal.titik).includes(18)
    const floydMatriks = isRumahKaca ? floydRumahKaca : floydBiasa
    const grafDipakai = isRumahKaca ? grafRumahKaca : grafBiasa

    for (const tujuan of indeks.daftar) {
      let referensi = Infinity
      for (const s of asal.titik) for (const t of tujuan.titik) referensi = Math.min(referensi, floydMatriks[s]?.[t] ?? Infinity)
      const d = dijkstra(grafDipakai, asal.titik, tujuan.titik)
      const jarak = d.found ? d.distance : Infinity
      pasangan += 1
      if (jarak === Infinity && referensi === Infinity) continue
      selisihMaks = Math.max(selisihMaks, Math.abs(jarak - referensi))
    }
  }

  return { valid: selisihMaks <= 0.001, pasangan, selisihMaks }
}

