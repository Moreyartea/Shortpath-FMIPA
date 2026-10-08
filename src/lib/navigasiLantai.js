// navigasiLantai.js — logika murni penentuan instruksi perpindahan lantai dan koneksi antar gedung.
// Aturan navigasi mengacu pada GEMINI.md:
// - Lapisan terpisah dari graph outdoor.
// - Lift hanya direkomendasikan jika kedua lantai dilayani oleh lift gedung tersebut.
// - Pasangan koneksi khusus (010 ↔ 009 dan 011 ↔ 009 pada lantai 1, 2, 3):
//   * Lantai sama: tidak perlu turun/naik, Jalan lewat penghubung langsung.
//   * Lantai beda: pindah lantai terlebih dahulu, baru gunakan koneksi.
// - GPS tidak boleh digunakan untuk menebak lantai pengguna.

import { FASILITAS_GEDUNG, KONEKSI_GEDUNG } from '../data/fasilitasGedung'

/**
 * Periksa apakah lift dapat digunakan antara dua lantai di sebuah gedung.
 * @param {string} kodeGedung
 * @param {number} lantaiAsal
 * @param {number} lantaiTujuan
 * @returns {boolean}
 */
export function cekFasilitasLift(kodeGedung, lantaiAsal, lantaiTujuan) {
  const data = FASILITAS_GEDUNG[kodeGedung]
  if (!data || !Array.isArray(data.liftFloors) || data.liftFloors.length === 0) {
    return false
  }
  return data.liftFloors.includes(lantaiAsal) && data.liftFloors.includes(lantaiTujuan)
}

/**
 * Cari koneksi khusus langsung antar dua gedung jika ada.
 * @param {string} kodeAsal
 * @param {string} kodeTujuan
 * @returns {{ gedungA: string, gedungB: string, lantai: number[] } | null}
 */
export function cariKoneksiGedung(kodeAsal, kodeTujuan) {
  if (!kodeAsal || !kodeTujuan) return null
  return (
    KONEKSI_GEDUNG.find(
      (k) =>
        (k.gedungA === kodeAsal && k.gedungB === kodeTujuan) ||
        (k.gedungB === kodeAsal && k.gedungA === kodeTujuan)
    ) || null
  )
}

/**
 * Ekstrak informasi lokasi/ruangan yang dinormalisasi untuk penentuan lantai.
 * Mendukung objek asal/tujuan dari App.jsx, objek ruangan, atau objek dengan kodeGedung/lantai langsung.
 */
export function ekstrakInfoLokasi(lokasi) {
  if (!lokasi) {
    return {
      kodeGedung: null,
      lantai: null,
      namaRuangan: null,
      namaGedung: null,
      isGps: false,
    }
  }

  if (lokasi.jenis === 'gps' || lokasi.isGps) {
    return {
      kodeGedung: null,
      lantai: null,
      namaRuangan: null,
      namaGedung: null,
      isGps: true,
    }
  }

  const ruangan = lokasi.ruangan || (lokasi.kodeGedung !== undefined ? lokasi : null)

  let kodeGedung = ruangan?.kodeGedung || null
  if (!kodeGedung && lokasi.tempat?.gedung?.[0]?.kode) {
    kodeGedung = String(lokasi.tempat.gedung[0].kode)
  }
  if (!kodeGedung && lokasi.kodeGedung) {
    kodeGedung = String(lokasi.kodeGedung)
  }

  const lantaiRaw = ruangan ? ruangan.lantai : lokasi.lantai
  const lantai =
    typeof lantaiRaw === 'number' && Number.isInteger(lantaiRaw) ? lantaiRaw : null

  const namaRuangan = ruangan?.nama || null
  const namaGedung =
    lokasi.tempat?.nama ||
    (kodeGedung && FASILITAS_GEDUNG[kodeGedung]?.nama
      ? `Gedung ${FASILITAS_GEDUNG[kodeGedung].nama}`
      : null)

  return { kodeGedung, lantai, namaRuangan, namaGedung, isGps: false }
}

/**
 * Tentukan instruksi perpindahan lantai dan koneksi gedung antara titik asal dan tujuan.
 *
 * @param {object} asal Lokasi awal (GPS, tempat, atau ruangan)
 * @param {object} tujuan Lokasi tujuan (tempat atau ruangan)
 * @returns {{
 *   jenis: 'sama-gedung-sama-lantai' | 'sama-gedung-beda-lantai' | 'koneksi-langsung' | 'koneksi-beda-lantai' | 'beda-gedung' | 'tidak-diketahui',
 *   perluPindahLantai: boolean,
 *   fasilitasDigunakan: 'lift' | 'tangga' | null,
 *   langkah: string[],
 *   instruksiAsal: string | null,
 *   instruksiTujuan: string | null,
 *   instruksiKoneksi: string | null
 * }}
 */
export function tentukanNavigasiLantai(asal, tujuan) {
  const infoAsal = ekstrakInfoLokasi(asal)
  const infoTujuan = ekstrakInfoLokasi(tujuan)

  // 1. Jika asal adalah GPS: dilarang mengarang lantai pengguna
  if (infoAsal.isGps) {
    if (infoTujuan.lantai !== null && infoTujuan.lantai !== undefined) {
      const namaGedung = infoTujuan.namaGedung || 'gedung tujuan'
      const instruksiTujuan =
        infoTujuan.lantai > 1
          ? buatInstruksiPindahLantai(infoTujuan.kodeGedung, 1, infoTujuan.lantai, `Setelah masuk ${namaGedung}`)
          : null

      return {
        jenis: 'tidak-diketahui',
        perluPindahLantai: infoTujuan.lantai > 1,
        fasilitasDigunakan: infoTujuan.lantai > 1 ? (cekFasilitasLift(infoTujuan.kodeGedung, 1, infoTujuan.lantai) ? 'lift' : 'tangga') : null,
        langkah: instruksiTujuan ? [instruksiTujuan] : [],
        instruksiAsal: null,
        instruksiTujuan,
        instruksiKoneksi: null,
      }
    }

    return {
      jenis: 'tidak-diketahui',
      perluPindahLantai: false,
      fasilitasDigunakan: null,
      langkah: [],
      instruksiAsal: null,
      instruksiTujuan: null,
      instruksiKoneksi: null,
    }
  }

  // 2. Jika salah satu lantai tidak diketahui
  if (infoAsal.lantai === null || infoTujuan.lantai === null) {
    const langkah = []
    let instruksiTujuan = null
    let fasilitasDigunakan = null

    if (infoTujuan.lantai !== null && infoTujuan.lantai > 1) {
      const namaGedung = infoTujuan.namaGedung || 'gedung tujuan'
      instruksiTujuan = buatInstruksiPindahLantai(infoTujuan.kodeGedung, 1, infoTujuan.lantai, `Setelah masuk ${namaGedung}`)
      fasilitasDigunakan = cekFasilitasLift(infoTujuan.kodeGedung, 1, infoTujuan.lantai) ? 'lift' : 'tangga'
      langkah.push(instruksiTujuan)
    }

    return {
      jenis: 'tidak-diketahui',
      perluPindahLantai: Boolean(instruksiTujuan),
      fasilitasDigunakan,
      langkah,
      instruksiAsal: null,
      instruksiTujuan,
      instruksiKoneksi: null,
    }
  }

  // 3. Kasus Gedung Sama
  if (infoAsal.kodeGedung && infoTujuan.kodeGedung && infoAsal.kodeGedung === infoTujuan.kodeGedung) {
    if (infoAsal.lantai === infoTujuan.lantai) {
      return {
        jenis: 'sama-gedung-sama-lantai',
        perluPindahLantai: false,
        fasilitasDigunakan: null,
        langkah: [],
        instruksiAsal: null,
        instruksiTujuan: null,
        instruksiKoneksi: null,
      }
    }

    // Gedung sama, lantai berbeda
    const bisaLift = cekFasilitasLift(infoAsal.kodeGedung, infoAsal.lantai, infoTujuan.lantai)
    const fasilitas = bisaLift ? 'lift' : 'tangga'
    const instruksi = buatInstruksiPindahLantai(infoAsal.kodeGedung, infoAsal.lantai, infoTujuan.lantai)

    return {
      jenis: 'sama-gedung-beda-lantai',
      perluPindahLantai: true,
      fasilitasDigunakan: fasilitas,
      langkah: [instruksi],
      instruksiAsal: instruksi,
      instruksiTujuan: null,
      instruksiKoneksi: null,
    }
  }

  // 4. Periksa Koneksi Khusus Gedung (misal 010 ↔ 009 atau 011 ↔ 009)
  const koneksi = cariKoneksiGedung(infoAsal.kodeGedung, infoTujuan.kodeGedung)
  if (koneksi) {
    const formatNamaGedungKoneksi = (info) => {
      if (info.kodeGedung === '009') return 'Lab. Komputer'
      if (info.kodeGedung === '010' || info.kodeGedung === '011') return 'Lab. Biologi'
      return (
        info.namaGedung ||
        (FASILITAS_GEDUNG[info.kodeGedung]
          ? `Gedung ${FASILITAS_GEDUNG[info.kodeGedung].nama}`
          : 'gedung')
      )
    }

    const namaGedungAsal = formatNamaGedungKoneksi(infoAsal)
    const namaGedungTujuan = formatNamaGedungKoneksi(infoTujuan)

    // 4a. Pasangan koneksi pada lantai yang sama
    if (infoAsal.lantai === infoTujuan.lantai && koneksi.lantai.includes(infoAsal.lantai)) {
      const instruksiKoneksi = `Jalan lewat koridor penghubung lantai ${infoAsal.lantai} ${namaGedungAsal} dan ${namaGedungTujuan}.`
      return {
        jenis: 'koneksi-langsung',
        perluPindahLantai: false,
        fasilitasDigunakan: null,
        langkah: [instruksiKoneksi],
        instruksiAsal: null,
        instruksiTujuan: null,
        instruksiKoneksi,
      }
    }

    // 4b. Pasangan koneksi pada lantai yang berbeda
    // Aturan: pindah ke lantai yang sesuai terlebih dahulu, baru gunakan koneksi
    if (koneksi.lantai.includes(infoTujuan.lantai)) {
      // Pindah di gedung asal ke lantai tujuan, lalu seberangi koneksi
      const bisaLift = cekFasilitasLift(infoAsal.kodeGedung, infoAsal.lantai, infoTujuan.lantai)
      const fasilitas = bisaLift ? 'lift' : 'tangga'
      const instruksiPindah = buatInstruksiPindahLantai(
        infoAsal.kodeGedung,
        infoAsal.lantai,
        infoTujuan.lantai,
        `Di ${namaGedungAsal}`
      )
      const instruksiKoneksi = `Jalan lewat koridor penghubung lantai ${infoTujuan.lantai} ${namaGedungAsal} dan ${namaGedungTujuan}.`

      return {
        jenis: 'koneksi-beda-lantai',
        perluPindahLantai: true,
        fasilitasDigunakan: fasilitas,
        langkah: [instruksiPindah, instruksiKoneksi],
        instruksiAsal: instruksiPindah,
        instruksiTujuan: null,
        instruksiKoneksi,
      }
    } else if (koneksi.lantai.includes(infoAsal.lantai)) {
      // Seberangi koneksi di lantai asal, lalu di gedung tujuan pindah ke lantai tujuan
      const instruksiKoneksi = `Jalan lewat koridor penghubung lantai ${infoAsal.lantai} ${namaGedungAsal} dan ${namaGedungTujuan}.`
      const bisaLift = cekFasilitasLift(infoTujuan.kodeGedung, infoAsal.lantai, infoTujuan.lantai)
      const fasilitas = bisaLift ? 'lift' : 'tangga'
      const instruksiPindah = buatInstruksiPindahLantai(
        infoTujuan.kodeGedung,
        infoAsal.lantai,
        infoTujuan.lantai,
        `Setelah sampai di ${namaGedungTujuan}`
      )

      return {
        jenis: 'koneksi-beda-lantai',
        perluPindahLantai: true,
        fasilitasDigunakan: fasilitas,
        langkah: [instruksiKoneksi, instruksiPindah],
        instruksiAsal: null,
        instruksiTujuan: instruksiPindah,
        instruksiKoneksi,
      }
    } else {
      // Cari lantai koneksi terdekat
      const lantaiKoneksi = koneksi.lantai.reduce((terdekat, lt) =>
        Math.abs(lt - infoAsal.lantai) < Math.abs(terdekat - infoAsal.lantai) ? lt : terdekat
        , koneksi.lantai[0])

      const instruksiPindahAsal = buatInstruksiPindahLantai(
        infoAsal.kodeGedung,
        infoAsal.lantai,
        lantaiKoneksi,
        `Di ${namaGedungAsal}`
      )
      const instruksiKoneksi = `Jalan lewat koridor penghubung lantai ${lantaiKoneksi} ${namaGedungAsal} dan ${namaGedungTujuan}.`
      const instruksiPindahTujuan = buatInstruksiPindahLantai(
        infoTujuan.kodeGedung,
        lantaiKoneksi,
        infoTujuan.lantai,
        `Setelah sampai di ${namaGedungTujuan}`
      )

      return {
        jenis: 'koneksi-beda-lantai',
        perluPindahLantai: true,
        fasilitasDigunakan: 'tangga',
        langkah: [instruksiPindahAsal, instruksiKoneksi, instruksiPindahTujuan],
        instruksiAsal: instruksiPindahAsal,
        instruksiTujuan: instruksiPindahTujuan,
        instruksiKoneksi,
      }
    }
  }

  // 5. Kasus Gedung Berbeda Biasa (navigasi outdoor + instruksi lantai jika perlu)
  const langkah = []
  let instruksiAsal = null
  let instruksiTujuan = null
  let fasilitasUtama = null

  // Jika lantai asal > 1, pengguna perlu turun ke lantai 1 untuk keluar gedung
  if (infoAsal.lantai > 1) {
    const namaGedungAsal =
      infoAsal.namaGedung ||
      (FASILITAS_GEDUNG[infoAsal.kodeGedung]
        ? `Gedung ${FASILITAS_GEDUNG[infoAsal.kodeGedung].nama}`
        : 'gedung asal')
    const bisaLift = cekFasilitasLift(infoAsal.kodeGedung, infoAsal.lantai, 1)
    fasilitasUtama = bisaLift ? 'lift' : 'tangga'
    instruksiAsal = `Turun ke lantai 1 menggunakan ${bisaLift ? 'lift atau tangga' : 'tangga'} di ${namaGedungAsal} untuk keluar gedung.`
    langkah.push(instruksiAsal)
  }

  // Jika lantai tujuan > 1, pengguna perlu naik dari lantai 1 setelah masuk gedung tujuan
  if (infoTujuan.lantai > 1) {
    const namaGedungTujuan =
      infoTujuan.namaGedung ||
      (FASILITAS_GEDUNG[infoTujuan.kodeGedung]
        ? `Gedung ${FASILITAS_GEDUNG[infoTujuan.kodeGedung].nama}`
        : 'gedung tujuan')
    const bisaLift = cekFasilitasLift(infoTujuan.kodeGedung, 1, infoTujuan.lantai)
    if (!fasilitasUtama) fasilitasUtama = bisaLift ? 'lift' : 'tangga'
    instruksiTujuan = `Setelah masuk ${namaGedungTujuan}, naik ke lantai ${infoTujuan.lantai} menggunakan ${bisaLift ? 'lift atau tangga' : 'tangga'}.`
    langkah.push(instruksiTujuan)
  }

  return {
    jenis: 'beda-gedung',
    perluPindahLantai: langkah.length > 0,
    fasilitasDigunakan: fasilitasUtama,
    langkah,
    instruksiAsal,
    instruksiTujuan,
    instruksiKoneksi: null,
  }
}

/**
 * Format teks instruksi perpindahan lantai dalam satu gedung.
 */
function buatInstruksiPindahLantai(kodeGedung, lantaiAsal, lantaiTujuan, awalan = '') {
  const kataArah = lantaiTujuan > lantaiAsal ? 'naik' : 'turun'
  const arah = awalan ? kataArah : kataArah.charAt(0).toUpperCase() + kataArah.slice(1)
  const bisaLift = cekFasilitasLift(kodeGedung, lantaiAsal, lantaiTujuan)
  const teksFasilitas = bisaLift ? 'lift atau tangga' : 'tangga'
  const prefix = awalan ? `${awalan}, ` : ''
  return `${prefix}${arah} ke lantai ${lantaiTujuan} menggunakan ${teksFasilitas}.`
}
