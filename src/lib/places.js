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
  return { daftar, byId, byTitik, pusat }
}

/** Nama yang ramah untuk satu titik jaringan (mis. "Lobi Utara Gedung Syawal"). */
export function namaTitik(indeks, titikId) {
  const t = indeks.byTitik.get(Number(titikId))
  if (!t) return `Titik ${titikId}`
  return t.namaTitik?.[String(titikId)] || t.nama
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

/** Tempat lain yang tersambung langsung lewat satu jalur, beserta panjang jalur terpendeknya. */
export function tempatTerhubung(indeks, graph, tempatId) {
  const tempat = indeks.byId.get(tempatId)
  const hasil = new Map()
  for (const titikId of tempat.titik) {
    for (const edge of graph[titikId] || []) {
      const lain = indeks.byTitik.get(Number(edge.to))
      if (!lain || lain.id === tempatId) continue
      const sebelumnya = hasil.get(lain.id)
      if (!sebelumnya || edge.weight < sebelumnya.jarak) hasil.set(lain.id, { tempat: lain, jarak: edge.weight })
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
