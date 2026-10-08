import { useRef } from 'react'
import HasilPencarian from './HasilPencarian'
import { IkonCari, IkonKembali, IkonLokasi, IkonPeta, IkonTukar } from './Ikon'
import { kapital, teksLantai } from '../lib/format'

const inputKelas = 'w-full rounded-xl border border-slate-300 bg-white py-3 pl-10 pr-3 text-base text-slate-900 placeholder:text-slate-500 focus:border-sky-600'

function KotakCari({ id, label, nilai, onUbah, placeholder, onEnter, autoFokus }) {
  return (
    <div className="relative">
      <label htmlFor={id} className="sr-only">{label}</label>
      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-600"><IkonCari /></span>
      <input
        id={id}
        type="search"
        autoComplete="off"
        autoCapitalize="off"
        spellCheck="false"
        enterKeyHint="search"
        autoFocus={autoFokus}
        value={nilai}
        placeholder={placeholder}
        onChange={(e) => onUbah(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') onEnter()
          if (e.key === 'ArrowDown') {
            const pertama = e.currentTarget.closest('section')?.querySelector('[data-hasil]')
            if (pertama) {
              e.preventDefault()
              pertama.focus()
            }
          }
        }}
        className={inputKelas}
      />
    </div>
  )
}

function KartuPilihan({ judul, utama, tambahan, onUbah, warna, onTukar }) {
  return (
    <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white py-2 pl-3 pr-1.5">
      <span className={`flex h-7 w-7 flex-none items-center justify-center rounded-full text-xs font-bold text-white ${warna}`}>{judul}</span>
      <span className="min-w-0 flex-1">
        <span className="block truncate font-semibold text-slate-900">{utama}</span>
        {tambahan && <span className="block text-xs text-slate-600">{tambahan}</span>}
      </span>
      {onTukar && (
        <button type="button" onClick={onTukar} aria-label="Tukar arah" title="Tukar arah" className="rounded-lg p-2 text-sky-800 hover:bg-sky-50">
          <IkonTukar ukuran={18} />
        </button>
      )}
      <button type="button" onClick={onUbah} className="rounded-lg px-2.5 py-1.5 text-sm font-semibold text-sky-800 hover:bg-sky-50">
        Ubah
      </button>
    </div>
  )
}

export default function FormRute({
  tujuan, asal, bukaTujuan, bukaAsal, modeAsal, setModeAsal,
  kueriTujuan, setKueriTujuan, kueriAsal, setKueriAsal,
  hasilTujuan, hasilAsal, namaTempat, adaJarak,
  onPilihTujuanTempat, onPilihTujuanRuangan, onPilihAsalTempat,
  onUbahTujuan, onBatalUbahTujuan, onUbahAsal, onBatalUbahAsal, onGps, statusGps, onPilihDiPeta, onTukar,
}) {
  const refAsal = useRef(null)
  const pilihPertama = (hasil, pilihTempat, pilihRuangan) => () => {
    if (hasil.tempat[0]) pilihTempat(hasil.tempat[0].tempat)
    else if (hasil.ruangan[0] && pilihRuangan) pilihRuangan(hasil.ruangan[0])
  }

  const tampilTujuan = Boolean(tujuan) && !bukaTujuan
  const tampilAsal = Boolean(asal) && !bukaAsal

  return (
    <section aria-label="Pilih tujuan dan titik awal" className="space-y-3">
      {/* ---- TUJUAN ---- */}
      <div className="space-y-2">
        {tampilTujuan ? (
          <KartuPilihan
            judul="B"
            warna="bg-red-600"
            utama={tujuan.ruangan ? tujuan.ruangan.nama : tujuan.tempat.nama}
            tambahan={tujuan.ruangan ? `${tujuan.tempat.nama} · ${teksLantai(tujuan.ruangan.lantai)}` : 'Tujuan'}
            onUbah={onUbahTujuan}
          />
        ) : (
          <>
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-900">Mau ke mana?</h2>
              {tujuan && <button type="button" onClick={onBatalUbahTujuan} className="rounded-lg px-2.5 py-1.5 text-sm font-semibold text-sky-800 hover:bg-sky-50">Batal</button>}
            </div>
            <KotakCari
              id="cari-tujuan"
              label="Cari gedung atau ruangan tujuan"
              nilai={kueriTujuan}
              onUbah={setKueriTujuan}
              placeholder="Cari gedung atau ruangan"
              onEnter={pilihPertama(hasilTujuan, onPilihTujuanTempat, onPilihTujuanRuangan)}
            />
            <HasilPencarian
              hasil={hasilTujuan}
              kueri={kueriTujuan}
              namaTempat={namaTempat}
              denganJarak={adaJarak}
              onPilihTempat={onPilihTujuanTempat}
              onPilihRuangan={onPilihTujuanRuangan}
              onSaran={setKueriTujuan}
            />
          </>
        )}
      </div>

      {/* ---- TITIK AWAL ---- */}
      <div className="space-y-2">
        {tampilAsal ? (
          <KartuPilihan
            judul="A"
            warna="bg-green-600"
            utama={asal.jenis === 'gps' ? 'Lokasi saya' : asal.tempat.nama}
            tambahan={asal.jenis === 'gps' ? (asal.berdasarkanArea ? `Berada di area: ${asal.tempat.nama}` : `Terdekat dari jalur: ${asal.tempat.nama} (±${Math.round(asal.jarak)} m)`) : 'Titik awal'}
            onUbah={onUbahAsal}
            onTukar={tampilTujuan && asal.jenis === 'tempat' ? onTukar : undefined}
          />
        ) : (
          <>
            <div className="flex items-center justify-between">
              {tujuan && !bukaTujuan ? <h2 className="text-lg font-bold text-slate-900">Dari mana kamu berangkat?</h2> : <h2 className="text-sm font-semibold text-slate-700">Titik awal (boleh diisi nanti)</h2>}
              {asal && <button type="button" onClick={onBatalUbahAsal} className="rounded-lg px-2.5 py-1.5 text-sm font-semibold text-sky-800 hover:bg-sky-50">Batal</button>}
            </div>
            {modeAsal === 'cari' ? (
              <>
                <button type="button" onClick={() => setModeAsal('menu')} className="inline-flex items-center gap-1 text-sm font-semibold text-sky-800">
                  <IkonKembali ukuran={16} /> Pilihan lain
                </button>
                <div ref={refAsal}>
                  <KotakCari
                    id="cari-asal"
                    label="Cari gedung untuk titik awal"
                    nilai={kueriAsal}
                    onUbah={setKueriAsal}
                    placeholder="Cari gedung terdekat darimu"
                    onEnter={pilihPertama(hasilAsal, onPilihAsalTempat)}
                    autoFokus
                  />
                </div>
                <HasilPencarian hasil={hasilAsal} kueri={kueriAsal} namaTempat={namaTempat} onPilihTempat={onPilihAsalTempat} onPilihRuangan={() => {}} onSaran={setKueriAsal} />
                {!kueriAsal.trim() && (
                  <p className="text-sm text-slate-700">Lihat sekelilingmu, lalu ketik nama gedung yang paling dekat, misalnya &ldquo;Fisika&rdquo; atau &ldquo;Syawal&rdquo;.</p>
                )}
              </>
            ) : (
              <div className="grid gap-2">
                <button type="button" onClick={onGps} className="flex items-center gap-3 rounded-xl border border-slate-300 bg-white px-3 py-3 text-left hover:border-sky-500 hover:bg-sky-50">
                  <span className="text-sky-800"><IkonLokasi /></span>
                  <span>
                    <span className="block font-semibold text-slate-900">Gunakan lokasi saya</span>
                    <span className="block text-xs text-slate-600">Paling cepat jika kamu sudah di kampus</span>
                  </span>
                </button>
                <button type="button" onClick={() => setModeAsal('cari')} className="flex items-center gap-3 rounded-xl border border-slate-300 bg-white px-3 py-3 text-left hover:border-sky-500 hover:bg-sky-50">
                  <span className="text-sky-800"><IkonCari /></span>
                  <span>
                    <span className="block font-semibold text-slate-900">Cari gedung</span>
                    <span className="block text-xs text-slate-600">Ketik nama gedung di dekatmu</span>
                  </span>
                </button>
                <button type="button" onClick={onPilihDiPeta} className="flex items-center gap-3 rounded-xl border border-slate-300 bg-white px-3 py-3 text-left hover:border-sky-500 hover:bg-sky-50">
                  <span className="text-sky-800"><IkonPeta /></span>
                  <span>
                    <span className="block font-semibold text-slate-900">Pilih di peta</span>
                    <span className="block text-xs text-slate-600">Ketuk gedung pada peta</span>
                  </span>
                </button>
              </div>
            )}
          </>
        )}
        {statusGps.pesan && (
          <p role="status" className={`rounded-lg px-3 py-2 text-sm ${statusGps.jenis === 'galat' ? 'bg-amber-50 text-amber-900' : 'bg-sky-50 text-sky-900'}`}>
            {statusGps.pesan}
          </p>
        )}
      </div>

      <span className="sr-only" aria-live="polite">{tujuan ? `Tujuan: ${kapital(tujuan.tempat.nama)}` : ''}</span>
    </section>
  )
}
