// hasilCari.js - menyusun hasil pencarian untuk ditampilkan (gedung dan ruangan), terurut dan terkelompok.

import {
  bangunKosakata, deduplicateRoomResults, normalizeText, saranKoreksi, searchPlaces, searchRooms, skorKueri,
} from './search'
import { KATEGORI_TERSEMBUNYI } from './rooms'

const KATA_UTILITAS = /\b(gudang|panel|janitor|control|furnace|utilitas)\b/

/** Ruangan utilitas/gudang disembunyikan kecuali pengguna memang mencarinya. */
function bolehTampil(ruangan, kueri) {
  if (!KATEGORI_TERSEMBUNYI.has(ruangan.kategori)) return true
  return KATA_UTILITAS.test(normalizeText(kueri))
}

const bandingLantai = (a, b) => (a ?? 999) - (b ?? 999)

/** Nama persis dan nama berawalan kueri dianggap setara; yang lebih dekat dari titik awal didahulukan. */
const tingkat = (skor) => (skor <= 1 ? 0 : skor)

export function susunHasil({ kueri, daftarTempat, ruangan, namaTempat, jarakTempat = new Map(), hanyaTempat = false, batasRuangan = 40, kosakata }) {
  const q = normalizeText(kueri)
  if (!q) return { tempat: [], ruangan: [], totalRuangan: 0, saran: null, kosong: true }

  const jarak = (id) => jarakTempat.get(id) ?? Infinity
  const tempat = searchPlaces(daftarTempat, kueri)
    .map((t) => ({ tempat: t, skor: tingkat(Math.min(skorKueri(t.nama, kueri), skorKueri(t.label, kueri))), jarak: jarak(t.id) }))
    .sort((a, b) => a.skor - b.skor || a.jarak - b.jarak || a.tempat.nama.localeCompare(b.tempat.nama, 'id'))

  let ruanganHasil = []
  let totalRuangan = 0
  if (!hanyaTempat) {
    const semua = deduplicateRoomResults(searchRooms(ruangan, kueri, namaTempat).filter((r) => bolehTampil(r, kueri)))
    totalRuangan = semua.length
    ruanganHasil = semua
      .map((r) => ({ ...r, skor: tingkat(skorKueri(r.nama, kueri)), jarak: jarak(r.tempatId) }))
      .sort(
        (a, b) =>
          a.skor - b.skor ||
          a.jarak - b.jarak ||
          a.nama.localeCompare(b.nama, 'id') ||
          bandingLantai(a.lantai, b.lantai)
      )
      .slice(0, batasRuangan)
  }

  const kosong = tempat.length === 0 && ruanganHasil.length === 0
  const saran = kosong ? saranKoreksi(kueri, kosakata ?? bangunKosakata(ruangan, daftarTempat)) : null
  return { tempat, ruangan: ruanganHasil, totalRuangan, saran, kosong }
}

/** Pencarian cepat yang benar-benar punya hasil pada data saat ini. */
export function pilihanCepat(ruangan, daftarTempat, namaTempat) {
  const kandidat = [
    ['Toilet', 'toilet'],
    ['Mushola', 'mushola'],
    ['Dekan', 'dekan'],
    ['Tata usaha', 'tata usaha'],
    ['Perpustakaan', 'perpustakaan'],
    ['Kantin', 'kantin'],
    ['Lab. Komputer', 'lab komputer'],
    ['Ruang dosen', 'ruang dosen'],
    ['Administrasi jurusan', 'administrasi jurusan'],
  ]
  return kandidat
    .filter(([, q]) => {
      const h = susunHasil({ kueri: q, daftarTempat, ruangan, namaTempat, kosakata: [] })
      return h.tempat.length + h.ruangan.length > 0
    })
    .map(([label, q]) => ({ label, kueri: q }))
}
