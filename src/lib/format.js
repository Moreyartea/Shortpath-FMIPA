// format.js - pembulatan dan teks untuk ditampilkan ke pengguna.

export const KECEPATAN_JALAN = 1.2 // m/detik, asumsi jalan kaki santai (belum diukur di lapangan)

/** 85.4 -> "85 m"; 1234 -> "1,23 km" */
export function formatJarak(meter) {
  if (!Number.isFinite(meter)) return '-'
  if (meter < 1000) return `${Math.round(meter)} m`
  return `${(meter / 1000).toFixed(2).replace('.', ',')} km`
}

/** Perkiraan menit jalan kaki; minimal 1 menit untuk jarak positif. */
export function perkiraanMenit(meter, kecepatan = KECEPATAN_JALAN) {
  if (!Number.isFinite(meter) || meter <= 0) return 0
  return Math.max(1, Math.round(meter / kecepatan / 60))
}

export function teksMenit(meter) {
  const m = perkiraanMenit(meter)
  return m <= 1 ? 'sekitar 1 menit' : `sekitar ${m} menit`
}

export function teksLantai(lantai) {
  return Number.isInteger(lantai) ? `Lantai ${lantai}` : 'lantai belum tercatat'
}

/** Kapital di awal kalimat. */
export function kapital(teks) {
  return teks ? teks.charAt(0).toUpperCase() + teks.slice(1) : teks
}
