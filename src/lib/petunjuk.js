// petunjuk.js — Penyusunan petunjuk rute pejalan kaki berbasis geometri nyata dan poligon gedung.
// Aturan:
// 1. Deteksi belokan pada geometri garis hasil geometriRute (resample ~3 m, window ~8-10 m).
// 2. Pecah langkah saat selisih bearing >= SUDUT_BELOK (45 derajat) dan bertahan.
// 3. Langkah boleh berakhir di tengah ruas; teks "menuju <nama>" HANYA jika berakhir di pintu tempat.
// 4. Penanda: sampel ~5 m sepanjang langkah. "lewat selasar" jika >= 60% sampel di dalam poligon.
//    "menyusuri sisi <arah>" jika mayoritas dalam JARAK_PENANDA (15 m).
//    Arah sisi dihitung dari titik terdekat batas poligon ke titik jalur.
// 5. Tempat tanpa kode gedung (taman, dsb) memakai teks "melewati <nama>".
// 6. Jika di beberapa poligon, pilih luas terkecil.
// 7. Jangan sebut penanda yang sama dengan asal/tujuan langkah.
// 8. MIN_PANJANG_LANGKAH = 6 m (langkah lebih pendek digabung ke tetangga).

import { haversineDistance } from './graph'
import { bearing, namaArah } from './geo'
import { formatJarak } from './format'
import { namaTitik } from './places'
import { geometriRute } from './routing'

export const SUDUT_BELOK = 45
export const JARAK_PENANDA = 15
export const MIN_PANJANG_LANGKAH = 6
export const INTERVAL_SAMPEL_BELOK = 3
export const JENDELA_BEARING = 9
export const INTERVAL_SAMPEL_PENANDA = 5

/** Selisih sudut ternormalisasi [-180, 180] */
export function hitungSelisihSudut(bPrev, bCurr) {
  return ((((bCurr - bPrev + 540) % 360) + 360) % 360) - 180
}

/** Tentukan arah belokan relatif: 'kanan', 'kiri', atau null */
export function tentukanBelokan(bPrev, bCurr, minSudut = 25) {
  if (bPrev == null || !Number.isFinite(bPrev)) return null
  const delta = hitungSelisihSudut(bPrev, bCurr)
  if (delta >= minSudut) return 'kanan'
  if (delta <= -minSudut) return 'kiri'
  return null
}

/** Hitung luas poligon dalam meter persegi datar (metode shoelace) */
export function luasPoligon(ring) {
  if (!ring || ring.length < 3) return 0
  const lat0 = ring[0][1]
  const mLat = 110540.0
  const mLon = 111320.0 * Math.cos((lat0 * Math.PI) / 180.0)

  let area = 0
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i, i += 1) {
    const xi = ring[i][0] * mLon
    const yi = ring[i][1] * mLat
    const xj = ring[j][0] * mLon
    const yj = ring[j][1] * mLat
    area += (xj + xi) * (yj - yi)
  }
  return Math.abs(area) / 2.0
}

/** Cek titik di dalam cincin poligon (ray casting) */
function titikDiCincin(lon, lat, ring) {
  let diDalam = false
  const eps = 1e-12
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i, i += 1) {
    const [xi, yi] = ring[i]
    const [xj, yj] = ring[j]
    const silang = (yi - lat) * (xj - xi) - (xi - lon) * (yj - yi)
    const diSegmen =
      Math.abs(silang) <= eps &&
      lon >= Math.min(xi, xj) - eps &&
      lon <= Math.max(xi, xj) + eps &&
      lat >= Math.min(yi, yj) - eps &&
      lat <= Math.max(yi, yj) + eps
    if (diSegmen) return true

    const memotong = (yi > lat) !== (yj > lat)
    if (memotong) {
      const xPotong = ((xj - xi) * (lat - yi)) / (yj - yi) + xi
      if (lon < xPotong) diDalam = !diDalam
    }
  }
  return diDalam
}

/** Cek apakah titik [lon, lat] di dalam poligon GeoJSON */
export function titikDiPoligon(lon, lat, coordinates) {
  if (!coordinates?.length) return false
  if (!titikDiCincin(lon, lat, coordinates[0])) return false
  for (const lubang of coordinates.slice(1)) {
    if (titikDiCincin(lon, lat, lubang)) return false
  }
  return true
}

/**
 * Jarak ortogonal dari titik P ke segmen garis AB (meter).
 * Mengembalikan { dist, projLat, projLon }.
 */
export function jarakTitikKeSegmen(pLat, pLon, aLat, aLon, bLat, bLon) {
  const mLat = 110540.0
  const mLon = 111320.0 * Math.cos((aLat * Math.PI) / 180.0)

  const dx = (bLon - aLon) * mLon
  const dy = (bLat - aLat) * mLat
  const px = (pLon - aLon) * mLon
  const py = (pLat - aLat) * mLat

  const lenSq = dx * dx + dy * dy
  if (lenSq === 0) {
    return {
      dist: Math.hypot(px, py),
      projLat: aLat,
      projLon: aLon,
    }
  }

  const t = Math.max(0, Math.min(1, (px * dx + py * dy) / lenSq))
  const projX = t * dx
  const projY = t * dy
  return {
    dist: Math.hypot(px - projX, py - projY),
    projLat: aLat + (t * (bLat - aLat)),
    projLon: aLon + (t * (bLon - aLon)),
  }
}

/**
 * Jarak minimum dan titik batas terdekat dari titik P ke batas luar poligon.
 * Mengembalikan { dist, projLat, projLon }.
 */
export function jarakKeBatasPoligon(lat, lon, ring) {
  let minD = Infinity
  let bestProj = { projLat: ring[0][1], projLon: ring[0][0] }
  for (let i = 0; i < ring.length - 1; i += 1) {
    const res = jarakTitikKeSegmen(lat, lon, ring[i][1], ring[i][0], ring[i + 1][1], ring[i + 1][0])
    if (res.dist < minD) {
      minD = res.dist
      bestProj = { projLat: res.projLat, projLon: res.projLon }
    }
  }
  return { dist: minD, ...bestProj }
}

/**
 * Membangun profil jarak kumulatif dari garis poliline [[lat, lon], ...].
 * Mengembalikan { panjangTotal, distKumulatif }.
 */
export function profilJarakGaris(garis) {
  const dist = [0]
  let total = 0
  for (let i = 0; i < garis.length - 1; i += 1) {
    const d = haversineDistance(garis[i][0], garis[i][1], garis[i + 1][0], garis[i + 1][1])
    total += d
    dist.push(total)
  }
  return { panjangTotal: total, distKumulatif: dist }
}

/**
 * Interpolasi titik { lat, lon } pada jarak s meter dari awal garis.
 */
export function interpolasiPadaJarak(garis, distKumulatif, s) {
  if (garis.length === 0) return null
  if (garis.length === 1 || s <= 0) return { lat: garis[0][0], lon: garis[0][1] }
  const total = distKumulatif[distKumulatif.length - 1]
  if (s >= total) return { lat: garis[garis.length - 1][0], lon: garis[garis.length - 1][1] }

  // Binary search interval
  let low = 0
  let high = distKumulatif.length - 1
  while (low <= high) {
    const mid = (low + high) >> 1
    if (distKumulatif[mid] <= s) low = mid + 1
    else high = mid - 1
  }
  const idx = Math.max(0, high)
  const d0 = distKumulatif[idx]
  const d1 = distKumulatif[idx + 1]
  const t = d1 > d0 ? (s - d0) / (d1 - d0) : 0

  return {
    lat: garis[idx][0] + t * (garis[idx + 1][0] - garis[idx][0]),
    lon: garis[idx][1] + t * (garis[idx + 1][1] - garis[idx][1]),
  }
}

/**
 * Cari penanda untuk satu langkah rute berdasarkan sampel titik di sepanjang langkah.
 */
export function cariPenandaLangkah({
  garis,
  distKumulatif,
  sAwal,
  sAkhir,
  poligonGeoJson,
  daftarTempat,
  tempatDikecualikan = new Set(),
  jarakPenanda = JARAK_PENANDA,
}) {
  if (!poligonGeoJson?.features || !daftarTempat?.length) return null

  // Siapkan data poligon terindeks
  const tempatByPoligon = new Map(
    daftarTempat
      .filter((t) => t.poligon != null)
      .map((t) => [String(t.poligon), t])
  )

  const kandidatPoligon = poligonGeoJson.features
    .map((f) => {
      const t = tempatByPoligon.get(String(f.properties?.id))
      if (!t || tempatDikecualikan.has(t.id)) return null
      const ring = f.geometry?.coordinates?.[0]
      if (!ring) return null
      const luas = luasPoligon(ring)
      return { feature: f, tempat: t, ring, luas, coordinates: f.geometry.coordinates }
    })
    .filter(Boolean)

  if (kandidatPoligon.length === 0) return null

  // Sampel titik setiap ~5 m sepanjang langkah
  const lenLangkah = sAkhir - sAwal
  const nSampel = Math.max(1, Math.round(lenLangkah / INTERVAL_SAMPEL_PENANDA))
  const sampelTitik = []
  for (let k = 0; k < nSampel; k += 1) {
    const s = sAwal + ((k + 0.5) * lenLangkah) / nSampel
    sampelTitik.push(interpolasiPadaJarak(garis, distKumulatif, s))
  }

  // Hitung kedekatan tiap sampel dengan kandidat poligon
  const perKandidat = new Map()
  for (const k of kandidatPoligon) {
    perKandidat.set(k.tempat.id, {
      kandidat: k,
      insideCount: 0,
      dekatCount: 0,
      totalCount: nSampel,
      vektorSisi: [],
    })
  }

  // Untuk setiap sampel, tentukan kandidat terbaik
  const suaraTerdekat = new Map() // tempatId -> count

  for (const p of sampelTitik) {
    let bestInside = null
    let bestOutside = null
    let minD = Infinity
    let bestProj = null

    for (const k of kandidatPoligon) {
      const isInside = titikDiPoligon(p.lon, p.lat, k.coordinates)
      if (isInside) {
        if (!bestInside || k.luas < bestInside.luas) {
          bestInside = k
        }
      } else {
        const res = jarakKeBatasPoligon(p.lat, p.lon, k.ring)
        if (res.dist < minD) {
          minD = res.dist
          bestOutside = k
          bestProj = { lat: res.projLat, lon: res.projLon }
        }
      }
    }

    if (bestInside) {
      const rec = perKandidat.get(bestInside.tempat.id)
      rec.insideCount += 1
      rec.dekatCount += 1
      suaraTerdekat.set(bestInside.tempat.id, (suaraTerdekat.get(bestInside.tempat.id) || 0) + 1)
    } else if (bestOutside && minD <= jarakPenanda) {
      const rec = perKandidat.get(bestOutside.tempat.id)
      rec.dekatCount += 1
      rec.vektorSisi.push({ p, proj: bestProj })
      suaraTerdekat.set(bestOutside.tempat.id, (suaraTerdekat.get(bestOutside.tempat.id) || 0) + 1)
    }
  }

  // Cari tempat yang paling sering terdekat
  let pemenangId = null
  let maxSuara = 0
  for (const [id, count] of suaraTerdekat.entries()) {
    if (count > maxSuara) {
      maxSuara = count
      pemenangId = id
    }
  }

  if (!pemenangId) return null
  const dataPemenang = perKandidat.get(pemenangId)
  const { kandidat, insideCount, dekatCount, totalCount, vektorSisi } = dataPemenang
  const persenInside = insideCount / totalCount
  const persenDekat = dekatCount / totalCount

  // Aturan 2 & 4:
  // - "lewat selasar" hanya bila >= 60% sampel di dalam poligon gedung
  // - "melewati <nama>" bila >= 60% sampel di dalam poligon non-gedung (taman, dsb)
  const isGedung = Boolean(kandidat.tempat.gedung?.length)

  if (persenInside >= 0.6) {
    if (isGedung) {
      return {
        jenis: 'selasar',
        tempat: kandidat.tempat,
        teks: `lewat selasar ${kandidat.tempat.nama}`,
      }
    }
    return {
      jenis: 'melewati',
      tempat: kandidat.tempat,
      teks: `melewati ${kandidat.tempat.nama}`,
    }
  }

  // - Selain itu "menyusuri sisi" bila mayoritas (> 50%) sampel dalam JARAK_PENANDA (15 m)
  if (persenDekat > 0.5) {
    // Aturan 3: Bearing dari titik terdekat di batas poligon ke titik jalur
    let bSisi
    if (vektorSisi.length > 0) {
      const midVektor = vektorSisi[Math.floor(vektorSisi.length / 2)]
      bSisi = bearing(midVektor.proj.lat, midVektor.proj.lon, midVektor.p.lat, midVektor.p.lon)
    } else {
      // Fallback midpoint
      const pMid = interpolasiPadaJarak(garis, distKumulatif, (sAwal + sAkhir) / 2)
      const res = jarakKeBatasPoligon(pMid.lat, pMid.lon, kandidat.ring)
      bSisi = bearing(res.projLat, res.projLon, pMid.lat, pMid.lon)
    }
    const arahSisi = namaArah(bSisi)
    return {
      jenis: 'sisi',
      tempat: kandidat.tempat,
      arahSisi,
      teks: `menyusuri sisi ${arahSisi} ${kandidat.tempat.nama}`,
    }
  }

  return null
}

/**
 * Susun petunjuk rute pejalan kaki lengkap berbasis geometri garis dan poligon.
 */
export function susunPetunjukRute({
  rute,
  indeks,
  graphData,
  konteks = {},
}) {
  const { pointsById } = graphData
  const { edges, poligon, tempat } = konteks

  const namaAwal = namaTitik(indeks, rute.path[0])
  const langkah = [
    {
      jenis: 'mulai',
      teks: `Mulai dari ${namaAwal}`,
      titikId: rute.path[0],
    },
  ]

  if (rute.path.length <= 1) return langkah

  // Jika konteks tidak lengkap, gunakan fallback teks arah dasar
  const pakaiGeometri = Boolean(edges && poligon && tempat)
  if (!pakaiGeometri) {
    return fallbackLangkahRute(rute, indeks, graphData)
  }

  // 1. Dapatkan geometri rute lengkap
  const garis = geometriRute(rute, edges, pointsById)
  const { panjangTotal, distKumulatif } = profilJarakGaris(garis)

  // 2. Hitung posisi jarak tiap simpul rute.path pada garis kumulatif
  // Setiap simpul path[k] memiliki jarak kumulatif edge weights
  const distSimpul = [0]
  let acc = 0
  for (let i = 0; i < rute.path.length - 1; i += 1) {
    const eId = Number(rute.edgeIds[i])
    const edgeObj = (graphData.graph[rute.path[i]] || []).find((e) => Number(e.edgeId) === eId)
    const w = edgeObj ? edgeObj.weight : haversineDistance(
      pointsById[rute.path[i]].lat,
      pointsById[rute.path[i]].lon,
      pointsById[rute.path[i + 1]].lat,
      pointsById[rute.path[i + 1]].lon
    )
    acc += w
    distSimpul.push(acc)
  }

  // Catat titik-titik pintu perantara
  const pintuDistances = new Set()
  const pintuTempatMap = new Map() // s -> tempat
  for (let i = 1; i < rute.path.length; i += 1) {
    const pId = Number(rute.path[i])
    if (indeks.byTitik.has(pId)) {
      const s = distSimpul[i]
      pintuDistances.add(s)
      pintuTempatMap.set(s, indeks.byTitik.get(pId))
    }
  }

  // 3. Resample ~3 m dan hitung bearing jendela ~8-10 m
  const stepInterval = INTERVAL_SAMPEL_BELOK
  const nSampel = Math.max(1, Math.ceil(panjangTotal / stepInterval))
  const sampelS = []
  for (let i = 0; i <= nSampel; i += 1) {
    sampelS.push(Math.min(panjangTotal, i * stepInterval))
  }
  if (sampelS[sampelS.length - 1] < panjangTotal) sampelS.push(panjangTotal)

  const sampelBearing = []
  for (let i = 0; i < sampelS.length; i += 1) {
    const s0 = sampelS[i]
    const s1 = Math.min(panjangTotal, s0 + JENDELA_BEARING)
    let p0 = interpolasiPadaJarak(garis, distKumulatif, s0)
    let p1 = interpolasiPadaJarak(garis, distKumulatif, s1)
    if (s1 - s0 < 2.0 && s0 > 0) {
      // Dekat ujung akhir: tengok ke belakang
      const sBack = Math.max(0, s0 - JENDELA_BEARING)
      p0 = interpolasiPadaJarak(garis, distKumulatif, sBack)
      p1 = interpolasiPadaJarak(garis, distKumulatif, s0)
    }
    sampelBearing.push(bearing(p0.lat, p0.lon, p1.lat, p1.lon))
  }

  // 4. Deteksi belokan dan pecah langkah
  // Bandingkan terhadap arah dasar langkah berjalan (baseBearing), pecah jika selisih >= 45 derajat bertahan
  const batasLangkah = [0]
  let sStart = 0
  let baseBearing = sampelBearing[0]

  let i = 1
  while (i < sampelS.length) {
    const sCurr = sampelS[i]

    // Cek apakah melewati pintu tempat di antara sStart dan sCurr
    let adaPintu = false
    let sPintu = null
    for (const sP of pintuDistances) {
      if (sP > sStart && sP <= sCurr) {
        adaPintu = true
        sPintu = sP
        break
      }
    }

    if (adaPintu && sPintu != null) {
      if (sPintu - sStart >= 1.0) {
        batasLangkah.push(sPintu)
        sStart = sPintu
        // Cari idx sampel terdekat
        while (i < sampelS.length && sampelS[i] <= sStart) i += 1
        const idxBaru = Math.max(0, i - 1)
        baseBearing = sampelBearing[idxBaru]
        continue
      }
    }

    // Cek selisih bearing terhadap baseBearing
    const delta = Math.abs(hitungSelisihSudut(baseBearing, sampelBearing[i]))
    if (delta >= SUDUT_BELOK) {
      // Cek apakah bertahan beberapa meter (setidaknya 2 sampel berturut-turut atau hingga ujung)
      const iNext = Math.min(sampelS.length - 1, i + 1)
      const deltaNext = Math.abs(hitungSelisihSudut(baseBearing, sampelBearing[iNext]))
      if (deltaNext >= SUDUT_BELOK || iNext === sampelS.length - 1) {
        // Terjadi belokan! Pecah di sCurr
        if (sCurr - sStart >= 2.0) {
          batasLangkah.push(sCurr)
          sStart = sCurr
          baseBearing = sampelBearing[i]
          i += 1
          continue
        }
      }
    }

    i += 1
  }

  if (batasLangkah[batasLangkah.length - 1] < panjangTotal) {
    batasLangkah.push(panjangTotal)
  }

  // 5. Gabung langkah < MIN_PANJANG_LANGKAH (6 m) ke tetangga
  let interval = []
  for (let k = 0; k < batasLangkah.length - 1; k += 1) {
    interval.push({ sAwal: batasLangkah[k], sAkhir: batasLangkah[k + 1] })
  }

  // Jika langkah pertama merupakan spur pendek keluar dari pintu (< 15 m) dan berlanjut ke koridor:
  if (interval.length > 1 && (interval[0].sAkhir - interval[0].sAwal) < 15) {
    interval[1].sAwal = interval[0].sAwal
    interval.shift()
  }

  let berubah = true
  while (berubah && interval.length > 1) {
    berubah = false
    for (let k = 0; k < interval.length; k += 1) {
      const p = interval[k].sAkhir - interval[k].sAwal
      if (p < MIN_PANJANG_LANGKAH && interval.length > 1) {
        if (k > 0) {
          interval[k - 1].sAkhir = interval[k].sAkhir
          interval.splice(k, 1)
        } else {
          interval[k + 1].sAwal = interval[k].sAwal
          interval.splice(k, 1)
        }
        berubah = true
        break
      }
    }
  }

  // 6. Tentukan tempat asal dan tujuan route untuk pengecualian penanda
  const tempatAsal = indeks.byTitik.get(Number(rute.path[0]))
  const tempatTujuan = indeks.byTitik.get(Number(rute.path.at(-1)))
  const tempatDikecualikan = new Set([tempatAsal?.id, tempatTujuan?.id].filter(Boolean))

  // 7. Susun teks tiap langkah
  let bSebelum = null

  for (let k = 0; k < interval.length; k += 1) {
    const { sAwal, sAkhir } = interval[k]
    const jarakLangkah = sAkhir - sAwal
    const isTerakhir = k === interval.length - 1

    const pAwal = interpolasiPadaJarak(garis, distKumulatif, sAwal)
    const pAkhir = interpolasiPadaJarak(garis, distKumulatif, sAkhir)
    const bLangkah = bearing(pAwal.lat, pAwal.lon, pAkhir.lat, pAkhir.lon)
    const arahLangkah = namaArah(bLangkah)

    // Belokan relatif
    const belokan = tentukanBelokan(bSebelum, bLangkah)
    bSebelum = bLangkah

    // Penanda
    const penanda = cariPenandaLangkah({
      garis,
      distKumulatif,
      sAwal,
      sAkhir,
      poligonGeoJson: poligon,
      daftarTempat: tempat,
      tempatDikecualikan,
    })

    // Tindakan dasar
    let aksi
    if (k === 0) {
      aksi = `Jalan ke arah ${arahLangkah}`
    } else if (belokan === 'kanan') {
      aksi = `Belok kanan ke arah ${arahLangkah}`
    } else if (belokan === 'kiri') {
      aksi = `Belok kiri ke arah ${arahLangkah}`
    } else {
      aksi = `Lanjut ke arah ${arahLangkah}`
    }

    // Tambah penanda jika ada
    let teksLangkah = penanda ? `${aksi} ${penanda.teks}` : aksi

    // Cek apakah langkah berakhir di pintu tempat
    // Teks "menuju <nama>" hanya untuk langkah yang berakhir di pintu tempat
    let pintuTujuan = null
    for (const [sP, t] of pintuTempatMap.entries()) {
      if (Math.abs(sP - sAkhir) < 2.0) {
        pintuTujuan = t
        break
      }
    }
    if (isTerakhir && !pintuTujuan && tempatTujuan) {
      pintuTujuan = tempatTujuan
    }

    if (pintuTujuan) {
      teksLangkah = `${teksLangkah} menuju ${pintuTujuan.nama}`
    }

    // Temukan titikId representatif
    const titikId = isTerakhir ? rute.path.at(-1) : interpolasiTitikId(distSimpul, rute.path, sAkhir)

    langkah.push({
      jenis: isTerakhir ? 'tiba' : 'jalan',
      teks: teksLangkah,
      arah: arahLangkah,
      belokan,
      penanda: penanda?.teks || null,
      jarak: jarakLangkah,
      jarakTeks: formatJarak(jarakLangkah),
      titikId,
    })
  }

  return langkah
}

/** Cari node id terdekat di rute.path untuk jarak s */
function interpolasiTitikId(distSimpul, path, s) {
  let minDiff = Infinity
  let bestId = path[0]
  for (let i = 0; i < distSimpul.length; i += 1) {
    const diff = Math.abs(distSimpul[i] - s)
    if (diff < minDiff) {
      minDiff = diff
      bestId = path[i]
    }
  }
  return bestId
}

/** Fallback penyusunan langkah dasar jika konteks tidak diberikan */
export function fallbackLangkahRute(rute, indeks, graphData) {
  const { graph, pointsById } = graphData
  const langkah = [{ jenis: 'mulai', teks: `Mulai dari ${namaTitik(indeks, rute.path[0])}`, titikId: rute.path[0] }]
  if (rute.path.length <= 1) return langkah

  const segmen = []
  for (let i = 0; i < rute.path.length - 1; i += 1) {
    const a = pointsById[rute.path[i]]
    const b = pointsById[rute.path[i + 1]]
    const edge = (graph[rute.path[i]] || []).find((e) => Number(e.edgeId) === Number(rute.edgeIds[i]))
    const jarak = edge ? edge.weight : haversineDistance(a.lat, a.lon, b.lat, b.lon)
    const keId = rute.path[i + 1]
    const adalahPintu = indeks.byTitik.has(Number(keId))
    segmen.push({ dariId: rute.path[i], keId, jarak, adalahPintu })
  }

  const ambilArah = (dariId, keId) => {
    const a = pointsById[dariId]
    const b = pointsById[keId]
    return namaArah(bearing(a.lat, a.lon, b.lat, b.lon))
  }

  let currentGroup = {
    dariId: segmen[0].dariId,
    keId: segmen[0].keId,
    jarak: segmen[0].jarak,
    adalahPintu: segmen[0].adalahPintu,
  }

  for (let i = 1; i < segmen.length; i += 1) {
    const s = segmen[i]
    if (currentGroup.adalahPintu) {
      const arah = ambilArah(currentGroup.dariId, currentGroup.keId)
      langkah.push({
        jenis: 'jalan',
        teks: `Jalan ke arah ${arah} menuju ${namaTitik(indeks, currentGroup.keId)}`,
        arah,
        jarak: currentGroup.jarak,
        jarakTeks: formatJarak(currentGroup.jarak),
        titikId: currentGroup.keId,
      })
      currentGroup = {
        dariId: s.dariId,
        keId: s.keId,
        jarak: s.jarak,
        adalahPintu: s.adalahPintu,
      }
    } else {
      currentGroup.jarak += s.jarak
      currentGroup.keId = s.keId
      currentGroup.adalahPintu = s.adalahPintu
    }
  }

  const arahAkhir = ambilArah(currentGroup.dariId, currentGroup.keId)
  langkah.push({
    jenis: 'tiba',
    teks: `Jalan ke arah ${arahAkhir} menuju ${namaTitik(indeks, currentGroup.keId)}`,
    arah: arahAkhir,
    jarak: currentGroup.jarak,
    jarakTeks: formatJarak(currentGroup.jarak),
    titikId: currentGroup.keId,
  })

  return langkah
}
