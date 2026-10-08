// peta.js - bentuk poligon gedung, titik pusat label, dan batas tampilan peta. Murni (tanpa DOM).

import { pusatPoligon } from './geo'

/** Poligon gedung dipetakan ke tempat lewat properti `poligon` pada tempat.json. */
export function bentukPoligon(poligonGeoJson, daftarTempat) {
  const tempatByPoligon = new Map(daftarTempat.map((t) => [t.poligon, t]))
  const hasil = []
  for (const f of poligonGeoJson.features) {
    const tempat = tempatByPoligon.get(String(f.properties.id))
    if (!tempat) continue
    const cincin = f.geometry.type === 'MultiPolygon' ? f.geometry.coordinates.map((p) => p[0]) : [f.geometry.coordinates[0]]
    const terbesar = cincin.reduce((a, b) => (b.length > a.length ? b : a), cincin[0])
    hasil.push({
      tempatId: tempat.id,
      label: tempat.label,
      kelompok: tempat.kelompok,
      positions: cincin.map((r) => r.map(([lon, lat]) => [lat, lon])),
      pusat: pusatPoligon(terbesar),
    })
  }
  return hasil
}

/** Batas [[selatan, barat], [utara, timur]] yang memuat semua gedung dan titik jalan. */
export function batasPeta(bentuk, pointsById, margin = 0.00015) {
  const lat = []
  const lon = []
  for (const b of bentuk) for (const cincin of b.positions) for (const [la, lo] of cincin) { lat.push(la); lon.push(lo) }
  for (const p of Object.values(pointsById)) { lat.push(p.lat); lon.push(p.lon) }
  return [
    [Math.min(...lat) - margin, Math.min(...lon) - margin],
    [Math.max(...lat) + margin, Math.max(...lon) + margin],
  ]
}

/** Warna poligon menurut kelompok tempat (juga dipakai pada legenda). */
export const KELOMPOK = {
  pusat: { nama: 'Gedung pusat fakultas', warna: '#4f46e5' },
  jurusan: { nama: 'Gedung jurusan', warna: '#0369a1' },
  lab: { nama: 'Laboratorium', warna: '#0f766e' },
  lainnya: { nama: 'Gedung lainnya', warna: '#b45309' },
  taman: { nama: 'Taman dan fasilitas luar', warna: '#15803d' },
}

export const URUTAN_KELOMPOK = ['pusat', 'jurusan', 'lab', 'lainnya', 'taman']
