const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.replace(/\/$/, '')
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabaseConfig = supabaseUrl && supabaseAnonKey
  ? { url: supabaseUrl, key: supabaseAnonKey }
  : null

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

export async function signIn(email, password) {
  if (!supabaseConfig) throw new Error('Supabase belum dikonfigurasi.')
  const response = await fetch(`${supabaseConfig.url}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({ email, password }),
  })
  const data = await response.json()
  if (!response.ok) throw new Error(data.error_description || data.msg || 'Login gagal.')
  localStorage.setItem('fmipa_supabase_session', JSON.stringify(data))
  return data
}

export function getSession() {
  try {
    return JSON.parse(localStorage.getItem('fmipa_supabase_session') || 'null')
  } catch {
    return null
  }
}

export function signOut() {
  localStorage.removeItem('fmipa_supabase_session')
}

async function request(path, options = {}) {
  if (!supabaseConfig) throw new Error('Supabase belum dikonfigurasi.')
  const session = getSession()
  const response = await fetch(`${supabaseConfig.url}/rest/v1/${path}`, {
    ...options,
    headers: { ...headers(session?.access_token), ...(options.headers || {}) },
  })
  if (!response.ok) {
    const text = await response.text()
    throw new Error(text || `Supabase request gagal (${response.status}).`)
  }
  const text = await response.text()
  return text ? JSON.parse(text) : null
}

export async function listRooms() {
  return request('ruangan?select=*&order=gedung_id.asc,lantai.asc,kode.asc')
}

export async function insertRoom(room) {
  return request('ruangan', {
    method: 'POST',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify(room),
  })
}

export async function updateRoom(kode, room) {
  return request(`ruangan?kode=eq.${encodeURIComponent(kode)}`, {
    method: 'PATCH',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify(room),
  })
}

export async function deleteRoom(kode) {
  return request(`ruangan?kode=eq.${encodeURIComponent(kode)}`, {
    method: 'DELETE',
  })
}

export async function bulkUpsertRooms(rooms) {
  return request('rpc/bulk_upsert_rooms', {
    method: 'POST',
    body: JSON.stringify({ payload: rooms }),
  })
}
