import { useEffect, useRef } from 'react'
import { IkonCari, IkonJalan, IkonLokasi } from './Ikon'

const LANGKAH = [
  { ikon: IkonCari, judul: 'Cari tujuanmu', isi: 'Ketik nama gedung atau ruangan, misalnya "Dekan", "Toilet", atau "Lab. Komputer".' },
  { ikon: IkonLokasi, judul: 'Pilih titik awal', isi: 'Pakai lokasimu, cari gedung terdekat yang kamu lihat, atau ketuk gedung di peta.' },
  { ikon: IkonJalan, judul: 'Ikuti rute', isi: 'Garis biru di peta adalah jalan kaki tercepat. Langkah-langkahnya tertulis di panel.' },
]

export default function Panduan({ onTutup, onJelajahi }) {
  const tombol = useRef(null)

  useEffect(() => {
    tombol.current?.focus()
    const esc = (e) => e.key === 'Escape' && onTutup()
    window.addEventListener('keydown', esc)
    return () => window.removeEventListener('keydown', esc)
  }, [onTutup])

  return (
    <div className="fixed inset-0 z-[2000] flex items-end justify-center bg-slate-900/60 p-3 sm:items-center" role="presentation" onClick={onTutup}>
      <div role="dialog" aria-modal="true" aria-labelledby="judul-panduan" className="max-h-[92dvh] w-full max-w-md overflow-y-auto rounded-2xl bg-white p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <h2 id="judul-panduan" className="text-xl font-bold text-slate-900">Selamat datang di Peta FMIPA</h2>
        <p className="mt-1 text-sm text-slate-700">Panduan jalan kaki di kawasan FMIPA Universitas Negeri Medan untuk mahasiswa baru dan pengunjung.</p>
        <ol className="mt-4 space-y-3">
          {LANGKAH.map(({ ikon: Ikon, judul, isi }, i) => (
            <li key={judul} className="flex gap-3">
              <span className="flex h-9 w-9 flex-none items-center justify-center rounded-full bg-sky-100 text-sky-800"><Ikon /></span>
              <span>
                <span className="block font-semibold text-slate-900">{i + 1}. {judul}</span>
                <span className="block text-sm text-slate-700">{isi}</span>
              </span>
            </li>
          ))}
        </ol>
        <p className="mt-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
          Rute menunjukkan jalan sampai gedung. Di dalam gedung, ikuti papan petunjuk lantai. Jarak dan waktu hanyalah perkiraan.
        </p>
        <div className="mt-5 flex flex-col gap-2 sm:flex-row-reverse">
          <button ref={tombol} type="button" onClick={onTutup} className="rounded-xl bg-sky-800 px-4 py-3 font-semibold text-white hover:bg-sky-900">
            Mulai
          </button>
          <button type="button" onClick={onJelajahi} className="rounded-xl border border-slate-300 px-4 py-3 font-semibold text-slate-800 hover:bg-slate-50">
            Baru di FMIPA? Kenali gedungnya
          </button>
        </div>
      </div>
    </div>
  )
}
