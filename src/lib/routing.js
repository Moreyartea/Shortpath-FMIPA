// routing.js - menjalankan algoritma pada tempat (bukan hanya simpul), menyusun langkah dan geometri rute.

import { aStar, dijkstra, floydWarshall, haversineDistance, pathToLatLng } from './graph'
import { bearing, namaArah } from './geo'
import { formatJarak } from './format'
import { namaTitik } from './places'

/** Jalankan Dijkstra (utama) dan A* (pembanding) lalu kembalikan hasil dan metriknya. */
export function hitungRute(graphData, dariTitik, keTitik) {
  const { graph, pointsById } = graphData
  if (!dariTitik.length || !keTitik.length) return { found: false, alasan: 'titik-kosong' }

  const t0 = performance.now()
  const d = dijkstra(graph, dariTitik, keTitik)
  const t1 = performance.now()
  const a = aStar(graph, pointsById, dariTitik, keTitik)
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
export function jarakKeSemuaTempat(graphData, dariTitik, indeks) {
  const hasil = new Map()
  if (!dariTitik.length) return hasil
  const { distance } = dijkstra(graphData.graph, dariTitik, [])
  for (const t of indeks.daftar) {
    const j = Math.min(...t.titik.map((id) => distance[id] ?? Infinity))
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

/** Langkah rute yang mudah dibaca: nama tempat, arah mata angin, dan jarak tiap ruas. */
export function langkahRute(rute, indeks, graphData) {
  const { graph, pointsById } = graphData
  const langkah = [{ jenis: 'mulai', teks: `Mulai dari ${namaTitik(indeks, rute.path[0])}`, titikId: rute.path[0] }]
  if (rute.path.length <= 1) return langkah

  const segmen = []
  for (let i = 0; i < rute.path.length - 1; i += 1) {
    const a = pointsById[rute.path[i]]
    const b = pointsById[rute.path[i + 1]]
    const edge = (graph[rute.path[i]] || []).find((e) => Number(e.edgeId) === Number(rute.edgeIds[i]))
    const jarak = edge ? edge.weight : haversineDistance(a.lat, a.lon, b.lat, b.lon)
    const keId = rute.path[i + 1]
    const adalahPintu = indeks.byTitik.has(Number(keId))
    segmen.push({ dariId: rute.path[i], keId, jarak, adalahPintu })
  }

  const ambilArah = (dariId, keId) => {
    const a = pointsById[dariId]
    const b = pointsById[keId]
    return namaArah(bearing(a.lat, a.lon, b.lat, b.lon))
  }

  let currentGroup = {
    dariId: segmen[0].dariId,
    keId: segmen[0].keId,
    jarak: segmen[0].jarak,
    adalahPintu: segmen[0].adalahPintu,
  }

  for (let i = 1; i < segmen.length; i += 1) {
    const s = segmen[i]
    if (currentGroup.adalahPintu) {
      const arah = ambilArah(currentGroup.dariId, currentGroup.keId)
      langkah.push({
        jenis: 'jalan',
        teks: `Jalan ke arah ${arah} menuju ${namaTitik(indeks, currentGroup.keId)}`,
        arah,
        jarak: currentGroup.jarak,
        jarakTeks: formatJarak(currentGroup.jarak),
        titikId: currentGroup.keId,
      })
      currentGroup = {
        dariId: s.dariId,
        keId: s.keId,
        jarak: s.jarak,
        adalahPintu: s.adalahPintu,
      }
    } else {
      currentGroup.jarak += s.jarak
      currentGroup.keId = s.keId
      currentGroup.adalahPintu = s.adalahPintu
    }
  }

  const arahAkhir = ambilArah(currentGroup.dariId, currentGroup.keId)
  langkah.push({
    jenis: 'tiba',
    teks: `Jalan ke arah ${arahAkhir} menuju ${namaTitik(indeks, currentGroup.keId)}`,
    arah: arahAkhir,
    jarak: currentGroup.jarak,
    jarakTeks: formatJarak(currentGroup.jarak),
    titikId: currentGroup.keId,
  })

  return langkah
}

/** Bandingkan Dijkstra dengan Floyd-Warshall untuk semua pasangan tempat (bukti kebenaran untuk laporan). */
export function validasiSemuaTempat(graphData, indeks) {
  const { graph } = graphData
  const lantai = floydWarshall(graph)
  let selisihMaks = 0
  let pasangan = 0
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
