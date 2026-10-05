import { haversineDistance } from './graph'

export function getCurrentPosition(options = {}) {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Browser ini tidak mendukung GPS.'))
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
    const distance = haversineDistance(
      position.lat,
      position.lon,
      point.lat,
      point.lon
    )

    if (!nearest || distance < nearest.distance) {
      nearest = { ...point, distance }
    }
  }

  return nearest
}
