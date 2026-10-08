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

export function findNearestPoint(position, pointsById) {
  let nearest = null
  for (const point of Object.values(pointsById)) {
    const distance = haversineDistance(position.lat, position.lon, point.lat, point.lon)
    if (!nearest || distance < nearest.distance) nearest = { ...point, distance }
  }
  return nearest
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
