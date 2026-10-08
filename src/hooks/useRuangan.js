import { useEffect, useState } from 'react'
import { isSupabaseConfigured, listRooms } from '../lib/supabase'
import { normalisasiSemua } from '../lib/rooms'
import { ruanganLokal, tempat } from '../data'

/**
 * Data ruangan: berkas lokal dipakai lebih dulu (aplikasi langsung berfungsi).
 * Jika Supabase terkonfigurasi dan berisi data, data Supabase menggantikannya.
 */
export function useRuangan() {
  const [state, setState] = useState({ ruangan: ruanganLokal, sumber: 'lokal', galat: '' })

  useEffect(() => {
    if (!isSupabaseConfigured()) return undefined
    let batal = false
    listRooms()
      .then((rows) => {
        if (batal || !rows.length) return
        setState({ ruangan: normalisasiSemua(rows, tempat), sumber: 'supabase', galat: '' })
      })
      .catch((e) => {
        if (!batal) setState((s) => ({ ...s, galat: e.message }))
      })
    return () => {
      batal = true
    }
  }, [])

  return state
}
