import { useState } from 'react'
import { IkonBagikan, IkonInfo } from './Ikon'
import { formatJarak, KECEPATAN_JALAN, teksLantai, teksMenit } from '../lib/format'
import { validasiSemuaTempat } from '../lib/routing'
import { namaTitik } from '../lib/places'

function Perbandingan({ rute, graphData, indeks }) {
  const [validasi, setValidasi] = useState(null)
  const p = rute.perbandingan
  return (
    <details className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-800" onToggle={(e) => e.currentTarget.open && !validasi && setValidasi(validasiSemuaTempat(graphData, indeks))}>
      <summary className="cursor-pointer font-semibold">Untuk laporan: bandingkan algoritma</summary>
      <table className="mt-3 w-full text-left text-xs">
        <thead className="text-slate-600">
          <tr><th className="py-1 pr-2 font-semibold">Algoritma</th><th className="py-1 pr-2 font-semibold">Jarak</th><th className="py-1 pr-2 font-semibold">Titik diperiksa</th><th className="py-1 font-semibold">Waktu</th></tr>
        </thead>
        <tbody>
          {[['Dijkstra (utama)', p.dijkstra], ['A* (pembanding)', p.aStar]].map(([nama, x]) => (
            <tr key={nama} className="border-t border-slate-200">
              <td className="py-1.5 pr-2">{nama}</td>
              <td className="py-1.5 pr-2">{x.distance.toFixed(2)} m</td>
              <td className="py-1.5 pr-2">{x.visitedCount}</td>
              <td className="py-1.5">{x.ms.toFixed(3)} ms</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-2 text-xs text-slate-700">Selisih jarak kedua algoritma: {p.selisih.toFixed(3)} m.</p>
      {validasi && (
        <p className={`mt-1 text-xs font-semibold ${validasi.valid ? 'text-green-800' : 'text-red-700'}`}>
          Validasi Floyd-Warshall pada {validasi.pasangan} pasangan tempat: {validasi.valid ? 'cocok semua' : `ada selisih ${validasi.selisihMaks.toFixed(3)} m`}.
        </p>
      )}
    </details>
  )
}

export default function KartuRute({ rute, langkah, tujuan, asal, indeks, graphData, onBagikan, pesanBagikan }) {
  if (!rute.found) {
    return (
      <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-900">
        <p className="font-semibold">Rute tidak ditemukan</p>
        <p className="mt-1">Kedua tempat ini tidak tersambung pada data jalur. Jika menurutmu keduanya bisa dilalui, laporkan ke admin peta.</p>
      </div>
    )
  }

  const sama = rute.path.length === 1
  const masuk = namaTitik(indeks, rute.targetId)
  const namaTujuan = tujuan.tempat.nama

  return (
    <section aria-label="Hasil rute" className="space-y-4">
      <div role="status" aria-live="polite" className="rounded-2xl bg-sky-900 p-4 text-white">
        {sama ? (
          <>
            <p className="text-lg font-bold">Kamu sudah di {namaTujuan}</p>
            <p className="mt-1 text-sm text-sky-100">Titik awal dan tujuan berada di tempat yang sama.</p>
          </>
        ) : (
          <>
            <p className="text-3xl font-bold">{formatJarak(rute.distance)}</p>
            <p className="text-sky-100">{teksMenit(rute.distance)} berjalan kaki</p>
            <p className="mt-2 text-sm text-sky-50">Masuk lewat: <b>{masuk}</b></p>
          </>
        )}
      </div>

      {tujuan.ruangan && (
        <div className="rounded-xl border border-teal-200 bg-teal-50 p-3 text-sm text-teal-950">
          <p className="font-semibold">{tujuan.ruangan.nama}</p>
          <p>{namaTujuan} · {teksLantai(tujuan.ruangan.lantai)}{tujuan.ruangan.kodeTampil ? ` · kode ${tujuan.ruangan.kodeTampil}` : ''}</p>
          <p className="mt-1 flex gap-1.5 text-teal-900"><span className="mt-0.5 flex-none"><IkonInfo ukuran={16} /></span>Rute berakhir di gedung. Setelah masuk, ikuti papan petunjuk lantai menuju ruangan.</p>
        </div>
      )}

      {!sama && (
        <ol className="space-y-2" aria-label="Langkah rute">
          {langkah.map((l, i) => (
            <li key={`${l.titikId}-${i}`} className="flex gap-3">
              <span className={`mt-0.5 flex h-6 w-6 flex-none items-center justify-center rounded-full text-xs font-bold text-white ${l.jenis === 'mulai' ? 'bg-green-600' : l.jenis === 'tiba' ? 'bg-red-600' : 'bg-slate-500'}`}>
                {l.jenis === 'mulai' ? 'A' : l.jenis === 'tiba' ? 'B' : i}
              </span>
              <span className="text-sm text-slate-900">
                {l.teks}
                {l.jarakTeks && <span className="text-slate-600"> · {l.jarakTeks}</span>}
              </span>
            </li>
          ))}
        </ol>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={onBagikan} className="inline-flex items-center gap-2 rounded-xl border border-slate-300 px-3 py-2.5 text-sm font-semibold text-slate-900 hover:bg-slate-50">
          <IkonBagikan ukuran={18} /> Bagikan rute
        </button>
        {pesanBagikan && <span role="status" className="text-sm text-green-800">{pesanBagikan}</span>}
      </div>

      <p className="text-xs text-slate-600">
        Jarak diukur sepanjang jalur yang digambar di peta. Waktu memakai perkiraan {KECEPATAN_JALAN} m/detik dan bisa berbeda di lapangan.
        {asal.jenis === 'gps' ? ' Posisi GPS bisa meleset beberapa meter, terutama di antara gedung.' : ''}
      </p>

      <Perbandingan rute={rute} graphData={graphData} indeks={indeks} />
    </section>
  )
}
