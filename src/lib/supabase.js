// supabase.js - klien REST ringan untuk Supabase (tanpa pustaka tambahan).
// Hanya anon key yang dipakai di browser. JANGAN pernah memasukkan service_role key ke sini.

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.replace(/\/$/, '')
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY
const KUNCI_SESI = 'fmipa_supabase_session'
const UKURAN_HALAMAN = 1000

export const supabaseConfig = supabaseUrl && supabaseAnonKey ? { url: supabaseUrl, key: supabaseAnonKey } : null

export function isSupabaseConfigured() {
  return Boolean(supabaseConfig)
}

function headers(accessToken) {
  return {
    apikey: supabaseConfig.key,
    Authorization: `Bearer ${accessToken || supabaseConfig.key}`,
    'Content-Type': 'application/json',
  }
}

function simpanSesi(data) {
  const sesi = { ...data, expires_at: data.expires_at || Math.floor(Date.now() / 1000) + (data.expires_in || 3600) }
  localStorage.setItem(KUNCI_SESI, JSON.stringify(sesi))
  return sesi
}

export function getSession() {
  try {
    return JSON.parse(localStorage.getItem(KUNCI_SESI) || 'null')
  } catch {
    return null
  }
}

export function signOut() {
  localStorage.removeItem(KUNCI_SESI)
}

export async function signIn(email, password) {
  if (!supabaseConfig) throw new Error('Supabase belum dikonfigurasi.')
  const response = await fetch(`${supabaseConfig.url}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({ email, password }),
  })
  const data = await response.json()
  if (!response.ok) throw new Error(data.error_description || data.msg || 'Login gagal.')
  return simpanSesi(data)
}

/** Perpanjang sesi memakai refresh token (token akses Supabase berlaku sekitar 1 jam). */
export async function refreshSession() {
  const sesi = getSession()
  if (!supabaseConfig || !sesi?.refresh_token) {
    signOut()
    throw new Error('Sesi login berakhir. Silakan masuk lagi.')
  }
  const response = await fetch(`${supabaseConfig.url}/auth/v1/token?grant_type=refresh_token`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({ refresh_token: sesi.refresh_token }),
  })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    signOut()
    throw new Error('Sesi login berakhir. Silakan masuk lagi.')
  }
  return simpanSesi(data)
}

async function request(path, options = {}, sudahCobaUlang = false) {
  if (!supabaseConfig) throw new Error('Supabase belum dikonfigurasi.')
  let session = getSession()
  // perpanjang lebih awal jika token hampir habis
  if (session && session.expires_at && session.expires_at - 30 < Date.now() / 1000 && !sudahCobaUlang) {
    session = await refreshSession()
  }
  const response = await fetch(`${supabaseConfig.url}/rest/v1/${path}`, {
    ...options,
    headers: { ...headers(session?.access_token), ...(options.headers || {}) },
  })
  if (response.status === 401 && session && !sudahCobaUlang) {
    await refreshSession()
    return request(path, options, true)
  }
  if (!response.ok) {
    const text = await response.text()
    throw new Error(text || `Supabase request gagal (${response.status}).`)
  }
  const text = await response.text()
  return text ? JSON.parse(text) : null
}

/** Ambil seluruh ruangan; dibaca per halaman karena Supabase membatasi jumlah baris per permintaan. */
export async function listRooms() {
  const semua = []
  for (let awal = 0; ; awal += UKURAN_HALAMAN) {
    const halaman = await request('ruangan?select=*&order=gedung_id.asc,lantai.asc,kode.asc', {
      headers: { Range: `${awal}-${awal + UKURAN_HALAMAN - 1}`, 'Range-Unit': 'items' },
    })
    semua.push(...(halaman || []))
    if (!halaman || halaman.length < UKURAN_HALAMAN) break
  }
  return semua
}

export async function insertRoom(room) {
  return request('ruangan', { method: 'POST', headers: { Prefer: 'return=representation' }, body: JSON.stringify(room) })
}

export async function updateRoom(kode, room) {
  return request(`ruangan?kode=eq.${encodeURIComponent(kode)}`, {
    method: 'PATCH',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify(room),
  })
}

export async function deleteRoom(kode) {
  return request(`ruangan?kode=eq.${encodeURIComponent(kode)}`, { method: 'DELETE' })
}

export async function bulkUpsertRooms(rooms) {
  return request('rpc/bulk_upsert_rooms', { method: 'POST', body: JSON.stringify({ payload: rooms }) })
}
