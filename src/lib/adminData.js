// adminData.js - logika data untuk panel admin (murni, mudah diuji).

import { petaKodeKeTempat } from './rooms'

/** Pisahkan baris data awal: yang aman dikirim ke tabel Supabase, dan yang masih perlu dilengkapi. */
export function pisahkanDataAwal(baris) {
  const hitungKode = new Map()
  for (const r of baris) if (r.kode) hitungKode.set(r.kode, (hitungKode.get(r.kode) || 0) + 1)
  const siap = []
  const belum = []
  for (const r of baris) {
    const alasan = []
    if (!Number.isInteger(r.lantai) || r.lantai < 1) alasan.push('lantai belum tercatat')
    if (!r.kode) alasan.push('kode belum ada')
    else if (!r.nomor) alasan.push('kode tidak punya nomor ruangan')
    // kode yang dipakai lebih dari satu ruangan tidak dikirim sama sekali: salah satunya pasti keliru
    if (r.kode && hitungKode.get(r.kode) > 1) alasan.push(`kode ${r.kode} dipakai ${hitungKode.get(r.kode)} ruangan`)
    if (r.status === 'perlu_dicek' && alasan.length === 0) alasan.push('perlu dicek')
    if (alasan.length) {
      belum.push({ ...r, alasan: alasan.join(', ') })
    } else {
      siap.push({ kode: r.kode, gedung_id: r.kodeGedung, lantai: r.lantai, nomor: String(r.nomor), nama: r.nama, alias: r.alias || '', kategori: r.kategori || '', status: r.status || '' })
    }
  }
  return { siap, belum }
}

/** Validasi satu baris impor massal "kode,nama[,alias]". Mengembalikan { baris } atau { galat }. */
export function validasiBarisImpor(teks, nomorBaris, sudahAda, daftarTempat) {
  const [kodeMentah = '', namaMentah = '', ...sisa] = teks.split(',')
  const kode = kodeMentah.trim()
  const nama = namaMentah.trim()
  const alias = sisa.join(',').trim()
  if (!/^\d{3}\.\d+\.\d+(\.\d+)?$/.test(kode)) {
    return { galat: `Baris ${nomorBaris}: kode "${kode}" tidak valid (harus gedung.lantai.nomor, contoh 001.1.12).` }
  }
  const [kodeGedung, lantaiTeks, nomor] = kode.split('.')
  const tempatId = petaKodeKeTempat(daftarTempat).get(kodeGedung)
  const gedung = daftarTempat.find((t) => t.id === tempatId)?.gedung.find((g) => g.kode === kodeGedung)
  if (!gedung) return { galat: `Baris ${nomorBaris}: kode gedung ${kodeGedung} tidak dikenal.` }
  const lantai = Number(lantaiTeks)
  if (lantai < 1 || lantai > gedung.lantai) return { galat: `Baris ${nomorBaris}: gedung ${kodeGedung} hanya punya lantai 1 sampai ${gedung.lantai}.` }
  if (!nama) return { galat: `Baris ${nomorBaris}: nama ruangan kosong.` }
  if (sudahAda.has(kode)) return { galat: `Baris ${nomorBaris}: kode ${kode} muncul dua kali dalam daftar.` }
  return { baris: { kode, gedung_id: kodeGedung, lantai, nomor, nama, alias } }
}
