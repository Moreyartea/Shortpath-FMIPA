// geo.js - perhitungan arah dan titik pusat. Murni (tanpa DOM).

const ARAH = [
  'utara',
  'timur laut',
  'timur',
  'tenggara',
  'selatan',
  'barat daya',
  'barat',
  'barat laut',
]

/** Sudut arah (0-360, 0 = utara) dari titik A ke titik B. */
export function bearing(lat1, lon1, lat2, lon2) {
  const rad = (d) => (d * Math.PI) / 180
  const dLon = rad(lon2 - lon1)
  const y = Math.sin(dLon) * Math.cos(rad(lat2))
  const x =
    Math.cos(rad(lat1)) * Math.sin(rad(lat2)) -
    Math.sin(rad(lat1)) * Math.cos(rad(lat2)) * Math.cos(dLon)
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360
}

/** Nama arah mata angin berbahasa Indonesia (8 arah). */
export function namaArah(derajat) {
  const idx = Math.round((((derajat % 360) + 360) % 360) / 45) % 8
  return ARAH[idx]
}

/** Titik pusat berbobot luas dari cincin luar poligon GeoJSON ([lon, lat]). */
export function pusatPoligon(ring) {
  let area = 0
  let cx = 0
  let cy = 0
  for (let i = 0; i < ring.length - 1; i += 1) {
    const [x0, y0] = ring[i]
    const [x1, y1] = ring[i + 1]
    const cross = x0 * y1 - x1 * y0
    area += cross
    cx += (x0 + x1) * cross
    cy += (y0 + y1) * cross
  }
  if (Math.abs(area) < 1e-18) {
    const n = Math.max(1, ring.length)
    return {
      lon: ring.reduce((s, p) => s + p[0], 0) / n,
      lat: ring.reduce((s, p) => s + p[1], 0) / n,
    }
  }
  return { lon: cx / (3 * area), lat: cy / (3 * area) }
}

/** Rata-rata koordinat sejumlah titik { lat, lon }. */
export function pusatTitik(points) {
  const n = points.length || 1
  return {
    lat: points.reduce((s, p) => s + p.lat, 0) / n,
    lon: points.reduce((s, p) => s + p.lon, 0) / n,
  }
}
