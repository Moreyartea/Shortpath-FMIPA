import { describe, expect, test } from 'vitest'
import { ruanganMentah, tempat } from './helpers'
import { pisahkanDataAwal, validasiBarisImpor } from '../src/lib/adminData'

describe('Data awal untuk Supabase', () => {
  const { siap, belum } = pisahkanDataAwal(ruanganMentah)

  test('baris yang dikirim punya kode unik, lantai >= 1, dan nomor', () => {
    expect(siap.length).toBeGreaterThan(500)
    expect(new Set(siap.map((r) => r.kode)).size).toBe(siap.length)
    for (const r of siap) {
      expect(r.lantai).toBeGreaterThanOrEqual(1)
      expect(r.nomor).toBeTruthy()
      expect(r.kode.startsWith(`${r.gedung_id}.${r.lantai}.`)).toBe(true)
    }
  })

  test('baris yang belum lengkap dilaporkan lengkap dengan alasannya, tidak hilang diam-diam', () => {
    expect(siap.length + belum.length).toBe(ruanganMentah.length)
    expect(belum.every((r) => r.alasan)).toBe(true)
    expect(belum.some((r) => /lantai belum tercatat/.test(r.alasan))).toBe(true)
    expect(belum.some((r) => /dipakai \d+ ruangan/.test(r.alasan))).toBe(true)
    expect(belum.some((r) => /tidak punya nomor/.test(r.alasan))).toBe(true)
  })

  test('kode yang dipakai dua ruangan tidak dikirim sama sekali (salah satunya pasti keliru)', () => {
    const ganda = belum.filter((r) => /dipakai \d+ ruangan/.test(r.alasan)).map((r) => r.kode)
    expect(new Set(ganda)).toEqual(new Set(['004.4.12', '004.7.08']))
    for (const k of ganda) expect(siap.filter((r) => r.kode === k)).toHaveLength(0)
  })
})

describe('Validasi impor massal', () => {
  const cek = (t, lihat = new Set()) => validasiBarisImpor(t, 1, lihat, tempat)

  test('baris sah, termasuk alias yang mengandung koma', () => {
    expect(cek('001.1.12,Mushola,musholla, tempat ibadah').baris).toEqual({ kode: '001.1.12', gedung_id: '001', lantai: 1, nomor: '12', nama: 'Mushola', alias: 'musholla, tempat ibadah' })
    expect(cek('005.10.01,Ruang Rapat').baris.lantai).toBe(10)
    expect(cek('011.4.02,Lab Kultur').baris.gedung_id).toBe('011')
  })

  test('Lab. Biologi: lantai dibatasi per kode gedung (010 punya 3 lantai, 011 punya 4)', () => {
    expect(cek('010.4.01,X').galat).toMatch(/lantai 1 sampai 3/)
    expect(cek('011.4.01,X').baris).toBeTruthy()
  })

  test('menolak kode salah, gedung tak dikenal, lantai di luar batas, nama kosong, kode ganda', () => {
    expect(cek('001.1,Lobi').galat).toMatch(/tidak valid/)
    expect(cek('abc,Ruang').galat).toMatch(/tidak valid/)
    expect(cek('099.1.01,Ruang').galat).toMatch(/tidak dikenal/)
    expect(cek('001.9.01,Ruang').galat).toMatch(/hanya punya lantai 1 sampai 3/)
    expect(cek('001.0.01,Ruang').galat).toMatch(/lantai 1 sampai/)
    expect(cek('001.1.12,   ').galat).toMatch(/nama ruangan kosong/)
    expect(cek('001.1.12,Ruang', new Set(['001.1.12'])).galat).toMatch(/dua kali/)
  })
})
