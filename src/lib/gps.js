import { haversineDistance } from './graph'

/** Batas jarak: lebih jauh dari ini dari titik terdekat, pengguna dianggap di luar kawasan FMIPA. */
export const JARAK_DI_KAMPUS_M = 250

export function getCurrentPosition(options = {}) {
  return new Promise((resolve, reject) => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      reject(Object.assign(new Error('Browser ini tidak mendukung GPS.'), { code: 0 }))
      return
    }
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 30000,
      ...options,
    })
  })
}

/**
 * Mengecek apakah koordinat [lon, lat] berada di dalam satu cincin GeoJSON.
 * Titik di batas dianggap berada di dalam.
 */
function titikDiCincin(lon, lat, ring) {
  let diDalam = false
  const eps = 1e-12
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i, i += 1) {
    const [xi, yi] = ring[i]
    const [xj, yj] = ring[j]
    const silang = (yi - lat) * (xj - xi) - (xi - lon) * (yj - yi)
    const diSegmen =
      Math.abs(silang) <= eps &&
      lon >= Math.min(xi, xj) - eps &&
      lon <= Math.max(xi, xj) + eps &&
      lat >= Math.min(yi, yj) - eps &&
      lat <= Math.max(yi, yj) + eps
    if (diSegmen) return true

    const memotong = (yi > lat) !== (yj > lat)
    if (memotong) {
      const xPotong = ((xj - xi) * (lat - yi)) / (yj - yi) + xi
      if (lon < xPotong) diDalam = !diDalam
    }
  }
  return diDalam
}

function titikDiPoligon(lon, lat, coordinates) {
  if (!coordinates?.length) return false
  if (!titikDiCincin(lon, lat, coordinates[0])) return false
  for (const lubang of coordinates.slice(1)) {
    if (titikDiCincin(lon, lat, lubang)) return false
  }
  return true
}

/**
 * Cari gedung yang memuat posisi GPS. Hanya tempat yang punya kode gedung
 * yang diprioritaskan; fasilitas luar seperti taman tidak dijadikan asal gedung.
 * Jika beberapa poligon bersinggungan, gedung yang pertama cocok dipakai.
 */
export function findPlaceContainingPoint(position, polygonGeoJson, daftarTempat) {
  const lon = Number(position?.lon)
  const lat = Number(position?.lat)
  if (!Number.isFinite(lon) || !Number.isFinite(lat)) return null

  const tempatByPoligon = new Map(
    daftarTempat
      .filter((tempat) => tempat?.gedung?.length && tempat.poligon != null)
      .map((tempat) => [String(tempat.poligon), tempat])
  )

  for (const feature of polygonGeoJson?.features || []) {
    const tempat = tempatByPoligon.get(String(feature?.properties?.id))
    if (!tempat || !feature.geometry) continue
    const { type, coordinates } = feature.geometry
    const cocok =
      type === 'Polygon'
        ? titikDiPoligon(lon, lat, coordinates)
        : type === 'MultiPolygon'
          ? coordinates.some((polygon) => titikDiPoligon(lon, lat, polygon))
          : false
    if (cocok) return tempat
  }
  return null
}

export function findNearestPoint(position, pointsById) {
  let nearest = null
  for (const point of Object.values(pointsById)) {
    const distance = haversineDistance(position.lat, position.lon, point.lat, point.lon)
    if (!nearest || distance < nearest.distance) nearest = { ...point, distance }
  }
  return nearest
}

/** Cari titik jaringan terdekat hanya di antara titik milik satu tempat. */
export function findNearestPointForPlace(position, tempat, pointsById) {
  const titik = (tempat?.titik || []).reduce((hasil, id) => {
    const point = pointsById[id]
    if (point) hasil[id] = point
    return hasil
  }, {})
  return findNearestPoint(position, titik)
}

/** Pesan galat GPS yang mudah dipahami. */
export function pesanGalatGps(err) {
  if (typeof window !== 'undefined' && window.isSecureContext === false) {
    return 'Lokasi hanya bisa dipakai jika situs dibuka lewat HTTPS. Pilih titik awal secara manual.'
  }
  if (err?.code === 1) return 'Izin lokasi ditolak. Aktifkan izin lokasi di browser, atau pilih titik awal secara manual.'
  if (err?.code === 2) return 'Lokasi tidak tersedia saat ini. Pilih titik awal secara manual.'
  if (err?.code === 3) return 'Pencarian lokasi terlalu lama. Coba lagi, atau pilih titik awal secara manual.'
  return err?.message || 'Lokasi tidak dapat dibaca. Pilih titik awal secara manual.'
}
