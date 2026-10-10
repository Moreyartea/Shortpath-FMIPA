// places.js - indeks tempat (gedung) terhadap jaringan jalan: nama titik, tetangga, dan arah relatif.

import { haversineDistance } from './graph'
import { bearing, namaArah, pusatTitik } from './geo'

export function bangunIndeksTempat(daftar, pointsById) {
  const byId = new Map(daftar.map((t) => [t.id, t]))
  const byTitik = new Map()
  for (const t of daftar) for (const id of t.titik) byTitik.set(Number(id), t)
  const pusat = new Map(
    daftar.map((t) => [t.id, pusatTitik(t.titik.map((id) => pointsById[id]).filter(Boolean))])
  )
  const titikJaringan = new Set(Object.keys(pointsById || {}).map(Number))
  return { daftar, byId, byTitik, pusat, titikJaringan }
}

/** Nama yang ramah untuk satu titik jaringan (mis. "Lobi Utara Gedung Syawal"). */
export function namaTitik(indeks, titikId) {
  const t = indeks.byTitik.get(Number(titikId))
  if (t) return t.namaTitik?.[String(titikId)] || t.nama
  if (indeks.titikJaringan && indeks.titikJaringan.has(Number(titikId))) {
    return 'persimpangan jalur'
  }
  return `Titik ${titikId}`
}

/** Arah mata angin dan jarak garis lurus dari tempat A ke tempat B. */
export function posisiRelatif(indeks, dariId, keId) {
  const a = indeks.pusat.get(dariId)
  const b = indeks.pusat.get(keId)
  if (!a || !b) return null
  return {
    arah: namaArah(bearing(a.lat, a.lon, b.lat, b.lon)),
    jarak: haversineDistance(a.lat, a.lon, b.lat, b.lon),
  }
}

/** Tempat lain yang tersambung langsung (lewat simpul persimpangan tanpa melewati pintu gedung lain), beserta panjang rute terpendeknya. */
export function tempatTerhubung(indeks, graph, tempatId) {
  const tempat = indeks.byId.get(tempatId)
  if (!tempat) return []
  const startDoors = new Set(tempat.titik.map(Number))
  const hasil = new Map()

  const dist = {}
  const q = []
  for (const nodeId of Object.keys(graph)) {
    dist[nodeId] = Infinity
  }

  for (const d of startDoors) {
    dist[d] = 0
    q.push({ id: d, d: 0 })
  }

  while (q.length > 0) {
    q.sort((a, b) => a.d - b.d)
    const { id: u, d } = q.shift()
    if (d > dist[u]) continue

    if (!startDoors.has(Number(u)) && indeks.byTitik.has(Number(u))) {
      const targetPlace = indeks.byTitik.get(Number(u))
      const prev = hasil.get(targetPlace.id)
      if (!prev || d < prev.jarak) {
        hasil.set(targetPlace.id, { tempat: targetPlace, jarak: d })
      }
      continue
    }

    for (const edge of graph[u] || []) {
      const v = Number(edge.to)
      const newDist = d + edge.weight
      if (newDist < dist[v]) {
        dist[v] = newDist
        q.push({ id: v, d: newDist })
      }
    }
  }

  return [...hasil.values()].sort((a, b) => a.jarak - b.jarak)
}

/**
 * Gambaran umum untuk pengunjung baru: tempat pusat, siapa saja yang tersambung langsung
 * (beserta arahnya dari pusat), dan tempat lain di kawasan. Semua dihitung dari data peta.
 */
export function ringkasOrientasi(indeks, graph) {
  const pusat = indeks.daftar.find((t) => t.kelompok === 'pusat')
  if (!pusat) return null
  const terhubung = tempatTerhubung(indeks, graph, pusat.id).map(({ tempat, jarak }) => ({
    tempat,
    jalur: jarak,
    ...posisiRelatif(indeks, pusat.id, tempat.id),
  }))
  const idTerhubung = new Set(terhubung.map((x) => x.tempat.id))
  const lainnya = indeks.daftar
    .filter((t) => t.id !== pusat.id && !idTerhubung.has(t.id))
    .map((tempat) => ({ tempat, ...posisiRelatif(indeks, pusat.id, tempat.id) }))
    .sort((a, b) => a.jarak - b.jarak)
  return { pusat, terhubung, lainnya }
}
