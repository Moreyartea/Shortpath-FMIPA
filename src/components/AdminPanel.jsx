import { useMemo, useState } from 'react'
import { BUILDINGS } from '../lib/buildings'
import { bulkUpsertRooms, deleteRoom, insertRoom, isSupabaseConfigured, signIn, signOut, updateRoom, getSession } from '../lib/supabase'

function emptyForm() {
  return { kode: '', gedungId: '005', lantai: '1', nomor: '', nama: '', alias: '' }
}

export default function AdminPanel({ rooms, onRoomsChange }) {
  const [session, setSession] = useState(getSession())
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [form, setForm] = useState(emptyForm())
  const [editing, setEditing] = useState(null)
  const [filter, setFilter] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [bulkText, setBulkText] = useState('')

  const building = BUILDINGS.find((item) => item.graphId === form.gedungId) || BUILDINGS[0]
  const visibleRooms = useMemo(() => {
    const q = filter.trim().toLowerCase()
    if (!q) return rooms.slice(0, 100)
    return rooms.filter((room) => `${room.kode} ${room.nama} ${room.alias || ''}`.toLowerCase().includes(q)).slice(0, 100)
  }, [rooms, filter])

  const submitLogin = async (event) => {
    event.preventDefault()
    setError(''); setMessage('')
    try {
      const next = await signIn(email, password)
      setSession(next)
      setMessage('Login berhasil.')
    } catch (err) { setError(err.message) }
  }

  const makeCode = () => {
    if (!form.nomor.trim()) return ''
    return `${building.code}.${form.lantai}.${form.nomor.trim()}`
  }

  const save = async (event) => {
    event.preventDefault()
    setError(''); setMessage('')
    if (!isSupabaseConfigured()) return setError('Isi VITE_SUPABASE_URL dan VITE_SUPABASE_ANON_KEY terlebih dahulu.')
    if (!session) return setError('Silakan login terlebih dahulu.')
    if (building.code === '-') return setError('Gedung ini belum memiliki kode resmi pada data ruangan.')
    if (Number(form.lantai) < 1 || Number(form.lantai) > building.floors) return setError('Lantai berada di luar batas gedung.')
    const kode = editing || makeCode()
    if (!kode || !form.nama.trim()) return setError('Nomor dan nama ruangan wajib diisi.')
    try {
      const payload = { kode, gedung_id: building.code.split('/')[0], lantai: Number(form.lantai), nomor: form.nomor.trim(), nama: form.nama.trim(), alias: form.alias.trim() || null }
      if (editing) await updateRoom(editing, payload)
      else await insertRoom(payload)
      onRoomsChange()
      setForm(emptyForm()); setEditing(null); setMessage(editing ? 'Ruangan diperbarui.' : 'Ruangan ditambahkan.')
    } catch (err) { setError(err.message) }
  }

  const edit = (room) => {
    setEditing(room.kode)
    setForm({ kode: room.kode, gedungId: BUILDINGS.find((b) => b.code === room.gedung_id)?.graphId || '005', lantai: String(room.lantai), nomor: room.nomor || '', nama: room.nama, alias: room.alias || '' })
    setMessage('Mode edit aktif.')
  }

  const remove = async (room) => {
    if (!window.confirm(`Hapus ${room.nama} (${room.kode})?`)) return
    try { await deleteRoom(room.kode); onRoomsChange(); setMessage('Ruangan dihapus.') } catch (err) { setError(err.message) }
  }

  const importBulk = async () => {
    setError(''); setMessage('')
    if (!session) return setError('Silakan login terlebih dahulu.')
    const lines = bulkText.split(/\r?\n/).map((line) => line.trim()).filter(Boolean)
    if (lines.length === 0) return setError('Tempel data import terlebih dahulu.')
    const rows = []
    for (const [index, line] of lines.entries()) {
      const parts = line.split(',').map((value) => value.trim())
      if (parts.length < 2 || !parts[0] || !parts[1]) return setError(`Baris ${index + 1} tidak valid.`)
      const [kode, nama, alias = ''] = parts
      const bits = kode.split('.')
      if (bits.length < 3) return setError(`Kode ${kode} pada baris ${index + 1} tidak valid.`)
      const gedungId = bits[0]
      const lantai = Number(bits[1])
      const nomor = bits[2]
      if (!Number.isInteger(lantai) || lantai < 1) return setError(`Lantai pada baris ${index + 1} tidak valid.`)
      rows.push({ kode, nama, alias, gedung_id: gedungId, lantai, nomor })
    }
    if (!window.confirm(`Import ${rows.length} baris? Kode yang sudah ada akan diperbarui.`)) return
    try {
      await bulkUpsertRooms(rows)
      await onRoomsChange()
      setBulkText('')
      setMessage(`${rows.length} ruangan berhasil diimpor.`)
    } catch (err) { setError(err.message) }
  }

  if (!session) {
    return <section className="mx-auto max-w-md rounded-2xl bg-white p-5 shadow-xl">
      <h2 className="text-xl font-bold text-slate-900">Login Admin</h2>
      <p className="mt-1 text-sm text-slate-500">Gunakan akun Supabase yang sudah dibuat.</p>
      <form onSubmit={submitLogin} className="mt-5 space-y-3">
        <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" placeholder="Email" className="w-full rounded-xl border px-3 py-3 text-sm" required />
        <input value={password} onChange={(e) => setPassword(e.target.value)} type="password" placeholder="Password" className="w-full rounded-xl border px-3 py-3 text-sm" required />
        <button className="w-full rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white">Masuk</button>
      </form>
      {!isSupabaseConfigured() && <p className="mt-3 text-xs text-amber-700">Supabase belum dikonfigurasi. Isi file .env lokal.</p>}
      {error && <p className="mt-3 rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
    </section>
  }

  return <section className="space-y-4">
    <div className="flex items-center justify-between gap-3">
      <div><h2 className="text-xl font-bold text-slate-900">Admin Ruangan</h2><p className="text-sm text-slate-500">Kelola data ruangan melalui Supabase.</p></div>
      <button onClick={() => { signOut(); setSession(null) }} className="rounded-xl border px-3 py-2 text-sm">Keluar</button>
    </div>
    <form onSubmit={save} className="rounded-2xl bg-white p-4 shadow-xl space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <select value={form.gedungId} onChange={(e) => setForm({ ...form, gedungId: e.target.value, lantai: '1' })} className="rounded-xl border px-3 py-3 text-sm">
          {BUILDINGS.map((item) => <option key={item.graphId} value={item.graphId}>{item.code !== '-' ? `${item.code} — ` : ''}{item.name}</option>)}
        </select>
        <select value={form.lantai} onChange={(e) => setForm({ ...form, lantai: e.target.value })} className="rounded-xl border px-3 py-3 text-sm">
          {Array.from({ length: building.floors }, (_, i) => i + 1).map((floor) => <option key={floor} value={floor}>Lantai {floor}</option>)}
        </select>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <input value={form.nomor} onChange={(e) => setForm({ ...form, nomor: e.target.value })} placeholder="Nomor ruangan" className="rounded-xl border px-3 py-3 text-sm" required />
        <input value={form.nama} onChange={(e) => setForm({ ...form, nama: e.target.value })} placeholder="Nama ruangan" className="rounded-xl border px-3 py-3 text-sm" required />
      </div>
      <input value={form.alias} onChange={(e) => setForm({ ...form, alias: e.target.value })} placeholder="Alias (opsional)" className="w-full rounded-xl border px-3 py-3 text-sm" />
      <div className="rounded-xl bg-slate-50 p-3 text-sm text-slate-600">Kode: <strong>{editing || makeCode() || '—'}</strong></div>
      <button className="w-full rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white">{editing ? 'Simpan Perubahan' : 'Tambah Ruangan'}</button>
      {editing && <button type="button" onClick={() => { setEditing(null); setForm(emptyForm()) }} className="w-full rounded-xl border px-4 py-3 text-sm">Batal Edit</button>}
    </form>
    {message && <div className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-700">{message}</div>}
    {error && <div className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</div>}
    <div className="rounded-2xl bg-white p-4 shadow-xl">
      <h3 className="text-sm font-bold text-slate-900">Import massal</h3>
      <p className="mt-1 text-xs text-slate-500">Format: kode,nama,alias. Satu baris salah membatalkan seluruh transaksi.</p>
      <textarea value={bulkText} onChange={(e) => setBulkText(e.target.value)} rows={5} placeholder="001.1.12,Ruang Contoh,Contoh" className="mt-2 w-full rounded-xl border px-3 py-3 text-sm" />
      <button onClick={importBulk} className="mt-2 w-full rounded-xl border px-4 py-3 text-sm font-semibold">Import Data</button>
      <div className="my-5 border-t" />
      <input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Filter kode atau nama..." className="w-full rounded-xl border px-3 py-3 text-sm" />
      <div className="mt-3 max-h-[45vh] overflow-auto divide-y">
        {visibleRooms.map((room) => <div key={room.kode} className="flex items-center justify-between gap-3 py-3"><div className="min-w-0"><p className="truncate text-sm font-semibold">{room.nama}</p><p className="text-xs text-slate-500">{room.kode} · Lantai {room.lantai}</p></div><div className="flex shrink-0 gap-2"><button onClick={() => edit(room)} className="rounded-lg border px-2 py-1 text-xs">Edit</button><button onClick={() => remove(room)} className="rounded-lg border border-red-200 px-2 py-1 text-xs text-red-700">Hapus</button></div></div>)}
      </div>
    </div>
  </section>
}
