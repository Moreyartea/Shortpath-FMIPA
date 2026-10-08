// rooms.js - model ruangan saat dipakai aplikasi: normalisasi, kategori, dan ringkasan isi gedung.

import { normalizeText } from './search'

/** Status kode yang boleh ditampilkan ke pengguna (kode lain masih sementara/belum diverifikasi). */
const STATUS_KODE_RESMI = new Set(['ok', 'ok_sub', 'ok_fasilitas', 'resmi', '', undefined, null])

/** Tebakan kategori dari kata pada nama ruangan (dipakai jika data tidak memuat kategori). */
export function kategoriDariNama(nama) {
  const s = normalizeText(nama)
  if (/\b(toilet|kamar mandi|wc)\b/.test(s)) return 'toilet'
  if (/\btangga\b/.test(s)) return 'tangga'
  if (/\blift\b/.test(s)) return 'lift'
  if (/\bkantin\b/.test(s)) return 'kantin'
  if (/\b(mushola|musholla|musala|masjid|wudhu)\b/.test(s)) return 'ibadah'
  if (/\bpantry\b/.test(s)) return 'pantry'
  if (/\bgudang\b/.test(s)) return 'gudang'
  if (/\b(panel|janitor|control|furnace)\b/.test(s)) return 'utilitas'
  if (/\blaboran\b/.test(s)) return 'kantor'
  if (/\b(lab|laboratorium|praktikum|instrumen)\b/.test(s)) return 'laboratorium'
  if (/\b(perpustakaan|ruang baca)\b/.test(s)) return 'perpustakaan'
  if (/\b(kelas|kuliah|microteaching|mikroteaching|seminar|penguji)\b/.test(s)) return 'kelas'
  if (/\b(koridor|lobby|lobi)\b/.test(s)) return 'area umum'
  if (
    /\b(kantor|dosen|admin|administrasi|jurusan|prodi|kaprodi|dekan|sekretaris|sekretariat|ketua|tata usaha|rapat|tunggu|kepala|asisten|keuangan|informasi|arsip|statistik|kabag|klinik|bisnis|riset|hmj|kreativitas|penelitian|multimedia|kepegawaian|bkd|gpm)\b/.test(
      s
    )
  ) {
    return 'kantor'
  }
  return 'lainnya'
}

/** Kategori yang tidak berguna sebagai tujuan pencarian (tetap tampil di daftar isi gedung). */
export const KATEGORI_TERSEMBUNYI = new Set(['utilitas', 'gudang'])

/** Bangun peta kode gedung kampus -> tempat. */
export function petaKodeKeTempat(daftarTempat) {
  const peta = new Map()
  for (const tempat of daftarTempat) {
    for (const g of tempat.gedung) peta.set(String(g.kode), tempat.id)
    for (const k of tempat.kodeTambahan || []) peta.set(String(k), tempat.id)
  }
  return peta
}

/**
 * Ubah satu baris data mentah (rooms.json atau tabel Supabase) menjadi ruangan siap pakai.
 * Menerima bentuk lokal { kodeGedung, ... } maupun Supabase { gedung_id, ... }.
 */
export function normalisasiRuangan(raw, index, kodeKeTempat) {
  const kodeGedung = String(raw.kodeGedung ?? raw.gedung_id ?? '')
  const lantaiAngka = Number(raw.lantai)
  const lantai = raw.lantai === null || raw.lantai === undefined || raw.lantai === '' || !Number.isInteger(lantaiAngka) ? null : lantaiAngka
  const kode = String(raw.kode ?? '').trim()
  const nama = String(raw.nama ?? '').trim()
  const resmi = STATUS_KODE_RESMI.has(raw.status)
  return {
    id: `${kode || 'tanpa-kode'}#${index}`,
    kode,
    kodeTampil: resmi ? kode : '',
    kodeGedung,
    tempatId: kodeKeTempat.get(kodeGedung) || null,
    lantai,
    nomor: String(raw.nomor ?? ''),
    nama,
    alias: String(raw.alias ?? '').trim(),
    kategori: raw.kategori || kategoriDariNama(nama),
  }
}

export function normalisasiSemua(rawList, daftarTempat) {
  const peta = petaKodeKeTempat(daftarTempat)
  return rawList.map((r, i) => normalisasiRuangan(r, i, peta)).filter((r) => r.nama)
}

/** Kunci stabil untuk membagikan ruangan lewat tautan. */
export function kunciRuangan(ruangan) {
  return `${ruangan.tempatId}|${ruangan.lantai ?? '-'}|${normalizeText(ruangan.nama).replace(/ /g, '-')}`
}

export function cariRuanganDariKunci(daftar, kunci) {
  return daftar.find((r) => kunciRuangan(r) === kunci) || null
}

/** Ruangan sebuah tempat, dikelompokkan per lantai (lantai null di paling akhir). */
export function ruanganPerLantai(daftar, tempatId) {
  const peta = new Map()
  for (const r of daftar) {
    if (r.tempatId !== tempatId) continue
    const kunci = r.lantai ?? 0
    if (!peta.has(kunci)) peta.set(kunci, [])
    peta.get(kunci).push(r)
  }
  return [...peta.entries()]
    .sort((a, b) => (a[0] === 0) - (b[0] === 0) || a[0] - b[0])
    .map(([lantai, ruangan]) => ({
      lantai: lantai === 0 ? null : lantai,
      ruangan: ruangan.sort((a, b) => a.nama.localeCompare(b.nama, 'id', { numeric: true })),
    }))
}

const PENTING = [
  { label: 'Pimpinan fakultas', cocok: /\b(dekan|wakil dekan)\b/ },
  { label: 'Tata usaha', cocok: /\btata usaha\b/ },
  { label: 'Administrasi jurusan', cocok: /\badministrasi jurusan\b/ },
  { label: 'Ketua jurusan dan prodi', cocok: /\b(ketua jurusan|kaprodi|ketua prodi|sekretaris jurusan)\b/ },
  { label: 'Perpustakaan', cocok: /\bperpustakaan\b/ },
  { label: 'Kantin', cocok: /\bkantin\b/ },
]

/** Ringkasan "yang ada di sini" dihitung dari data ruangan, bukan ditulis tangan. */
export function ringkasanIsi(daftar, tempatId) {
  const milik = daftar.filter((r) => r.tempatId === tempatId)
  const hitung = (kat) => milik.filter((r) => r.kategori === kat).length
  const fasilitas = [
    ['toilet', 'toilet', hitung('toilet')],
    ['mushola', 'mushola', hitung('ibadah')],
    ['pantry', 'pantry', hitung('pantry')],
    ['ruang kelas', 'ruang kelas', hitung('kelas')],
    ['laboratorium', 'laboratorium', hitung('laboratorium')],
    ['perpustakaan', 'perpustakaan', hitung('perpustakaan')],
    ['kantin', 'kantin', hitung('kantin')],
  ]
    .filter(([, , n]) => n > 0)
    .map(([kunci, label, n]) => ({ kunci, label, jumlah: n }))

  const penting = []
  for (const kelompok of PENTING) {
    const contoh = milik.filter((r) => kelompok.cocok.test(normalizeText(r.nama)))
    if (contoh.length) penting.push({ label: kelompok.label, jumlah: contoh.length, contoh: contoh.slice(0, 3) })
  }
  return { total: milik.length, fasilitas, penting }
}
