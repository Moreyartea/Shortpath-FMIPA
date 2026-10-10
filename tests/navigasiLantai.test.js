import { describe, it, expect } from 'vitest'
import {
  tentukanNavigasiLantai,
  cekFasilitasLift,
} from '../src/lib/navigasiLantai'

describe('navigasiLantai — Uji Aturan Navigasi Lantai FMIPA (GEMINI.md)', () => {
  // 1. gedung sama + lantai sama
  it('1. gedung sama + lantai sama: tidak perlu instruksi pindah lantai', () => {
    const asal = { kodeGedung: '002', lantai: 3, nama: 'Ruang A' }
    const tujuan = { kodeGedung: '002', lantai: 3, nama: 'Ruang B' }
    const hasil = tentukanNavigasiLantai(asal, tujuan)

    expect(hasil.jenis).toBe('sama-gedung-sama-lantai')
    expect(hasil.perluPindahLantai).toBe(false)
    expect(hasil.fasilitasDigunakan).toBeNull()
    expect(hasil.langkah).toEqual([])
  })

  // 2. gedung sama + lantai berbeda
  it('2. gedung sama + lantai berbeda: memberikan instruksi naik/turun dengan fasilitas yang sesuai', () => {
    const asal = { kodeGedung: '002', lantai: 1, nama: 'Ruang Lantai 1' }
    const tujuan = { kodeGedung: '002', lantai: 5, nama: 'Ruang Lantai 5' }
    const hasil = tentukanNavigasiLantai(asal, tujuan)

    expect(hasil.jenis).toBe('sama-gedung-beda-lantai')
    expect(hasil.perluPindahLantai).toBe(true)
    expect(hasil.fasilitasDigunakan).toBe('lift')
    expect(hasil.langkah.length).toBeGreaterThan(0)
    expect(hasil.langkah[0]).toMatch(/Naik ke lantai 5/)
    expect(hasil.langkah[0]).toMatch(/lift/)
  })

  // 3. 010 lantai 2 → 009 lantai 2
  it('3. 010 lantai 2 → 009 lantai 2: gunakan koneksi langsung pada lantai sama, tidak perlu naik/turun', () => {
    const asal = { kodeGedung: '010', lantai: 2 }
    const tujuan = { kodeGedung: '009', lantai: 2 }
    const hasil = tentukanNavigasiLantai(asal, tujuan)

    expect(hasil.jenis).toBe('koneksi-langsung')
    expect(hasil.perluPindahLantai).toBe(false)
    expect(hasil.fasilitasDigunakan).toBeNull()
    expect(hasil.langkah).toHaveLength(1)
    expect(hasil.langkah[0]).toBe('Jalan lewat koridor penghubung lantai 2 Lab. Biologi dan Lab. Komputer.')
    expect(hasil.langkah[0]).not.toMatch(/turun|naik/i)
  })

  // 4. 011 lantai 3 → 009 lantai 3
  it('4. 011 lantai 3 → 009 lantai 3: gunakan koneksi langsung pada lantai sama, tidak perlu naik/turun', () => {
    const asal = { kodeGedung: '011', lantai: 3 }
    const tujuan = { kodeGedung: '009', lantai: 3 }
    const hasil = tentukanNavigasiLantai(asal, tujuan)

    expect(hasil.jenis).toBe('koneksi-langsung')
    expect(hasil.perluPindahLantai).toBe(false)
    expect(hasil.fasilitasDigunakan).toBeNull()
    expect(hasil.langkah).toHaveLength(1)
    expect(hasil.langkah[0]).toBe('Jalan lewat koridor penghubung lantai 3 Lab. Biologi dan Lab. Komputer.')
    expect(hasil.langkah[0]).not.toMatch(/turun|naik/i)
  })

  // 5. 010 lantai 3 → 009 lantai 1
  it('5. 010 lantai 3 → 009 lantai 1: pindah ke lantai tujuan terlebih dahulu, kemudian gunakan koneksi', () => {
    const asal = { kodeGedung: '010', lantai: 3 }
    const tujuan = { kodeGedung: '009', lantai: 1 }
    const hasil = tentukanNavigasiLantai(asal, tujuan)

    expect(hasil.jenis).toBe('koneksi-beda-lantai')
    expect(hasil.perluPindahLantai).toBe(true)
    expect(hasil.fasilitasDigunakan).toBe('tangga') // 010 tidak ada lift
    expect(hasil.langkah).toHaveLength(2)
    // Langkah 1: turun ke lantai 1 di gedung asal menggunakan tangga
    expect(hasil.langkah[0]).toMatch(/turun ke lantai 1/i)
    expect(hasil.langkah[0]).toMatch(/tangga/)
    // Langkah 2: koridor penghubung lantai 1 ke gedung tujuan
    expect(hasil.langkah[1]).toBe('Jalan lewat koridor penghubung lantai 1 Lab. Biologi dan Lab. Komputer.')
  })

  // 6. 011 lantai 4 → 009 lantai 3
  it('6. 011 lantai 4 → 009 lantai 3: pindah ke lantai tujuan terlebih dahulu (tangga), kemudian gunakan koneksi', () => {
    const asal = { kodeGedung: '011', lantai: 4 }
    const tujuan = { kodeGedung: '009', lantai: 3 }
    const hasil = tentukanNavigasiLantai(asal, tujuan)

    expect(hasil.jenis).toBe('koneksi-beda-lantai')
    expect(hasil.perluPindahLantai).toBe(true)
    expect(hasil.fasilitasDigunakan).toBe('tangga')
    expect(hasil.langkah).toHaveLength(2)
    // Langkah 1: turun ke lantai 3 menggunakan tangga
    expect(hasil.langkah[0]).toMatch(/turun ke lantai 3/i)
    expect(hasil.langkah[0]).toMatch(/tangga/)
    // Langkah 2: koridor penghubung lantai 3
    expect(hasil.langkah[1]).toBe('Jalan lewat koridor penghubung lantai 3 Lab. Biologi dan Lab. Komputer.')
  })

  // 7. Fisika lantai 3 → lantai 8 dapat menggunakan lift
  it('7. Fisika (004) lantai 3 → lantai 8: dapat menggunakan lift', () => {
    expect(cekFasilitasLift('004', 3, 8)).toBe(true)

    const asal = { kodeGedung: '004', lantai: 3 }
    const tujuan = { kodeGedung: '004', lantai: 8 }
    const hasil = tentukanNavigasiLantai(asal, tujuan)

    expect(hasil.fasilitasDigunakan).toBe('lift')
    expect(hasil.langkah[0]).toMatch(/lift/)
  })

  // 8. Fisika lantai 3 → lantai 9 tidak boleh memilih lift
  it('8. Fisika (004) lantai 3 → lantai 9: tidak boleh memilih lift (lift hanya sampai lantai 8)', () => {
    expect(cekFasilitasLift('004', 3, 9)).toBe(false)

    const asal = { kodeGedung: '004', lantai: 3 }
    const tujuan = { kodeGedung: '004', lantai: 9 }
    const hasil = tentukanNavigasiLantai(asal, tujuan)

    expect(hasil.fasilitasDigunakan).toBe('tangga')
    expect(hasil.langkah[0]).toMatch(/tangga/)
    expect(hasil.langkah[0]).not.toMatch(/lift/)
  })

  // 9. Biologi lantai 3 → lantai 9 tidak boleh memilih lift
  it('9. Biologi (005) lantai 3 → lantai 9: tidak boleh memilih lift (lift hanya sampai lantai 8)', () => {
    expect(cekFasilitasLift('005', 3, 9)).toBe(false)

    const asal = { kodeGedung: '005', lantai: 3 }
    const tujuan = { kodeGedung: '005', lantai: 9 }
    const hasil = tentukanNavigasiLantai(asal, tujuan)

    expect(hasil.fasilitasDigunakan).toBe('tangga')
    expect(hasil.langkah[0]).toMatch(/tangga/)
    expect(hasil.langkah[0]).not.toMatch(/lift/)
  })

  // 10. GPS tanpa lantai tidak boleh mengarang lantai
  it('10. GPS sebagai asal tidak boleh mengarang lantai pengguna', () => {
    const asal = { jenis: 'gps', lat: 3.59, lon: 98.67 }
    const tujuan = { kodeGedung: '002', lantai: 5, nama: 'Ruang Kuliah' }
    const hasil = tentukanNavigasiLantai(asal, tujuan)

    expect(hasil.jenis).toBe('tidak-diketahui')
    expect(hasil.instruksiAsal).toBeNull()
    // Instruksi tujuan tetap memberikan info naik setelah masuk gedung tujuan
    expect(hasil.instruksiTujuan).toMatch(/Setelah masuk.*naik ke lantai 5/)
  })

  // 11. Gedung berbeda biasa
  it('11. Gedung berbeda biasa: instruksi outdoor + turun dari lantai asal + naik di lantai tujuan', () => {
    const asal = { kodeGedung: '001', lantai: 2 } // Syawal Lt 2 (tidak ada lift)
    const tujuan = { kodeGedung: '004', lantai: 5 } // Fisika Lt 5 (ada lift)
    const hasil = tentukanNavigasiLantai(asal, tujuan)

    expect(hasil.jenis).toBe('beda-gedung')
    expect(hasil.langkah).toHaveLength(2)
    // Turun dari Syawal menggunakan tangga
    expect(hasil.instruksiAsal).toMatch(/Turun ke lantai 1 menggunakan tangga/)
    // Naik di Fisika menggunakan lift
    expect(hasil.instruksiTujuan).toMatch(/naik ke lantai 5 menggunakan lift/)
  })

  // 12. Lantai null atau tidak diketahui
  it('12. Penanganan aman jika lantai null pada asal atau tujuan', () => {
    const asal = { kodeGedung: '001', lantai: null }
    const tujuan = { kodeGedung: '004', lantai: null }
    const hasil = tentukanNavigasiLantai(asal, tujuan)

    expect(hasil.jenis).toBe('tidak-diketahui')
    expect(hasil.perluPindahLantai).toBe(false)
    expect(hasil.langkah).toEqual([])
  })
})
