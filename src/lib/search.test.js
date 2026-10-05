import { describe, expect, it } from 'vitest'
import { deduplicateRoomResults, normalizeText, searchRooms } from './search'

const rooms = [
  { kode: '001.1.03', nama: 'Ruang Tata Usaha', alias: 'TU', kodeGedung: '001', namaGedung: 'Gedung Syawal', lantai: 1 },
  { kode: '002.1.03', nama: 'Ruang Tata Usaha', alias: '', kodeGedung: '002', namaGedung: 'Gedung Matematika', lantai: 1 },
  { kode: '001.2.12', nama: 'Ruang Tata Usaha', alias: '', kodeGedung: '001', namaGedung: 'Gedung Syawal', lantai: 2 },
]

describe('Pencarian ruangan', () => {
  it('menormalisasi huruf dan aksen', () => {
    expect(normalizeText('  RÉKAP   Data ')).toBe('rekap data')
  })

  it('semua kata query harus cocok', () => {
    expect(searchRooms(rooms, 'tata usaha')).toHaveLength(3)
    expect(searchRooms(rooms, 'tata yang tidak ada')).toHaveLength(0)
  })

  it('mencari lewat kode dan alias', () => {
    expect(searchRooms(rooms, '001.1.03')).toHaveLength(1)
    expect(searchRooms(rooms, 'tu')).toHaveLength(1)
  })

  it('duplikat nama pada gedung dan lantai berbeda tetap tampil', () => {
    expect(deduplicateRoomResults(searchRooms(rooms, 'tata usaha'))).toHaveLength(3)
  })

  it('duplikat nama pada gedung dan lantai yang sama ditampilkan sekali', () => {
    const duplicated = [...rooms, { ...rooms[0], kode: '001.1.03.9' }]
    expect(deduplicateRoomResults(searchRooms(duplicated, 'tata usaha'))).toHaveLength(3)
  })
})
