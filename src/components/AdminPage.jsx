import { useCallback, useEffect, useMemo, useState } from 'react'
import { ruanganMentah, tempat } from '../data'
import { bulkUpsertRooms, deleteRoom, getSession, insertRoom, isSupabaseConfigured, listRooms, signIn, signOut, updateRoom } from '../lib/supabase'
import { petaKodeKeTempat } from '../lib/rooms'
import { normalizeText } from '../lib/search'
import { pisahkanDataAwal, validasiBarisImpor } from '../lib/adminData'

const tempatBergedung = tempat.filter((t) => t.gedung.length > 0)
const kodeKeTempat = petaKodeKeTempat(tempat)
const namaTempat = new Map(tempat.map((t) => [t.id, t.nama]))
const KELAS_INPUT = 'w-full rounded-lg border border-slate-300 px-3 py-2.5 text-base'
const KELAS_TOMBOL = 'rounded-lg bg-sky-800 px-4 py-2.5 font-semibold text-white hover:bg-sky-900 disabled:opacity-50'

function Konfigurasi() {
  return (
    <Halaman>
      <p className="rounded-xl bg-amber-50 p-4 text-amber-900">
        Panel admin membutuhkan Supabase. Isi <code>VITE_SUPABASE_URL</code> dan <code>VITE_SUPABASE_ANON_KEY</code> pada berkas <code>.env</code>, lalu jalankan ulang aplikasi.
      </p>
    </Halaman>
  )
}

function Halaman({ children, aksi }) {
  return (
    <div className="mx-auto max-w-4xl space-y-6 p-4 sm:p-6">
      <header className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Admin ruangan</h1>
          <a href="#/" className="text-sm font-semibold text-sky-800 underline">Kembali ke peta</a>
        </div>
        {aksi}
      </header>
      {children}
    </div>
  )
}

function Masuk({ onMasuk }) {
  const [email, setEmail] = useState('')
  const [sandi, setSandi] = useState('')
  const [galat, setGalat] = useState('')
  const [proses, setProses] = useState(false)

  const kirim = async (e) => {
    e.preventDefault()
    setProses(true)
    setGalat('')
    try {
      onMasuk(await signIn(email.trim(), sandi))
    } catch (err) {
      setGalat(err.message)
    } finally {
      setProses(false)
    }
  }

  return (
    <Halaman>
      <form onSubmit={kirim} className="max-w-sm space-y-3 rounded-2xl border border-slate-200 bg-white p-5">
        <h2 className="text-lg font-bold">Masuk</h2>
        <label className="block text-sm font-semibold">Email
          <input type="email" required autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} className={`${KELAS_INPUT} mt-1`} />
        </label>
        <label className="block text-sm font-semibold">Kata sandi
          <input type="password" required autoComplete="current-password" value={sandi} onChange={(e) => setSandi(e.target.value)} className={`${KELAS_INPUT} mt-1`} />
        </label>
        {galat && <p role="alert" className="text-sm text-red-700">{galat}</p>}
        <button disabled={proses} className={KELAS_TOMBOL}>{proses ? 'Masuk…' : 'Masuk'}</button>
      </form>
    </Halaman>
  )
}

function PanelAdmin({ onKeluar }) {
  const [daftar, setDaftar] = useState([])
  const [memuat, setMemuat] = useState(true)
  const [galat, setGalat] = useState('')
  const [info, setInfo] = useState('')
  const [saring, setSaring] = useState('')
  const [saringTempat, setSaringTempat] = useState('')
  const [form, setForm] = useState({ tempatId: tempatBergedung[0].id, kodeGedung: tempatBergedung[0].gedung[0].kode, lantai: 1, nomor: '', nama: '', alias: '' })
  const [impor, setImpor] = useState('')
  const [sibuk, setSibuk] = useState(false)

  const muat = useCallback(
    () =>
      listRooms()
        .then((rows) => {
          setDaftar(rows)
          setGalat('')
        })
        .catch((e) => {
          setGalat(e.message)
          if (/Sesi login berakhir/.test(e.message)) onKeluar()
        })
        .finally(() => setMemuat(false)),
    [onKeluar]
  )

  useEffect(() => {
    muat()
  }, [muat])

  const tempatForm = tempat.find((t) => t.id === form.tempatId)
  const gedungForm = tempatForm.gedung.find((g) => g.kode === form.kodeGedung) || tempatForm.gedung[0]
  const kodeBaru = /^\d{1,4}$/.test(form.nomor) ? `${gedungForm.kode}.${form.lantai}.${form.nomor}` : ''
  const awal = useMemo(() => pisahkanDataAwal(ruanganMentah), [])
  const kodeAda = useMemo(() => new Set(daftar.map((r) => r.kode)), [daftar])

  const jalankan = async (fn, pesanSukses) => {
    setSibuk(true)
    setInfo('')
    setGalat('')
    try {
      await fn()
      setInfo(pesanSukses)
      await muat()
    } catch (e) {
      setGalat(e.message)
    } finally {
      setSibuk(false)
    }
  }

  const ubahTempat = (tempatId) => {
    const t = tempat.find((x) => x.id === tempatId)
    setForm((f) => ({ ...f, tempatId, kodeGedung: t.gedung[0].kode, lantai: 1 }))
  }

  const simpan = (e) => {
    e.preventDefault()
    if (!kodeBaru) return setGalat('Nomor ruangan harus berupa angka (maksimal 4 digit).')
    if (!form.nama.trim()) return setGalat('Nama ruangan wajib diisi.')
    if (kodeAda.has(kodeBaru)) return setGalat(`Kode ${kodeBaru} sudah dipakai.`)
    return jalankan(async () => {
      await insertRoom({ kode: kodeBaru, gedung_id: gedungForm.kode, lantai: Number(form.lantai), nomor: form.nomor, nama: form.nama.trim(), alias: form.alias.trim() || null, status: 'ok' })
      setForm((f) => ({ ...f, nomor: '', nama: '', alias: '' }))
    }, `Tersimpan: ${kodeBaru} - ${form.nama.trim()}`)
  }

  const jalankanImpor = () => {
    const galatBaris = []
    const baris = []
    const lihat = new Set()
    impor.split('\n').forEach((teks, i) => {
      if (!teks.trim()) return
      const hasil = validasiBarisImpor(teks, i + 1, lihat, tempat)
      if (hasil.galat) galatBaris.push(hasil.galat)
      else { lihat.add(hasil.baris.kode); baris.push(hasil.baris) }
    })
    if (galatBaris.length) return setGalat(`Tidak ada yang diimpor. ${galatBaris.length} kesalahan:\n${galatBaris.slice(0, 15).join('\n')}`)
    if (!baris.length) return setGalat('Tidak ada data untuk diimpor.')
    const diperbarui = baris.filter((b) => kodeAda.has(b.kode)).length
    if (!window.confirm(`Impor ${baris.length} ruangan (${baris.length - diperbarui} baru, ${diperbarui} memperbarui yang sudah ada)?`)) return undefined
    return jalankan(async () => {
      await bulkUpsertRooms(baris)
      setImpor('')
    }, `Berhasil mengimpor ${baris.length} ruangan.`)
  }

  const salinDataAwal = () => {
    if (!window.confirm(`Salin ${awal.siap.length} ruangan dari berkas bawaan ke Supabase? Kode yang sudah ada akan diperbarui.`)) return undefined
    return jalankan(async () => {
      for (let i = 0; i < awal.siap.length; i += 200) await bulkUpsertRooms(awal.siap.slice(i, i + 200))
    }, `Berhasil menyalin ${awal.siap.length} ruangan. ${awal.belum.length} ruangan lain masih perlu dilengkapi.`)
  }

  const lengkapi = (r) => {
    const tempatId = kodeKeTempat.get(r.kodeGedung) || tempatBergedung[0].id
    const t = tempat.find((x) => x.id === tempatId)
    setForm({ tempatId, kodeGedung: t.gedung.some((g) => g.kode === r.kodeGedung) ? r.kodeGedung : t.gedung[0].kode, lantai: Number.isInteger(r.lantai) ? r.lantai : 1, nomor: '', nama: r.nama, alias: r.alias || '' })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const ubah = (r) => {
    const nama = window.prompt(`Nama ruangan untuk ${r.kode}:`, r.nama)
    if (nama === null) return undefined
    if (!nama.trim()) return setGalat('Nama tidak boleh kosong.')
    const alias = window.prompt('Alias (pisahkan dengan koma, boleh kosong):', r.alias || '')
    if (alias === null) return undefined
    return jalankan(() => updateRoom(r.kode, { nama: nama.trim(), alias: alias.trim() || null }), `Diperbarui: ${r.kode}`)
  }

  const hapus = (r) => {
    if (!window.confirm(`Hapus ruangan ${r.kode} - ${r.nama}?`)) return undefined
    return jalankan(() => deleteRoom(r.kode), `Dihapus: ${r.kode}`)
  }

  const tampil = daftar
    .filter((r) => (!saringTempat || kodeKeTempat.get(String(r.gedung_id)) === saringTempat) && (!saring.trim() || normalizeText(`${r.kode} ${r.nama} ${r.alias || ''}`).includes(normalizeText(saring))))
  const MAKS = 200

  return (
    <Halaman aksi={<button type="button" onClick={() => { signOut(); onKeluar() }} className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold">Keluar</button>}>
      <div aria-live="polite">
        {info && <p role="status" className="rounded-lg bg-green-50 px-3 py-2 text-sm text-green-900">{info}</p>}
        {galat && <p role="alert" className="whitespace-pre-line rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">{galat}</p>}
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white p-5">
        <h2 className="mb-3 text-lg font-bold">Tambah ruangan</h2>
        <form onSubmit={simpan} className="grid gap-3 sm:grid-cols-4">
          <label className="text-sm font-semibold sm:col-span-2">Gedung
            <select value={form.tempatId} onChange={(e) => ubahTempat(e.target.value)} className={`${KELAS_INPUT} mt-1`}>
              {tempatBergedung.map((t) => <option key={t.id} value={t.id}>{t.nama}</option>)}
            </select>
          </label>
          {tempatForm.gedung.length > 1 && (
            <label className="text-sm font-semibold">Kode gedung
              <select value={gedungForm.kode} onChange={(e) => setForm((f) => ({ ...f, kodeGedung: e.target.value, lantai: 1 }))} className={`${KELAS_INPUT} mt-1`}>
                {tempatForm.gedung.map((g) => <option key={g.kode} value={g.kode}>{g.kode}</option>)}
              </select>
            </label>
          )}
          <label className="text-sm font-semibold">Lantai
            <select value={form.lantai} onChange={(e) => setForm((f) => ({ ...f, lantai: Number(e.target.value) }))} className={`${KELAS_INPUT} mt-1`}>
              {Array.from({ length: gedungForm.lantai }, (_, i) => i + 1).map((l) => <option key={l} value={l}>Lantai {l}</option>)}
            </select>
          </label>
          <label className="text-sm font-semibold">Nomor ruangan
            <input inputMode="numeric" value={form.nomor} onChange={(e) => setForm((f) => ({ ...f, nomor: e.target.value.trim() }))} placeholder="12" className={`${KELAS_INPUT} mt-1`} />
          </label>
          <label className="text-sm font-semibold sm:col-span-2">Nama ruangan
            <input value={form.nama} maxLength={100} onChange={(e) => setForm((f) => ({ ...f, nama: e.target.value }))} placeholder="Mushola" className={`${KELAS_INPUT} mt-1`} />
          </label>
          <label className="text-sm font-semibold sm:col-span-2">Alias (opsional, pisahkan dengan koma)
            <input value={form.alias} maxLength={200} onChange={(e) => setForm((f) => ({ ...f, alias: e.target.value }))} placeholder="musholla, tempat ibadah" className={`${KELAS_INPUT} mt-1`} />
          </label>
          <p className="text-sm sm:col-span-4">Kode otomatis: <b className="font-mono">{kodeBaru || '-'}</b></p>
          <div className="sm:col-span-4"><button disabled={sibuk} className={KELAS_TOMBOL}>Simpan ruangan</button></div>
        </form>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5">
        <h2 className="mb-1 text-lg font-bold">Impor banyak ruangan</h2>
        <p className="mb-2 text-sm text-slate-700">Satu baris per ruangan: <code>kode,nama</code> atau <code>kode,nama,alias</code>. Jika ada satu baris salah, tidak ada yang diimpor.</p>
        <textarea rows={5} value={impor} onChange={(e) => setImpor(e.target.value)} placeholder={'001.1.12,Mushola,musholla\n002.2.05,Ruang Dosen'} className={`${KELAS_INPUT} font-mono text-sm`} aria-label="Daftar ruangan untuk diimpor" />
        <button type="button" disabled={sibuk || !impor.trim()} onClick={jalankanImpor} className={`${KELAS_TOMBOL} mt-2`}>Impor</button>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5">
        <h2 className="mb-1 text-lg font-bold">Data awal dari berkas</h2>
        <p className="text-sm text-slate-700">
          Berkas bawaan aplikasi berisi {ruanganMentah.length} ruangan: {awal.siap.length} siap disalin ke Supabase dan {awal.belum.length} masih perlu dilengkapi (lantai atau kode belum jelas).
          Setelah Supabase berisi data, aplikasi memakai data Supabase sepenuhnya, jadi lengkapi dulu ruangan penting seperti ruang pimpinan fakultas.
        </p>
        <button type="button" disabled={sibuk || !awal.siap.length} onClick={salinDataAwal} className={`${KELAS_TOMBOL} mt-3`}>Salin {awal.siap.length} ruangan ke Supabase</button>
        {awal.belum.length > 0 && (
          <details className="mt-4">
            <summary className="cursor-pointer font-semibold">Perlu dilengkapi ({awal.belum.length})</summary>
            <ul className="mt-2 divide-y divide-slate-100 text-sm">
              {awal.belum.map((r, i) => (
                <li key={`${r.kode}-${i}`} className="flex items-center justify-between gap-3 py-2">
                  <span><b>{r.nama}</b> <span className="text-slate-600">· {namaTempat.get(kodeKeTempat.get(r.kodeGedung)) || 'gedung belum jelas'} · {r.alasan}</span></span>
                  <button type="button" onClick={() => lengkapi(r)} className="flex-none rounded-lg border border-slate-300 px-3 py-1.5 font-semibold">Lengkapi</button>
                </li>
              ))}
            </ul>
          </details>
        )}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5">
        <h2 className="mb-3 text-lg font-bold">Daftar ruangan di Supabase ({daftar.length})</h2>
        <div className="mb-3 flex flex-wrap gap-2">
          <select aria-label="Saring menurut gedung" value={saringTempat} onChange={(e) => setSaringTempat(e.target.value)} className="rounded-lg border border-slate-300 px-3 py-2">
            <option value="">Semua gedung</option>
            {tempatBergedung.map((t) => <option key={t.id} value={t.id}>{t.nama}</option>)}
          </select>
          <input type="search" aria-label="Saring menurut nama atau kode" value={saring} onChange={(e) => setSaring(e.target.value)} placeholder="Cari nama atau kode" className="rounded-lg border border-slate-300 px-3 py-2" />
        </div>
        {memuat ? <p>Memuat…</p> : (
          <>
            <p className="mb-2 text-sm text-slate-700">{tampil.length} ruangan{tampil.length > MAKS ? ` (menampilkan ${MAKS} pertama)` : ''}</p>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-100"><tr><th className="p-2">Kode</th><th className="p-2">Nama</th><th className="p-2">Alias</th><th className="p-2">Lt.</th><th className="p-2" /></tr></thead>
                <tbody>
                  {tampil.slice(0, MAKS).map((r) => (
                    <tr key={r.kode} className="border-t border-slate-100">
                      <td className="p-2 font-mono">{r.kode}</td><td className="p-2">{r.nama}</td><td className="p-2 text-slate-600">{r.alias}</td><td className="p-2">{r.lantai}</td>
                      <td className="whitespace-nowrap p-2 text-right">
                        <button type="button" disabled={sibuk} onClick={() => ubah(r)} className="mr-3 font-semibold text-sky-800 underline">Ubah</button>
                        <button type="button" disabled={sibuk} onClick={() => hapus(r)} className="font-semibold text-red-700 underline">Hapus</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>
    </Halaman>
  )
}

export default function AdminPage() {
  const [sesi, setSesi] = useState(() => getSession())
  if (!isSupabaseConfigured()) return <Konfigurasi />
  if (!sesi) return <Masuk onMasuk={setSesi} />
  return <PanelAdmin onKeluar={() => setSesi(null)} />
}
