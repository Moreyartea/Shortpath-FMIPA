import { useMemo, useState } from 'react'
import { IkonBawah, IkonKembali } from './Ikon'
import { KELOMPOK } from '../lib/peta'
import { formatJarak, teksLantai } from '../lib/format'
import { posisiRelatif, tempatTerhubung } from '../lib/places'
import { ringkasanIsi, ruanganPerLantai } from '../lib/rooms'
import { kebutuhanKueri, cocokKebutuhan, normalizeText } from '../lib/search'

export default function DetailTempat({ tempat, indeks, graph, ruangan, onKembali, onRuteKe, onRuteDari, onBuka, onPilihRuangan }) {
  const [saring, setSaring] = useState('')
  const isi = useMemo(() => ringkasanIsi(ruangan, tempat.id), [ruangan, tempat.id])
  const lantai = useMemo(() => ruanganPerLantai(ruangan, tempat.id), [ruangan, tempat.id])
  const terhubung = useMemo(() => tempatTerhubung(indeks, graph, tempat.id), [indeks, graph, tempat.id])
  const pusat = indeks.daftar.find((t) => t.kelompok === 'pusat')
  const rel = pusat && pusat.id !== tempat.id ? posisiRelatif(indeks, pusat.id, tempat.id) : null

  const kebutuhan = kebutuhanKueri(saring)
  const tersaring = useMemo(
    () =>
      lantai
        .map((l) => ({ ...l, ruangan: kebutuhan.length ? l.ruangan.filter((r) => cocokKebutuhan(normalizeText(`${r.nama} ${r.alias}`), kebutuhan)) : l.ruangan }))
        .filter((l) => l.ruangan.length),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [lantai, saring]
  )

  return (
    <article aria-label={`Rincian ${tempat.nama}`} className="space-y-5">
      <button type="button" onClick={onKembali} className="inline-flex items-center gap-1 text-sm font-semibold text-sky-800">
        <IkonKembali ukuran={16} /> Kembali
      </button>

      <header>
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">{KELOMPOK[tempat.kelompok]?.nama}</p>
        <h2 className="text-xl font-bold text-slate-900">{tempat.nama}</h2>
        {tempat.namaLengkap && tempat.namaLengkap !== tempat.nama && <p className="text-sm text-slate-700">{tempat.namaLengkap}</p>}
        <p className="mt-1 text-sm text-slate-800">
          {rel ? `Di ${rel.arah} ${pusat.nama}, sekitar ${formatJarak(rel.jarak)} dari pusat kawasan.` : 'Berada di pusat kawasan.'}
          {tempat.gedung.length > 0 && ` Kode gedung ${tempat.gedung.map((g) => g.kode).join(' dan ')}.`}
        </p>
      </header>

      <div className="grid grid-cols-2 gap-2">
        <button type="button" onClick={() => onRuteKe(tempat.id)} className="rounded-xl bg-sky-800 px-3 py-3 font-semibold text-white hover:bg-sky-900">Rute ke sini</button>
        <button type="button" onClick={() => onRuteDari(tempat.id)} className="rounded-xl border border-slate-300 px-3 py-3 font-semibold text-slate-900 hover:bg-slate-50">Rute dari sini</button>
      </div>

      {terhubung.length > 0 && (
        <section>
          <h3 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-600">Tersambung langsung dengan</h3>
          <div className="flex flex-wrap gap-2">
            {terhubung.map(({ tempat: t, jarak }) => (
              <button key={t.id} type="button" onClick={() => onBuka(t.id)} className="rounded-full border border-slate-300 bg-white px-3 py-1.5 text-sm font-semibold text-slate-900 hover:border-sky-500 hover:bg-sky-50">
                {t.label} <span className="font-normal text-slate-600">· {formatJarak(jarak)}</span>
              </button>
            ))}
          </div>
        </section>
      )}

      {isi.total > 0 ? (
        <>
          <section>
            <h3 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-600">Yang ada di sini</h3>
            {isi.fasilitas.length > 0 && (
              <p className="text-sm text-slate-800">{isi.fasilitas.map((f) => `${f.jumlah} ${f.label}`).join(' · ')}</p>
            )}
            {isi.penting.length > 0 && (
              <ul className="mt-2 space-y-1 text-sm text-slate-800">
                {isi.penting.map((p) => (
                  <li key={p.label}>
                    <b>{p.label}</b>:{' '}
                    {p.contoh.map((r, i) => (
                      <span key={r.id}>
                        {i > 0 && ', '}
                        <button type="button" className="underline decoration-dotted underline-offset-2 hover:text-sky-800" onClick={() => onPilihRuangan(r)}>{r.nama}</button>
                      </span>
                    ))}
                    {p.jumlah > p.contoh.length ? `, dan ${p.jumlah - p.contoh.length} lainnya` : ''}
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section aria-label="Isi gedung per lantai">
            <h3 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-600">Isi gedung per lantai</h3>
            <label htmlFor="saring-ruangan" className="sr-only">Saring ruangan di gedung ini</label>
            <input id="saring-ruangan" type="search" value={saring} onChange={(e) => setSaring(e.target.value)} placeholder="Cari di gedung ini" autoComplete="off" className="mb-2 w-full rounded-xl border border-slate-300 px-3 py-2.5 text-base placeholder:text-slate-500" />
            {tersaring.length === 0 && <p className="text-sm text-slate-700">Tidak ada ruangan yang cocok.</p>}
            <div className="space-y-2">
              {tersaring.map((l) => (
                <details key={l.lantai ?? 'x'} open={Boolean(saring.trim())} className="rounded-xl border border-slate-200 bg-white">
                  <summary className="flex cursor-pointer items-center justify-between px-3 py-2.5 font-semibold text-slate-900">
                    <span>{l.lantai === null ? 'Lantai belum tercatat' : teksLantai(l.lantai)} <span className="font-normal text-slate-600">· {l.ruangan.length} ruangan</span></span>
                    <IkonBawah ukuran={18} />
                  </summary>
                  <ul className="divide-y divide-slate-100 border-t border-slate-100">
                    {l.ruangan.map((r) => (
                      <li key={r.id}>
                        <button type="button" onClick={() => onPilihRuangan(r)} className="flex w-full items-baseline justify-between gap-3 px-3 py-2 text-left text-sm hover:bg-sky-50">
                          <span className="text-slate-900">{r.nama}</span>
                          {r.kodeTampil && <span className="flex-none text-xs text-slate-600">{r.kodeTampil}</span>}
                        </button>
                      </li>
                    ))}
                  </ul>
                </details>
              ))}
            </div>
          </section>
        </>
      ) : (
        <p className="rounded-xl bg-slate-50 p-3 text-sm text-slate-700">Belum ada data ruangan untuk tempat ini.</p>
      )}
    </article>
  )
}
