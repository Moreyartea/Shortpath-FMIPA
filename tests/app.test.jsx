// @vitest-environment jsdom
// Uji alur pengguna pada aplikasi utuh. Peta Leaflet diganti tiruan sederhana (diperiksa terpisah di browser).
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { cleanup, render, screen, within, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { graphData, indeks, poligon, tempat } from './helpers'
import { findPlaceContainingPoint, findNearestPoint, JARAK_DI_KAMPUS_M } from '../src/lib/gps'

vi.mock('../src/lib/supabase', () => ({
  supabaseConfig: null,
  isSupabaseConfigured: () => false,
  getSession: () => null,
  listRooms: vi.fn().mockResolvedValue([]),
  signIn: vi.fn(),
  signOut: vi.fn(),
  insertRoom: vi.fn(),
  updateRoom: vi.fn(),
  deleteRoom: vi.fn(),
  bulkUpsertRooms: vi.fn(),
}))

vi.mock('../src/components/MapView', () => ({
  default: (p) => (
    <div data-testid="peta" data-garis={p.garisRute?.length ?? 0} data-pilih={p.pilihPeta || ''} data-tujuan={p.tujuan ?? ''} data-asal={p.asal?.titikId ?? ''} data-detail={p.terpilih ?? ''}>
      <button onClick={() => p.onPilihTempat('kimia')}>peta-kimia</button>
      <button onClick={() => p.onPilihTempat('fisika')}>peta-fisika</button>
    </div>
  ),
}))

import App from '../src/App'

const titik = (id) => graphData.pointsById[id]

function aturGps(hasil) {
  Object.defineProperty(navigator, 'geolocation', {
    configurable: true,
    value: { getCurrentPosition: (ok, gagal) => (hasil.galat ? gagal(hasil.galat) : ok({ coords: hasil.coords })) },
  })
}

beforeEach(() => {
  window.localStorage.setItem('fmipa_panduan_dilihat', '1')
  window.history.replaceState(null, '', '/')
  window.location.hash = ''
})
afterEach(() => {
  cleanup()
  delete navigator.geolocation
})

const hasilTempat = () => screen.getByRole('region', { name: 'Hasil gedung dan tempat' })
const hasilRuangan = () => screen.getByRole('region', { name: 'Hasil ruangan' })

async function pilihAsalGedung(u, nama) {
  await u.click(screen.getByRole('button', { name: /Cari gedung/ }))
  await u.type(screen.getByRole('searchbox', { name: /titik awal/i }), nama)
  await u.click(within(hasilTempat()).getByRole('button', { name: new RegExp(`^${nama}`) }))
}

describe('Alur utama', () => {
  test('cari tujuan, pilih titik awal, rute muncul otomatis tanpa tombol "cari"', async () => {
    const u = userEvent.setup()
    render(<App />)
    expect(screen.getByText('Mau ke mana?')).toBeTruthy()
    await u.type(screen.getByRole('searchbox', { name: /tujuan/i }), 'fisika')
    await u.click(within(hasilTempat()).getByRole('button', { name: /^Gedung Fisika/ }))
    expect(await screen.findByText('Dari mana kamu berangkat?')).toBeTruthy()
    expect(screen.getByText(/Pilih titik awal di atas untuk melihat rute/)).toBeTruthy()

    await pilihAsalGedung(u, 'Gedung Kimia')
    const kartu = await screen.findByRole('region', { name: 'Hasil rute' })
    expect(within(kartu).getByText(/berjalan kaki/)).toBeTruthy()
    expect(within(kartu).getByText(/Masuk lewat/)).toBeTruthy()
    const langkah = within(kartu).getByRole('list', { name: 'Langkah rute' })
    expect(within(langkah).getAllByRole('listitem').length).toBeGreaterThanOrEqual(2)
    expect(langkah.textContent).toMatch(/Mulai dari Gedung Kimia/)
    expect(langkah.textContent).not.toMatch(/Titik \d/)
    expect(Number(screen.getByTestId('peta').dataset.garis)).toBeGreaterThan(1)
  })

  test('Enter memilih hasil pertama; panah bawah memindahkan fokus ke daftar hasil', async () => {
    const u = userEvent.setup()
    render(<App />)
    const kotak = screen.getByRole('searchbox', { name: /tujuan/i })
    await u.type(kotak, 'toilet')
    await u.keyboard('{ArrowDown}')
    expect(document.activeElement.hasAttribute('data-hasil')).toBe(true)
    await u.keyboard('{ArrowUp}')
    expect(document.activeElement).toBe(kotak)
    await u.clear(kotak)
    await u.type(kotak, 'syawal{Enter}')
    expect(await screen.findByText('Dari mana kamu berangkat?')).toBeTruthy()
  })

  test('tujuan Syawal: memilih salah satu lobi sebagai pintu masuk', async () => {
    const u = userEvent.setup()
    render(<App />)
    await u.type(screen.getByRole('searchbox', { name: /tujuan/i }), 'syawal')
    await u.click(within(hasilTempat()).getByRole('button', { name: /^Gedung Syawal/ }))
    await pilihAsalGedung(u, 'Gedung Belajar Bersama')
    const kartu = await screen.findByRole('region', { name: 'Hasil rute' })
    expect(kartu.textContent).toMatch(/Masuk lewat: Lobi (Timur|Barat|Utara|Selatan) Gedung Syawal/)
  })

  test('asal sama dengan tujuan: pesan ramah, bukan galat', async () => {
    const u = userEvent.setup()
    render(<App />)
    await u.type(screen.getByRole('searchbox', { name: /tujuan/i }), 'kimia')
    await u.click(within(hasilTempat()).getByRole('button', { name: /^Gedung Kimia/ }))
    await pilihAsalGedung(u, 'Gedung Kimia')
    expect(await screen.findByText(/Kamu sudah di Gedung Kimia/)).toBeTruthy()
    expect(screen.queryByRole('alert')).toBeNull()
  })

  test('tukar arah menukar asal dan tujuan; ubah dan batal tidak menghapus pilihan', async () => {
    const u = userEvent.setup()
    render(<App />)
    await u.type(screen.getByRole('searchbox', { name: /tujuan/i }), 'fisika')
    await u.click(within(hasilTempat()).getByRole('button', { name: /^Gedung Fisika/ }))
    await pilihAsalGedung(u, 'Gedung Kimia')
    await screen.findByRole('region', { name: 'Hasil rute' })
    await u.click(screen.getByRole('button', { name: /Tukar arah/ }))
    expect(window.location.search).toBe('?dari=fisika&ke=kimia')
    const [ubahTujuan] = screen.getAllByRole('button', { name: 'Ubah' }).slice(0, 1)
    await u.click(ubahTujuan)
    expect(screen.getByRole('searchbox', { name: /tujuan/i })).toBeTruthy()
    await u.click(screen.getByRole('button', { name: 'Batal' }))
    expect(window.location.search).toBe('?dari=fisika&ke=kimia')
  })
})

describe('Ruangan', () => {
  test('mencari "pantry": hasil per gedung/lantai; memilih satu menampilkan info lantai dan catatan jujur', async () => {
    const u = userEvent.setup()
    render(<App />)
    await u.type(screen.getByRole('searchbox', { name: /tujuan/i }), 'pantry')
    expect(screen.queryByText(/Pilih titik awal dulu supaya yang paling dekat/)).toBeTruthy()
    const daftar = within(hasilRuangan()).getAllByRole('button')
    expect(daftar.length).toBeGreaterThan(2)
    expect(daftar.every((b) => /Lantai|lantai belum tercatat/.test(b.textContent))).toBe(true)
    await u.click(daftar[0])
    await pilihAsalGedung(u, 'Gedung Kimia')
    const kartu = await screen.findByRole('region', { name: 'Hasil rute' })
    expect(kartu.textContent).toMatch(/Rute berakhir di gedung/)
    expect(kartu.textContent).toMatch(/Pantry/)
  })

  test('ruangan pimpinan fakultas ditemukan walau lantainya belum tercatat', async () => {
    const u = userEvent.setup()
    render(<App />)
    await u.type(screen.getByRole('searchbox', { name: /tujuan/i }), 'dekan fmipa')
    const tombol = within(hasilRuangan()).getAllByRole('button')
    expect(tombol.some((b) => /lantai belum tercatat/.test(b.textContent) && /Syawal/.test(b.textContent))).toBe(true)
  })

  test('salah ketik: tampil saran dan saran bisa diketuk', async () => {
    const u = userEvent.setup()
    render(<App />)
    await u.type(screen.getByRole('searchbox', { name: /tujuan/i }), 'perpusakaan')
    expect(await screen.findByText(/Tidak ada hasil untuk/)).toBeTruthy()
    await u.click(screen.getByRole('button', { name: 'perpustakaan' }))
    expect(screen.queryByText(/Tidak ada hasil untuk/)).toBeNull()
  })

  test('tombol cari cepat mengisi pencarian', async () => {
    const u = userEvent.setup()
    render(<App />)
    await u.click(within(screen.getByRole('region', { name: 'Pencarian cepat' })).getByRole('button', { name: 'Toilet' }))
    expect(screen.getByRole('searchbox', { name: /tujuan/i }).value).toBe('toilet')
    expect(hasilRuangan()).toBeTruthy()
  })
})

describe('Lokasi saya (GPS)', () => {
  const sampai = async (u) => {
    await u.type(screen.getByRole('searchbox', { name: /tujuan/i }), 'matematika')
    await u.click(within(hasilTempat()).getByRole('button', { name: /^Gedung Matematika/ }))
  }

  test('lokasi di kampus: titik awal menjadi tempat terdekat dan rute dihitung', async () => {
    const u = userEvent.setup()
    const p = titik(1) // Gedung Fisika
    aturGps({ coords: { latitude: p.lat + 0.00002, longitude: p.lon, accuracy: 12 } })
    render(<App />)
    await sampai(u)
    await u.click(screen.getByRole('button', { name: /Gunakan lokasi saya/ }))
    expect(await screen.findByText(/Berada di area: Gedung Fisika/)).toBeTruthy()
    await screen.findByRole('region', { name: 'Hasil rute' })
    expect(screen.getByText(/Posisi GPS bisa meleset/)).toBeTruthy()
    expect(window.location.search).toBe('?ke=matematika') // lokasi pribadi tidak masuk tautan
  })

  test('GPS di dekat simpul persimpangan: tidak crash dan rute tetap dihitung', async () => {
    const u = userEvent.setup()

    // 1. Ambil simpul yang bukan pintu gedung (!indeks.byTitik.has(id))
    let simpulPersimpangan = null
    let titikUji = null
    let titikDekat = null
    let jarakDekat = 0

    for (const point of Object.values(graphData.pointsById)) {
      if (indeks.byTitik.has(point.id)) continue
      // Geser sedikit (sekitar 1 meter)
      const calon = { lat: point.lat + 0.00001, lon: point.lon }
      const diGedung = findPlaceContainingPoint(calon, poligon, tempat)
      if (diGedung !== null) continue
      const dekat = findNearestPoint(calon, graphData.pointsById)
      if (dekat && !indeks.byTitik.has(dekat.id) && dekat.distance < JARAK_DI_KAMPUS_M) {
        simpulPersimpangan = point
        titikUji = calon
        titikDekat = dekat
        jarakDekat = dekat.distance
        break
      }
    }

    expect(simpulPersimpangan).not.toBeNull()
    expect(findPlaceContainingPoint(titikUji, poligon, tempat)).toBeNull()
    expect(!indeks.byTitik.has(titikDekat.id)).toBe(true)
    expect(jarakDekat).toBeLessThan(JARAK_DI_KAMPUS_M)

    // 2. Render UI
    aturGps({ coords: { latitude: titikUji.lat, longitude: titikUji.lon, accuracy: 5 } })
    render(<App />)
    await sampai(u)
    await u.click(screen.getByRole('button', { name: /Gunakan lokasi saya/ }))

    // 3. Verifikasi teks fallback: "Di jalur antar gedung (±N m dari jalur terdekat)"
    const regexFallback = new RegExp(`Di jalur antar gedung \\(±${Math.round(jarakDekat)} m dari jalur terdekat\\)`)
    expect(await screen.findByText(regexFallback)).toBeTruthy()

    // 4. Verifikasi rute tetap dihitung tanpa crash
    await screen.findByRole('region', { name: 'Hasil rute' })
    expect(screen.getByText(/Posisi GPS bisa meleset/)).toBeTruthy()
  })

  test('lokasi jauh di luar kampus: tidak dipakai, pengguna diarahkan memilih manual', async () => {
    const u = userEvent.setup()
    aturGps({ coords: { latitude: 3.7, longitude: 98.8, accuracy: 10 } })
    render(<App />)
    await sampai(u)
    await u.click(screen.getByRole('button', { name: /Gunakan lokasi saya/ }))
    expect(await screen.findByText(/di luar kawasan FMIPA/)).toBeTruthy()
    expect(screen.queryByRole('region', { name: 'Hasil rute' })).toBeNull()
    expect(screen.getByRole('button', { name: /Cari gedung/ })).toBeTruthy()
  })

  test('izin ditolak: pesan jelas dan pilihan manual tetap tersedia', async () => {
    const u = userEvent.setup()
    aturGps({ galat: { code: 1, message: 'denied' } })
    render(<App />)
    await sampai(u)
    await u.click(screen.getByRole('button', { name: /Gunakan lokasi saya/ }))
    expect(await screen.findByText(/Izin lokasi ditolak/)).toBeTruthy()
    expect(screen.getByRole('button', { name: /Pilih di peta/ })).toBeTruthy()
  })
})

describe('Peta, jelajah, dan tautan', () => {
  test('mengetuk gedung di peta membuka rinciannya; "Rute ke sini" mengisi tujuan', async () => {
    const u = userEvent.setup()
    render(<App />)
    await u.click(screen.getByRole('button', { name: 'peta-fisika' }))
    expect(await screen.findByRole('article', { name: /Rincian Gedung Fisika/ })).toBeTruthy()
    expect(screen.getByText('Isi gedung per lantai')).toBeTruthy()
    expect(screen.getByText(/Tersambung langsung dengan/)).toBeTruthy()
    await u.click(screen.getByRole('button', { name: 'Rute ke sini' }))
    await waitFor(() => expect(window.location.search).toBe('?ke=fisika'))
    expect(screen.getByRole('tab', { name: 'Rute', selected: true })).toBeTruthy()
    expect(screen.getByText('Dari mana kamu berangkat?')).toBeTruthy()
  })

  test('mode "Pilih di peta" untuk titik awal', async () => {
    const u = userEvent.setup()
    render(<App />)
    await u.type(screen.getByRole('searchbox', { name: /tujuan/i }), 'fisika')
    await u.click(within(hasilTempat()).getByRole('button', { name: /^Gedung Fisika/ }))
    await u.click(await screen.findByRole('button', { name: /Pilih di peta/ }))
    expect(screen.getByTestId('peta').dataset.pilih).toBe('asal')
    await u.click(screen.getByRole('button', { name: 'peta-kimia' }))
    await screen.findByRole('region', { name: 'Hasil rute' })
    expect(window.location.search).toBe('?dari=kimia&ke=fisika')
    expect(screen.getByTestId('peta').dataset.pilih).toBe('')
  })

  test('tab Jelajahi menjelaskan susunan kawasan dan menyaring ruangan dalam gedung', async () => {
    const u = userEvent.setup()
    render(<App />)
    await u.click(screen.getByRole('tab', { name: 'Jelajahi gedung' }))
    const teks = (await screen.findByText(/berada di bagian tengah kawasan/)).textContent
    expect(teks).toMatch(/Empat gedung jurusan tersambung langsung/)
    expect(teks).toMatch(/Fisika \(barat laut\)/)
    expect(teks).toMatch(/Kimia \(barat daya\)/)
    await u.click(screen.getByRole('button', { name: /^Gedung Matematika/ }))
    await u.type(screen.getByRole('searchbox', { name: /Saring ruangan/ }), 'mushola')
    const panel = screen.getByRole('article', { name: /Matematika/ })
    expect(within(panel).queryAllByRole('button', { name: /mushola/i }).length).toBeGreaterThan(0)
    await u.click(within(panel).getAllByRole('button', { name: /mushola/i })[0])
    expect(await screen.findByText(/Mau ke mana|Dari mana kamu berangkat/)).toBeTruthy()
    expect(window.location.search).toMatch(/ke=matematika/)
  })

  test('membuka tautan yang dibagikan langsung menampilkan rute; tautan rusak diabaikan', async () => {
    window.history.replaceState(null, '', '/?dari=kimia&ke=fisika')
    render(<App />)
    expect(await screen.findByRole('region', { name: 'Hasil rute' })).toBeTruthy()
    cleanup()
    window.history.replaceState(null, '', '/?dari=tidak-ada&ke=juga-tidak')
    render(<App />)
    expect(screen.getByText('Mau ke mana?')).toBeTruthy()
    expect(screen.queryByRole('region', { name: 'Hasil rute' })).toBeNull()
  })

  test('bagikan rute menyalin tautan', async () => {
    const u = userEvent.setup()
    window.history.replaceState(null, '', '/?dari=kimia&ke=fisika')
    render(<App />)
    await screen.findByRole('region', { name: 'Hasil rute' })
    const tulis = vi.fn().mockResolvedValue()
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: tulis } })
    delete navigator.share
    await u.click(screen.getByRole('button', { name: /Bagikan rute/ }))
    expect(tulis).toHaveBeenCalledWith(expect.stringContaining('?dari=kimia&ke=fisika'))
    expect(await screen.findByText('Tautan disalin.')).toBeTruthy()
  })

  test('perbandingan algoritma untuk laporan: Dijkstra = A*, validasi Floyd-Warshall cocok', async () => {
    const u = userEvent.setup()
    window.history.replaceState(null, '', '/?dari=lab-biologi&ke=matematika')
    render(<App />)
    await screen.findByRole('region', { name: 'Hasil rute' })
    await u.click(screen.getByText(/Untuk laporan/))
    expect(await screen.findByText(/Validasi Floyd-Warshall pada 225 pasangan tempat: cocok semua/)).toBeTruthy()
    expect(screen.getByText(/Dijkstra \(utama\)/)).toBeTruthy()
  })
})

describe('Panduan dan halaman admin', () => {
  test('panduan muncul pada kunjungan pertama dan tidak muncul lagi setelah ditutup', async () => {
    window.localStorage.removeItem('fmipa_panduan_dilihat')
    const u = userEvent.setup()
    render(<App />)
    const dialog = screen.getByRole('dialog', { name: /Selamat datang/ })
    expect(dialog.textContent).toMatch(/Cari tujuanmu/)
    await u.click(within(dialog).getByRole('button', { name: 'Mulai' }))
    expect(screen.queryByRole('dialog')).toBeNull()
    cleanup()
    render(<App />)
    expect(screen.queryByRole('dialog')).toBeNull()
    await u.click(screen.getByRole('button', { name: /Buka panduan/ }))
    expect(screen.getByRole('dialog')).toBeTruthy()
    await u.keyboard('{Escape}')
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  })

  test('halaman admin tanpa Supabase menjelaskan cara mengaktifkannya', async () => {
    window.location.hash = '#/admin'
    render(<App />)
    expect(await screen.findByText(/membutuhkan Supabase/)).toBeTruthy()
  })
})
