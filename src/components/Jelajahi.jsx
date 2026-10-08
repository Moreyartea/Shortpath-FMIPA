import { IkonPanah } from './Ikon'
import { KELOMPOK, URUTAN_KELOMPOK } from '../lib/peta'
import { formatJarak } from '../lib/format'
import { posisiRelatif } from '../lib/places'

const ANGKA = ['nol', 'satu', 'dua', 'tiga', 'empat', 'lima', 'enam', 'tujuh', 'delapan', 'sembilan', 'sepuluh']
const angkaKata = (n) => ANGKA[n] ?? String(n)

function daftarKata(item) {
  if (item.length <= 1) return item.join('')
  return `${item.slice(0, -1).join(', ')}, dan ${item.at(-1)}`
}

export default function Jelajahi({ orientasi, indeks, ruangan, pilihanCepat, onBuka, onCari }) {
  const pusat = orientasi?.pusat
  const jurusan = orientasi ? orientasi.terhubung.filter((x) => x.tempat.kelompok === 'jurusan') : []

  return (
    <section aria-label="Mengenal kawasan FMIPA" className="space-y-5">
      <div>
        <h2 className="text-lg font-bold text-slate-900">Mengenal kawasan FMIPA</h2>
        {pusat && (
          <p className="mt-2 text-sm leading-relaxed text-slate-800">
            <b>{pusat.nama}</b> berada di bagian tengah kawasan.
            {jurusan.length > 0 && (
              <>
                {' '}{angkaKata(jurusan.length).replace(/^./, (c) => c.toUpperCase())} gedung jurusan tersambung langsung dengannya:{' '}
                {daftarKata(jurusan.map((x) => `${x.tempat.label} (${x.arah})`))}.
              </>
            )}{' '}
            Gedung lain, seperti laboratorium dan gedung penunjang, berada di sekitarnya. Arah mata angin mengacu pada peta (bagian atas adalah utara).
          </p>
        )}
      </div>

      {pilihanCepat.length > 0 && (
        <div>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-600">Cari cepat</h3>
          <div className="flex flex-wrap gap-2">
            {pilihanCepat.map((p) => (
              <button key={p.kueri} type="button" onClick={() => onCari(p.kueri)} className="rounded-full border border-slate-300 bg-white px-3.5 py-2 text-sm font-semibold text-slate-900 hover:border-sky-500 hover:bg-sky-50">
                {p.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {URUTAN_KELOMPOK.map((k) => {
        const tempat = indeks.daftar.filter((t) => t.kelompok === k)
        if (!tempat.length) return null
        return (
          <div key={k}>
            <h3 className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-600">
              <span className="h-3 w-3 rounded-sm border" style={{ background: `${KELOMPOK[k].warna}59`, borderColor: KELOMPOK[k].warna }} />
              {KELOMPOK[k].nama}
            </h3>
            <ul className="space-y-1.5">
              {tempat.map((t) => {
                const rel = pusat && t.id !== pusat.id ? posisiRelatif(indeks, pusat.id, t.id) : null
                const jumlah = ruangan.filter((r) => r.tempatId === t.id).length
                const lantai = Math.max(0, ...t.gedung.map((g) => g.lantai))
                return (
                  <li key={t.id}>
                    <button type="button" onClick={() => onBuka(t.id)} className="flex w-full items-center gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-left hover:border-sky-400 hover:bg-sky-50">
                      <span className="min-w-0 flex-1">
                        <span className="block font-semibold text-slate-900">{t.nama}</span>
                        <span className="block text-xs text-slate-600">
                          {rel ? `${rel.arah} ${pusat.label}, ±${formatJarak(rel.jarak)}` : 'Pusat kawasan'}
                          {lantai ? ` · ${lantai} lantai` : ''}
                          {jumlah ? ` · ${jumlah} ruangan tercatat` : ''}
                        </span>
                      </span>
                      <span className="text-slate-500"><IkonPanah /></span>
                    </button>
                  </li>
                )
              })}
            </ul>
          </div>
        )
      })}
    </section>
  )
}
