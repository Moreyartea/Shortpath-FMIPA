export function normalizeText(value = '') {
  return String(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}

function searchableValues(room) {
  return [
    room.kode,
    room.nama,
    room.alias,
    room.namaGedung,
    room.kodeGedung,
  ].map(normalizeText)
}

export function searchRooms(rooms, query) {
  const words = normalizeText(query).split(' ').filter(Boolean)

  if (words.length === 0) return []

  return rooms.filter((room) => {
    const values = searchableValues(room)
    return words.every((word) => values.some((value) => value.includes(word)))
  })
}

export function deduplicateRoomResults(rooms) {
  const seen = new Set()
  return rooms.filter((room) => {
    const key = `${normalizeText(room.nama)}|${room.kodeGedung}|${room.lantai}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}
