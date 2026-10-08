// search.js - normalisasi teks, sinonim, pencarian bertingkat, dan saran koreksi ejaan.
// Murni (tanpa DOM) supaya mudah diuji.

/** Huruf kecil, tanpa aksen, tanda baca menjadi spasi, spasi dirapikan. */
export function normalizeText(value = '') {
  return String(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

/**
 * Kelompok sinonim. Mencari salah satu kata sama dengan mencari semuanya.
 * Hanya berisi istilah yang memang dipakai pada nama ruangan atau lazim dipakai mahasiswa.
 */
export const SINONIM = [
  ['toilet', 'wc', 'kamar mandi', 'kamar kecil', 'lavatory'],
  ['mushola', 'musholla', 'musala', 'mushalla', 'musalla', 'masjid', 'sholat', 'salat', 'ibadah', 'wudhu'],
  ['tata usaha', 'tu'],
  ['wakil dekan', 'wd'],
  ['kaprodi', 'ketua prodi', 'ketua program studi'],
  ['perpustakaan', 'perpus', 'ruang baca'],
  ['laboratorium', 'lab'],
  ['kantin', 'kantin makan'],
  ['dosen', 'ruang dosen'],
  ['dekan', 'dekanat'],
  ['administrasi', 'admin'],
  ['ilmu komputer', 'ilkom'],
]

const KATA_SINGKAT = 2

function ekspansiToken(token) {
  const hasil = new Set([token])
  for (const kelompok of SINONIM) {
    if (kelompok.includes(token)) kelompok.forEach((k) => hasil.add(k))
  }
  return [...hasil]
}

/** Pecah kueri menjadi "kebutuhan": kata atau frasa sinonim yang harus cocok. */
export function kebutuhanKueri(kueri) {
  const q = normalizeText(kueri)
  if (!q) return []
  const kata = q.split(' ')
  const kebutuhan = []
  for (let i = 0; i < kata.length; i += 1) {
    // frasa dua kata yang termasuk sinonim ("tata usaha", "kamar mandi")
    const dua = kata[i + 1] ? `${kata[i]} ${kata[i + 1]}` : null
    if (dua && SINONIM.some((k) => k.includes(dua))) {
      kebutuhan.push(ekspansiToken(dua))
      i += 1
      continue
    }
    kebutuhan.push(ekspansiToken(kata[i]))
  }
  return kebutuhan
}

/** true jika `varian` cocok pada teks yang sudah dinormalisasi. Kata pendek harus utuh. */
function cocokVarian(teks, varian) {
  const padded = ` ${teks} `
  if (varian.length <= KATA_SINGKAT) return padded.includes(` ${varian} `)
  if (varian.includes(' ')) return padded.includes(` ${varian}`) // frasa: awal kata
  return padded.includes(` ${varian}`) || (varian.length >= 4 && teks.includes(varian))
}

export function cocokKebutuhan(teks, kebutuhan) {
  return kebutuhan.every((varian) => varian.some((v) => cocokVarian(teks, v)))
}

/**
 * Skor kecocokan nama terhadap kueri yang boleh memakai sinonim:
 * "toilet" dan "kamar mandi" dianggap setara, supaya urutan hasil tidak bergantung pada kata yang kebetulan dipakai nama ruangan.
 */
export function skorKueri(nama, kueri) {
  const kebutuhan = kebutuhanKueri(kueri)
  if (kebutuhan.length !== 1) return skorNama(nama, kueri)
  return Math.min(...kebutuhan[0].map((v) => skorNama(nama, v)))
}

/** Skor kecocokan nama: makin kecil makin relevan (0 = persis). */
export function skorNama(nama, kueri) {
  const n = normalizeText(nama)
  const q = normalizeText(kueri)
  if (!q) return 3
  if (n === q) return 0
  if (n.startsWith(q)) return 1
  if (` ${n}`.includes(` ${q}`)) return 2
  return 3
}

/** Cari ruangan. `namaTempat` memetakan tempatId -> nama tempat agar nama gedung ikut dicari. */
export function searchRooms(rooms, query, namaTempat = new Map()) {
  const kebutuhan = kebutuhanKueri(query)
  if (kebutuhan.length === 0) return []
  return rooms.filter((r) => {
    const teks = normalizeText(
      [r.nama, r.alias, r.kodeTampil, r.kode, namaTempat.get(r.tempatId)].join(' ')
    )
    return cocokKebutuhan(teks, kebutuhan)
  })
}

/** Nama sama pada tempat dan lantai yang sama hanya tampil sekali; jumlahnya dicatat. */
export function deduplicateRoomResults(rooms) {
  const grup = new Map()
  for (const r of rooms) {
    const kunci = `${normalizeText(r.nama)}|${r.tempatId}|${r.lantai ?? '-'}`
    const ada = grup.get(kunci)
    if (ada) ada.jumlah += 1
    else grup.set(kunci, { ...r, jumlah: 1 })
  }
  return [...grup.values()]
}

/** Cari tempat (gedung) berdasarkan nama, nama lengkap, alias, label, dan kode gedung. */
export function searchPlaces(daftarTempat, query) {
  const kebutuhan = kebutuhanKueri(query)
  if (kebutuhan.length === 0) return []
  return daftarTempat.filter((t) => {
    const teks = normalizeText(
      [t.nama, t.label, t.namaLengkap, ...(t.alias || []), ...t.gedung.map((g) => g.kode)].join(' ')
    )
    return cocokKebutuhan(teks, kebutuhan)
  })
}

// ---------- Saran koreksi ejaan ----------

export function jarakEdit(a, b) {
  if (a === b) return 0
  const m = a.length
  const n = b.length
  if (!m) return n
  if (!n) return m
  let sebelum = Array.from({ length: n + 1 }, (_, j) => j)
  for (let i = 1; i <= m; i += 1) {
    const sekarang = [i]
    for (let j = 1; j <= n; j += 1) {
      const biaya = a[i - 1] === b[j - 1] ? 0 : 1
      sekarang[j] = Math.min(sebelum[j] + 1, sekarang[j - 1] + 1, sebelum[j - 1] + biaya)
    }
    sebelum = sekarang
  }
  return sebelum[n]
}

/** Kosakata dari nama ruangan dan tempat, dipakai untuk saran "Maksud kamu ...?". */
export function bangunKosakata(rooms, daftarTempat) {
  const kata = new Set()
  const tambah = (teks) =>
    normalizeText(teks)
      .split(' ')
      .filter((k) => k.length >= 4)
      .forEach((k) => kata.add(k))
  rooms.forEach((r) => tambah(`${r.nama} ${r.alias}`))
  daftarTempat.forEach((t) => tambah([t.nama, t.label, ...(t.alias || [])].join(' ')))
  SINONIM.flat().forEach(tambah)
  return [...kata]
}

/** Jika kueri tidak menghasilkan apa pun, usulkan kueri dengan ejaan yang diperbaiki (atau null). */
export function saranKoreksi(kueri, kosakata) {
  const kata = normalizeText(kueri).split(' ').filter(Boolean)
  if (!kata.length) return null
  let berubah = false
  const baru = kata.map((k) => {
    if (k.length < 4 || kosakata.some((v) => v.startsWith(k))) return k
    const batas = k.length >= 8 ? 2 : 1
    let terbaik = null
    for (const v of kosakata) {
      const j = jarakEdit(k, v)
      if (j <= batas && (!terbaik || j < terbaik.j)) terbaik = { v, j }
    }
    if (terbaik) {
      berubah = true
      return terbaik.v
    }
    return k
  })
  return berubah ? baru.join(' ') : null
}
