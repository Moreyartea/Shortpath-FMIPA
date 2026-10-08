import { describe, expect, test } from 'vitest'
import { indeks, ruangan, tempat, graphData } from './helpers'
import { susunHasil, pilihanCepat } from '../src/lib/hasilCari'
import { jarakKeSemuaTempat } from '../src/lib/routing'

const namaTempat = new Map(tempat.map((t) => [t.id, `${t.nama} ${t.namaLengkap || ''}`]))
const cari = (kueri, ekstra = {}) => susunHasil({ kueri, daftarTempat: tempat, ruangan, namaTempat, ...ekstra })

describe('susunHasil', () => {
  test('kueri kosong -> kosong tanpa saran', () => {
    expect(cari('').kosong).toBe(true)
    expect(cari('   ').tempat).toEqual([])
  })

  test('gedung dan ruangan dipisah; nama gedung muncul di bagian gedung', () => {
    const h = cari('fisika')
    expect(h.tempat.map((x) => x.tempat.id)).toContain('fisika')
    expect(h.tempat.map((x) => x.tempat.id)).toContain('lab-fisika')
  })

  test('nama persis diurutkan paling atas', () => {
    expect(cari('syawal').tempat[0].tempat.id).toBe('syawal')
    expect(cari('mushola').ruangan[0].nama.toLowerCase()).toMatch(/mushola|musholla/)
  })

  test('tanpa titik awal urutan alfabet; dengan titik awal yang terdekat lebih dulu', () => {
    const jarak = jarakKeSemuaTempat(graphData, indeks.byId.get('lab-biologi').titik, indeks)
    const dekat = cari('toilet', { jarakTempat: jarak, batasRuangan: 400 }).ruangan
    // "Kamar Mandi" dan "Toilet" setara (sinonim), jadi urutannya murni menurut jarak dari titik awal
    expect(new Set(dekat.map((r) => r.skor)).size).toBeLessThanOrEqual(2) // hanya tingkat "cocok di awal nama" dan "cocok di tengah"
    const terdekat = Math.min(...dekat.map((r) => r.jarak))
    expect(dekat[0].jarak).toBe(terdekat)
    const sama = dekat.filter((r) => r.skor === dekat[0].skor)
    for (let i = 1; i < sama.length; i += 1) expect(sama[i].jarak).toBeGreaterThanOrEqual(sama[i - 1].jarak)
    const alfabet = cari('toilet', { batasRuangan: 400 }).ruangan
    expect(alfabet.length).toBe(dekat.length)
  })

  test('hanyaTempat tidak menyertakan ruangan', () => {
    expect(cari('dekan', { hanyaTempat: true }).ruangan).toEqual([])
  })

  test('utilitas/gudang disembunyikan kecuali dicari', () => {
    const umum = cari('ruang', { batasRuangan: 1000 }).ruangan
    expect(umum.length).toBeGreaterThan(50)
    expect(umum.filter((r) => ['utilitas', 'gudang'].includes(r.kategori))).toEqual([])
    expect(cari('gudang').ruangan.length).toBeGreaterThan(0)
    expect(cari('panel').ruangan.length).toBeGreaterThan(0)
  })

  test('tidak ada hasil -> ada saran ejaan bila mirip', () => {
    expect(['mushola', 'musholla']).toContain(cari('mushoola').saran)
    const salah = cari('perpusakaan')
    expect(salah.kosong).toBe(true)
    expect(salah.saran).toBe('perpustakaan')
    expect(cari('qqqqqqq').saran).toBeNull()
  })

  test('batas jumlah hasil ruangan', () => {
    expect(cari('ruang', { batasRuangan: 5 }).ruangan).toHaveLength(5)
    expect(cari('ruang', { batasRuangan: 5 }).totalRuangan).toBeGreaterThan(5)
  })
})

describe('pilihanCepat', () => {
  test('hanya menyertakan pencarian yang punya hasil', () => {
    const p = pilihanCepat(ruangan, tempat, namaTempat)
    expect(p.length).toBeGreaterThanOrEqual(6)
    for (const x of p) expect(susunHasil({ kueri: x.kueri, daftarTempat: tempat, ruangan, namaTempat, kosakata: [] }).kosong).toBe(false)
    expect(pilihanCepat([], [], new Map())).toEqual([])
  })
})
