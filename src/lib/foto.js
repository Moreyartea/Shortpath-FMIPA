/**
 * Modul pemetaan foto gedung dan fasilitas kawasan FMIPA Unimed.
 * Memetakan berkas WebP di src/assets/foto/ ke ID tempat.
 */

const fotoModules = import.meta.glob('../assets/foto/*.webp', { eager: true, import: 'default' })

const FOTO_TEMPAT = {}

for (const [path, url] of Object.entries(fotoModules)) {
  const match = path.match(/\/([^/]+)\.webp$/)
  if (match) {
    FOTO_TEMPAT[match[1]] = url
  }
}

/**
 * Mengambil URL foto untuk ID tempat tertentu.
 * @param {string} tempatId
 * @returns {string|null}
 */
export function ambilFotoTempat(tempatId) {
  if (!tempatId) return null
  return FOTO_TEMPAT[tempatId] || null
}

/**
 * Mengecek apakah tempat memiliki foto yang tersedia.
 * @param {string} tempatId
 * @returns {boolean}
 */
export function adaFotoTempat(tempatId) {
  return Boolean(FOTO_TEMPAT[tempatId])
}

export { FOTO_TEMPAT }
