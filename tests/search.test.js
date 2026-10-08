import { describe, expect, test } from 'vitest'
import { indeks, ruangan, tempat } from './helpers'
import {
  normalizeText, searchRooms, deduplicateRoomResults, searchPlaces,
  kebutuhanKueri, saranKoreksi, bangunKosakata, jarakEdit, skorNama,
} from '../src/lib/search'

const namaTempat = new Map(tempat.map((t) => [t.id, `${t.nama} ${t.namaLengkap || ''}`]))
const contoh = [
  { nama: 'Ruang Tata Usaha', alias: 'TU', kode: '001.1.03', kodeTampil: '001.1.03', tempatId: 'syawal', lantai: 1 },
  { nama: 'Ruang Tata Usaha', alias: '', kode: '002.1.03', kodeTampil: '002.1.03', tempatId: 'matematika', lantai: 1 },
  { nama: 'Ruang Tata Usaha', alias: '', kode: '001.2.12', kodeTampil: '001.2.12', tempatId: 'syawal', lantai: 2 },
  { nama: 'Ruang Tata Usaha', alias: '', kode: '001.2.13', kodeTampil: '001.2.13', tempatId: 'syawal', lantai: 2 },
  { nama: 'Kamar Mandi Dosen', alias: '', kode: '', kodeTampil: '', tempatId: 'fisika', lantai: 2 },
  { nama: 'Mushola', alias: '', kode: '', kodeTampil: '', tempatId: 'kimia', lantai: 4 },
  { nama: 'Ruang Studio', alias: '', kode: '', kodeTampil: '', tempatId: 'kimia', lantai: 1 },
]

describe('normalizeText', () => {
  test('huruf kecil, tanpa aksen, tanda baca menjadi spasi', () => {
    expect(normalizeText('  RÉKAP   Data ')).toBe('rekap data')
    expect(normalizeText('Lab. Komputer')).toBe('lab komputer')
    expect(normalizeText('001.1.12')).toBe('001 1 12')
  })
})

describe('Pencarian ruangan', () => {
  test('semua kata kueri harus cocok', () => {
    expect(searchRooms(contoh, 'tata usaha', namaTempat)).toHaveLength(4)
    expect(searchRooms(contoh, 'tata yang tidak ada', namaTempat)).toHaveLength(0)
    expect(searchRooms(contoh, '', namaTempat)).toHaveLength(0)
    expect(searchRooms(contoh, '   ', namaTempat)).toHaveLength(0)
  })

  test('nama gedung dan kode ikut dicari', () => {
    expect(searchRooms(contoh, 'mushola kimia', namaTempat)).toHaveLength(1)
    expect(searchRooms(contoh, '001.1.03', namaTempat)).toHaveLength(1)
  })

  test('singkatan dan sinonim: TU, WC, musholla, perpus, kaprodi', () => {
    expect(searchRooms(contoh, 'tu', namaTempat)).toHaveLength(4)
    expect(searchRooms(contoh, 'wc', namaTempat)[0].nama).toBe('Kamar Mandi Dosen')
    expect(searchRooms(contoh, 'toilet', namaTempat)[0].nama).toBe('Kamar Mandi Dosen')
    expect(searchRooms(contoh, 'musholla', namaTempat)[0].nama).toBe('Mushola')
  })

  test('kata sangat pendek harus cocok utuh (tidak ikut mencocokkan di tengah kata)', () => {
    expect(searchRooms(contoh, 'ru', namaTempat)).toHaveLength(0)
    expect(searchRooms(contoh, 'ruang', namaTempat).length).toBeGreaterThan(0)
  })

  test('nama sama di tempat/lantai berbeda tetap tampil; di tempat+lantai sama digabung', () => {
    const hasil = deduplicateRoomResults(searchRooms(contoh, 'tata usaha', namaTempat))
    expect(hasil).toHaveLength(3)
    expect(hasil.find((h) => h.tempatId === 'syawal' && h.lantai === 2).jumlah).toBe(2)
    expect(contoh).toHaveLength(7) // data asli tidak berubah
  })

  test('skorNama mengurutkan: persis < awalan < kata < lainnya', () => {
    expect(skorNama('Pantry', 'pantry')).toBe(0)
    expect(skorNama('Pantry Dosen', 'pantry')).toBe(1)
    expect(skorNama('Ruang Pantry', 'pantry')).toBe(2)
    expect(skorNama('Ruang Kelas', 'pantry')).toBe(3)
  })

  test('frasa sinonim dua kata dikenali', () => {
    expect(kebutuhanKueri('kamar mandi')).toHaveLength(1)
    expect(kebutuhanKueri('kamar mandi')[0]).toContain('toilet')
  })
})

describe('Pencarian pada data nyata', () => {
  const cari = (q) => deduplicateRoomResults(searchRooms(ruangan, q, namaTempat))

  test('pantry: muncul di beberapa gedung dan lantai', () => {
    const h = cari('pantry')
    expect(h.length).toBeGreaterThan(3)
    expect(new Set(h.map((x) => x.tempatId)).size).toBeGreaterThan(1)
  })

  test('toilet menemukan "Kamar Mandi", "Toilet" dan "WC"', () => {
    expect(cari('toilet').length).toBeGreaterThan(20)
    expect(cari('wc').length).toBe(cari('toilet').length)
  })

  test('kata penting bagi mahasiswa baru selalu menghasilkan sesuatu', () => {
    for (const q of ['dekan', 'tata usaha', 'perpustakaan', 'mushola', 'kantin', 'kaprodi', 'administrasi jurusan', 'ketua jurusan', 'lab komputer', 'ruang dosen', 'toilet']) {
      expect(cari(q).length, q).toBeGreaterThan(0)
    }
  })

  test('ruangan pimpinan fakultas ada walau lantainya belum tercatat', () => {
    const dekan = cari('dekan fmipa')
    expect(dekan.length).toBeGreaterThan(0)
    expect(dekan.some((x) => x.lantai === null && x.tempatId === 'syawal')).toBe(true)
  })

  test('mencari nama gedung juga menemukan tempatnya', () => {
    expect(searchPlaces(tempat, 'syawal')[0].id).toBe('syawal')
    expect(searchPlaces(tempat, 'dekanat')[0].id).toBe('syawal')
    expect(searchPlaces(tempat, 'lab komputer').map((t) => t.id)).toContain('lab-komputer')
    expect(searchPlaces(tempat, '012').map((t) => t.id)).toEqual(['belajar-bersama'])
    expect(searchPlaces(tempat, 'zzzz')).toHaveLength(0)
  })
})

describe('Saran koreksi ejaan', () => {
  const kosakata = bangunKosakata(ruangan, tempat)

  test('jarak edit', () => {
    expect(jarakEdit('pantry', 'pantri')).toBe(1)
    expect(jarakEdit('abc', 'abc')).toBe(0)
    expect(jarakEdit('', 'abc')).toBe(3)
  })

  test('memperbaiki salah ketik umum', () => {
    expect(saranKoreksi('pantri', kosakata)).toBe('pantry')
    expect(saranKoreksi('perpusakaan', kosakata)).toBe('perpustakaan')
    expect(saranKoreksi('laborotorium', kosakata)).toBe('laboratorium')
  })

  test('kata yang sudah benar atau terlalu pendek tidak diubah', () => {
    expect(saranKoreksi('pantry', kosakata)).toBeNull()
    expect(saranKoreksi('tu', kosakata)).toBeNull()
    expect(saranKoreksi('', kosakata)).toBeNull()
  })

  test('kata tanpa kemiripan tidak diberi saran', () => {
    expect(saranKoreksi('qwxzvbn', kosakata)).toBeNull()
  })
})

describe('Tempat terhubung', () => {
  test('Syawal hanya dipakai sebagai kata kunci tempat, bukan gedung lain', () => {
    expect(indeks.byId.get('syawal').titik).toEqual([5, 6, 7, 8])
  })
})
