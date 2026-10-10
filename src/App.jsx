import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { batas, bentuk, edges, graphData, indeks, poligon, tempat } from './data'
import { useRuangan } from './hooks/useRuangan'
import { findNearestPoint, findNearestPointForPlace, findPlaceContainingPoint, getCurrentPosition, JARAK_DI_KAMPUS_M, pesanGalatGps } from './lib/gps'
import { susunHasil, pilihanCepat } from './lib/hasilCari'
import { bangunKosakata } from './lib/search'
import { geometriRute, hitungRute, jarakKeSemuaTempat, langkahRute } from './lib/routing'
import { cariRuanganDariKunci, kunciRuangan } from './lib/rooms'
import { ringkasOrientasi } from './lib/places'
import { bacaUrl, tulisUrl } from './lib/urlState'
import DetailTempat from './components/DetailTempat'
import FormRute from './components/FormRute'
import { IkonBantuan, IkonBawah } from './components/Ikon'
import Jelajahi from './components/Jelajahi'
import KartuRute from './components/KartuRute'
import MapView from './components/MapView'
import Panduan from './components/Panduan'
import { ruanganLokal } from './data'

const AdminPage = lazy(() => import('./components/AdminPage'))
const KUNCI_PANDUAN = 'fmipa_panduan_dilihat'
const TINGGI_PANEL = { min: 'h-[12rem]', mid: 'h-[56dvh]', max: 'h-[90dvh]' }
const URUTAN_PANEL = ['min', 'mid', 'max']

const namaCari = new Map(tempat.map((t) => [t.id, `${t.nama} ${t.namaLengkap || ''}`]))
const namaTampil = new Map(tempat.map((t) => [t.id, t.nama]))
const orientasi = ringkasOrientasi(indeks, graphData.graph)
const STATUS_GPS_KOSONG = { jenis: '', pesan: '' }

function pernahMelihatPanduan() {
  try {
    return window.localStorage.getItem(KUNCI_PANDUAN) === '1'
  } catch {
    return true
  }
}

function keadaanAwal() {
  const url = bacaUrl(window.location.search)
  const dari = indeks.byId.has(url.dari) ? url.dari : ''
  const ke = indeks.byId.has(url.ke) ? url.ke : ''
  const ruang = ke && url.ruang ? cariRuanganDariKunci(ruanganLokal, url.ruang) : null
  return { dari, ke, ruang: ruang && ruang.tempatId === ke ? ruang : null }
}

function Peta() {
  const [awal] = useState(keadaanAwal)
  const { ruangan: daftarRuangan, sumber, galat: galatData } = useRuangan()

  const [tab, setTab] = useState('rute')
  const [detail, setDetail] = useState(null)
  const [dari, setDari] = useState(awal.dari)
  const [asalGps, setAsalGps] = useState(null)
  const [posisiPengguna, setPosisiPengguna] = useState(null)
  const [ke, setKe] = useState(awal.ke)
  const [ruanganTujuan, setRuanganTujuan] = useState(awal.ruang)
  const [ruanganAsal, setRuanganAsal] = useState(null)
  const [kueriTujuan, setKueriTujuan] = useState('')
  const [kueriAsal, setKueriAsal] = useState('')
  const [bukaTujuan, setBukaTujuan] = useState(false)
  const [bukaAsal, setBukaAsal] = useState(false)
  const [modeAsal, setModeAsal] = useState('menu')
  const [statusGps, setStatusGps] = useState(STATUS_GPS_KOSONG)
  const [pilihPeta, setPilihPeta] = useState(null)
  const [panel, setPanel] = useState('mid')
  const [tampilJalur, setTampilJalur] = useState(false)
  const [panduan, setPanduan] = useState(() => !pernahMelihatPanduan())
  const [pesanBagikan, setPesanBagikan] = useState('')
  const awalSentuh = useRef(null)

  // ---------- turunan ----------
  const kosakata = useMemo(() => bangunKosakata(daftarRuangan, tempat), [daftarRuangan])
  const cepat = useMemo(() => pilihanCepat(daftarRuangan, tempat, namaCari), [daftarRuangan])

  const asal = useMemo(() => {
    if (asalGps) return { ...asalGps, jenis: 'gps', tempat: indeks.byTitik.get(asalGps.titikId) || null }
    if (dari) return { jenis: 'tempat', tempat: indeks.byId.get(dari), ruangan: ruanganAsal }
    return null
  }, [asalGps, dari, ruanganAsal])
  const tujuan = useMemo(() => (ke ? { tempat: indeks.byId.get(ke), ruangan: ruanganTujuan } : null), [ke, ruanganTujuan])
  const titikAsal = useMemo(() => (asalGps ? [asalGps.titikId] : dari ? indeks.byId.get(dari).titik : []), [asalGps, dari])

  const rute = useMemo(() => (titikAsal.length && tujuan ? hitungRute(graphData, titikAsal, tujuan.tempat.titik) : null), [titikAsal, tujuan])
  const garisRute = useMemo(() => (rute?.found ? geometriRute(rute, edges, graphData.pointsById) : null), [rute])
  const langkah = useMemo(() => (rute?.found ? langkahRute(rute, indeks, graphData, { edges, poligon, tempat }) : []), [rute])
  const jarakTempat = useMemo(() => jarakKeSemuaTempat(graphData, titikAsal, indeks), [titikAsal])

  const hasilTujuan = useMemo(
    () => susunHasil({ kueri: kueriTujuan, daftarTempat: tempat, ruangan: daftarRuangan, namaTempat: namaCari, jarakTempat, kosakata }),
    [kueriTujuan, daftarRuangan, jarakTempat, kosakata]
  )
  const hasilAsal = useMemo(
    () => susunHasil({ kueri: kueriAsal, daftarTempat: tempat, ruangan: daftarRuangan, namaTempat: namaCari, hanyaTempat: false, kosakata }),
    [kueriAsal, daftarRuangan, kosakata]
  )

  // ---------- alamat halaman (bisa dibagikan) ----------
  useEffect(() => {
    const s = tulisUrl({ dari, ke, ruang: ruanganTujuan ? kunciRuangan(ruanganTujuan) : '' })
    if (s !== window.location.search) window.history.replaceState(null, '', `${window.location.pathname}${s}${window.location.hash}`)
  }, [dari, ke, ruanganTujuan])

  // ---------- aksi ----------
  const geserPanel = useCallback((arah) => {
    setPanel((p) => URUTAN_PANEL[Math.min(2, Math.max(0, URUTAN_PANEL.indexOf(p) + arah))])
  }, [])

  const tutupPanduan = useCallback(() => {
    try {
      window.localStorage.setItem(KUNCI_PANDUAN, '1')
    } catch {
      /* penyimpanan tidak tersedia: panduan akan muncul lagi, tidak apa-apa */
    }
    setPanduan(false)
  }, [])

  const setTujuanTempat = (id, ruang = null) => {
    setKe(id)
    setRuanganTujuan(ruang)
    setKueriTujuan('')
    setBukaTujuan(false)
    setPesanBagikan('')
    setTab('rute')
    setDetail(null)
    setPanel('mid')
  }
  const setAsalTempat = (id, ruang = null) => {
    setDari(id)
    setRuanganAsal(ruang)
    setAsalGps(null)
    setKueriAsal('')
    setBukaAsal(false)
    setModeAsal('menu')
    setStatusGps(STATUS_GPS_KOSONG)
    setPesanBagikan('')
    setTab('rute')
    setDetail(null)
    setPanel('mid')
  }

  const pakaiGps = async () => {
    setStatusGps({ jenis: 'info', pesan: 'Mencari lokasimu…' })
    try {
      const pos = await getCurrentPosition()
      const lokasi = { lat: pos.coords.latitude, lon: pos.coords.longitude }
      const akurasi = pos.coords.accuracy || 0
      const tempatGps = findPlaceContainingPoint(lokasi, poligon, tempat)
      const titikTempat = tempatGps ? findNearestPointForPlace(lokasi, tempatGps, graphData.pointsById) : null
      const dekat = titikTempat || findNearestPoint(lokasi, graphData.pointsById)
      setPosisiPengguna({ ...lokasi, akurasi })
      if (!dekat || dekat.distance > JARAK_DI_KAMPUS_M) {
        setStatusGps({ jenis: 'galat', pesan: `Lokasimu sekitar ${Math.round(dekat?.distance ?? 0)} m dari jalur terdekat, sepertinya di luar kawasan FMIPA. Pilih titik awal secara manual.` })
        setModeAsal('menu')
        return
      }
      setAsalGps({
        ...lokasi,
        akurasi,
        titikId: dekat.id,
        jarak: dekat.distance,
        berdasarkanArea: Boolean(tempatGps),
      })
      setRuanganAsal(null)
      setDari('')
      setBukaAsal(false)
      setStatusGps({ jenis: 'info', pesan: akurasi > 50 ? 'Akurasi GPS rendah, posisimu bisa meleset. Jika ragu, pilih gedung terdekat secara manual.' : '' })
      setPanel('mid')
    } catch (e) {
      setStatusGps({ jenis: 'galat', pesan: pesanGalatGps(e) })
      setModeAsal('menu')
    }
  }

  const tukar = () => {
    if (!dari || !ke) return
    const prevDari = dari
    const prevKe = ke
    const prevRuanganAsal = ruanganAsal
    const prevRuanganTujuan = ruanganTujuan
    setDari(prevKe)
    setKe(prevDari)
    setRuanganAsal(prevRuanganTujuan)
    setRuanganTujuan(prevRuanganAsal)
  }

  const bagikan = async () => {
    const url = `${window.location.origin}${window.location.pathname}${tulisUrl({ dari, ke, ruang: ruanganTujuan ? kunciRuangan(ruanganTujuan) : '' })}`
    try {
      if (navigator.share) {
        await navigator.share({ title: 'Rute di FMIPA Unimed', text: `Rute ke ${tujuan.tempat.nama}`, url })
        return
      }
      await navigator.clipboard.writeText(url)
      setPesanBagikan('Tautan disalin.')
    } catch (e) {
      if (e?.name !== 'AbortError') setPesanBagikan('Tidak bisa menyalin otomatis. Salin tautan dari bilah alamat browser.')
    }
  }

  const klikPeta = (id) => {
    if (pilihPeta === 'asal') {
      setPilihPeta(null)
      setAsalTempat(id)
    } else if (pilihPeta === 'tujuan') {
      setPilihPeta(null)
      setTujuanTempat(id)
    } else {
      setDetail(id)
      setTab('jelajah')
      setPanel('mid')
    }
  }

  const mulaiPilihDiPeta = (mode) => {
    setPilihPeta(mode)
    setPanel('min')
  }

  const kunciRuteAtur = rute?.found ? `${rute.startId}-${rute.targetId}` : asalGps ? 'gps' : 'kosong'
  const tempatDetail = detail ? indeks.byId.get(detail) : null

  const mulaiSentuh = (e) => { awalSentuh.current = e.touches[0].clientY }
  const akhirSentuh = (e) => {
    if (awalSentuh.current === null) return
    const dy = e.changedTouches[0].clientY - awalSentuh.current
    awalSentuh.current = null
    if (dy < -40) geserPanel(1)
    else if (dy > 40) geserPanel(-1)
  }

  return (
    <div className="flex h-dvh flex-col md:flex-row">
      <aside
        aria-label="Panel pencarian dan rute"
        className={`order-2 flex w-full flex-none flex-col rounded-t-2xl bg-white shadow-[0_-4px_16px_rgba(0,0,0,0.18)] transition-[height] duration-300 md:order-1 md:h-full md:w-[26rem] md:rounded-none md:shadow-xl ${TINGGI_PANEL[panel]}`}
        onFocusCapture={(e) => e.target.tagName === 'INPUT' && setPanel('max')}
      >
        <button type="button" className="flex-none px-4 pb-1 pt-2 md:hidden" onClick={() => geserPanel(panel === 'max' ? -2 : 1)} onTouchStart={mulaiSentuh} onTouchEnd={akhirSentuh} aria-label={panel === 'max' ? 'Perkecil panel' : 'Perbesar panel'}>
          <span className="mx-auto block h-1.5 w-12 rounded-full bg-slate-300" />
        </button>

        <header className="flex flex-none items-center justify-between gap-2 px-4 pb-2 pt-1 md:pt-4">
          <div>
            <h1 className="text-lg font-bold leading-tight text-slate-900">Peta FMIPA Unimed</h1>
            <p className="hidden text-xs text-slate-600 sm:block">Cari gedung dan ruangan, lihat rute jalan kaki</p>
          </div>
          <button type="button" onClick={() => setPanduan(true)} className="inline-flex flex-none items-center gap-1.5 whitespace-nowrap rounded-lg px-2.5 py-2 text-sm font-semibold text-sky-800 hover:bg-sky-50" aria-label="Buka panduan cara pakai">
            <IkonBantuan ukuran={18} /> <span>Cara pakai</span>
          </button>
        </header>

        <div role="tablist" aria-label="Menu utama" className="flex flex-none gap-1 border-b border-slate-200 px-4">
          {[['rute', 'Rute'], ['jelajah', 'Jelajahi gedung']].map(([id, label]) => (
            <button key={id} role="tab" type="button" id={`tab-${id}`} aria-selected={tab === id} aria-controls={`isi-${id}`} onClick={() => { setTab(id); setDetail(null) }} className={`-mb-px border-b-2 px-3 py-2.5 text-sm font-semibold ${tab === id ? 'border-sky-800 text-sky-900' : 'border-transparent text-slate-600 hover:text-slate-900'}`}>
              {label}
            </button>
          ))}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-8 pt-4" role="tabpanel" id={`isi-${tab}`} aria-labelledby={`tab-${tab}`}>
          {tab === 'rute' && (
            <div className="space-y-5">
              {galatData && <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">Data ruangan terbaru belum bisa dimuat ({galatData}). Yang tampil adalah data bawaan.</p>}
              <FormRute
                tujuan={tujuan}
                asal={asal}
                bukaTujuan={bukaTujuan}
                bukaAsal={bukaAsal}
                modeAsal={modeAsal}
                setModeAsal={setModeAsal}
                kueriTujuan={kueriTujuan}
                setKueriTujuan={setKueriTujuan}
                kueriAsal={kueriAsal}
                setKueriAsal={setKueriAsal}
                hasilTujuan={hasilTujuan}
                hasilAsal={hasilAsal}
                namaTempat={namaTampil}
                adaJarak={titikAsal.length > 0}
                onPilihTujuanTempat={(t) => setTujuanTempat(t.id)}
                onPilihTujuanRuangan={(r) => setTujuanTempat(r.tempatId, r)}
                onPilihAsalTempat={(t) => setAsalTempat(t.id)}
                onPilihAsalRuangan={(r) => setAsalTempat(r.tempatId, r)}
                onUbahTujuan={() => { setBukaTujuan(true); setKueriTujuan('') }}
                onBatalUbahTujuan={() => { setBukaTujuan(false); setKueriTujuan('') }}
                onUbahAsal={() => { setBukaAsal(true); setModeAsal('menu') }}
                onBatalUbahAsal={() => { setBukaAsal(false); setKueriAsal('') }}
                onGps={pakaiGps}
                statusGps={statusGps}
                onPilihDiPeta={() => mulaiPilihDiPeta('asal')}
                onTukar={tukar}
              />

              {!tujuan && !kueriTujuan.trim() && (
                <section aria-label="Pencarian cepat" className="space-y-3">
                  {cepat.length > 0 && (
                    <div>
                      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-600">Cari cepat</h3>
                      <div className="flex flex-wrap gap-2">
                        {cepat.map((p) => (
                          <button key={p.kueri} type="button" onClick={() => setKueriTujuan(p.kueri)} className="rounded-full border border-slate-300 bg-white px-3.5 py-2 text-sm font-semibold text-slate-900 hover:border-sky-500 hover:bg-sky-50">
                            {p.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                  <button type="button" onClick={() => setTab('jelajah')} className="flex w-full items-center justify-between rounded-xl bg-sky-50 px-4 py-3 text-left text-sky-950 hover:bg-sky-100">
                    <span>
                      <span className="block font-semibold">Baru di FMIPA?</span>
                      <span className="block text-sm">Kenali gedung-gedungnya dan apa saja isinya.</span>
                    </span>
                    <IkonBawah ukuran={20} className="-rotate-90" />
                  </button>
                </section>
              )}

              {tujuan && !asal && (
                <p className="rounded-xl bg-sky-50 px-4 py-3 text-sm text-sky-950">Pilih titik awal di atas untuk melihat rute ke <b>{tujuan.tempat.nama}</b>.</p>
              )}

              {rute && tujuan && asal && !bukaTujuan && (
                <KartuRute rute={rute} langkah={langkah} tujuan={tujuan} asal={asal} indeks={indeks} graphData={graphData} onBagikan={bagikan} pesanBagikan={pesanBagikan} />
              )}
            </div>
          )}

          {tab === 'jelajah' && (
            tempatDetail ? (
              <DetailTempat
                tempat={tempatDetail}
                indeks={indeks}
                graph={graphData.graph}
                ruangan={daftarRuangan}
                onKembali={() => setDetail(null)}
                onBuka={setDetail}
                onRuteKe={(id) => setTujuanTempat(id)}
                onRuteDari={(id) => setAsalTempat(id)}
                onPilihRuangan={(r) => r.tempatId && setTujuanTempat(r.tempatId, r)}
              />
            ) : (
              <Jelajahi
                orientasi={orientasi}
                indeks={indeks}
                ruangan={daftarRuangan}
                pilihanCepat={cepat}
                onBuka={setDetail}
                onCari={(q) => { setTab('rute'); setKueriTujuan(q); setBukaTujuan(true) }}
              />
            )
          )}

          <footer className="mt-8 space-y-2 border-t border-slate-200 pt-4 text-xs text-slate-600">
            <label className="flex items-center justify-between gap-2 cursor-pointer rounded-lg bg-slate-50 p-2 text-slate-700 hover:bg-slate-100">
              <span className="font-semibold">Tampilkan seluruh rute di peta</span>
              <input
                type="checkbox"
                checked={tampilJalur}
                onChange={(e) => setTampilJalur(e.target.checked)}
                className="h-4 w-4 rounded accent-sky-700 cursor-pointer"
              />
            </label>
            <p>
              Peta jalur digambar manual dan perkiraan jarak bisa berbeda di lapangan. Data ruangan: {sumber === 'supabase' ? 'database kampus' : 'berkas bawaan'}.
            </p>
            <p><a href="#/admin" className="underline">Masuk admin</a></p>
          </footer>
        </div>
      </aside>

      <main className="relative order-1 min-h-0 flex-1 md:order-2" aria-label="Peta">
        <MapView
          bentuk={bentuk}
          batas={batas}
          edges={edges}
          pointsById={graphData.pointsById}
          tampilJalur={tampilJalur}
          onToggleJalur={() => setTampilJalur((v) => !v)}
          garisRute={garisRute}
          kunciRute={kunciRuteAtur}
          asal={asal && { ...asal, titikId: rute?.found ? rute.startId : titikAsal[0], tempatId: asal.tempat?.id }}
          tujuan={rute?.found ? rute.targetId : null}
          tujuanTempatId={rute?.found ? ke : null}
          terpilih={tempatDetail?.id}
          posisiPengguna={posisiPengguna}
          pilihPeta={pilihPeta}
          onPilihTempat={klikPeta}
          onBatalPilih={() => { setPilihPeta(null); setPanel('mid') }}
        />
      </main>

      {panduan && <Panduan onTutup={tutupPanduan} onJelajahi={() => { tutupPanduan(); setTab('jelajah') }} />}
    </div>
  )
}

function useHash() {
  const [hash, setHash] = useState(() => window.location.hash)
  useEffect(() => {
    const ubah = () => setHash(window.location.hash)
    window.addEventListener('hashchange', ubah)
    return () => window.removeEventListener('hashchange', ubah)
  }, [])
  return hash
}

export default function App() {
  const hash = useHash()
  if (hash.startsWith('#/admin')) {
    return (
      <Suspense fallback={<p className="p-6 text-slate-700">Memuat halaman admin…</p>}>
        <AdminPage />
      </Suspense>
    )
  }
  return <Peta />
}
