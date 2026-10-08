import { KELOMPOK, URUTAN_KELOMPOK } from '../lib/peta'

export default function Legenda() {
  return (
    <details className="pointer-events-auto absolute bottom-6 left-2 z-[1000] max-w-[14rem] rounded-xl bg-white/95 text-xs text-slate-800 shadow-md md:bottom-7">
      <summary className="cursor-pointer select-none rounded-xl px-3 py-2 font-semibold">Keterangan warna</summary>
      <ul className="space-y-1.5 px-3 pb-3">
        {URUTAN_KELOMPOK.map((k) => (
          <li key={k} className="flex items-center gap-2">
            <span className="h-3 w-3 flex-none rounded-sm border" style={{ background: `${KELOMPOK[k].warna}59`, borderColor: KELOMPOK[k].warna }} />
            {KELOMPOK[k].nama}
          </li>
        ))}
        <li className="flex items-center gap-2"><span className="h-1 w-5 flex-none rounded bg-blue-600" />Rute yang disarankan</li>
        <li className="flex items-center gap-2"><span className="h-1 w-5 flex-none rounded bg-slate-400" />Jalur jalan kaki</li>
      </ul>
    </details>
  )
}
