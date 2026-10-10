#!/usr/bin/env node
/**
 * scripts/bangun-jaringan.mjs
 * 
 * Skrip pembangun topologi jaringan jalan pejalan kaki FMIPA Unimed.
 * Membaca data mentah dari scripts/data-mentah/edges_raw.geojson dan
 * menghasilkan topologi simpul & ruas jalan sesuai standar frontend.
 * 
 * Penggunaan:
 *   node scripts/bangun-jaringan.mjs          # Mode Kering (Dry-run, hanya analisa dan laporan)
 *   node scripts/bangun-jaringan.mjs --tulis  # Mode Tulis (Mencadangkan file lama & memperbarui src/data/)
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const ROOT_DIR = resolve(__dirname, '..')

// Path berkas
const PATH_EDGES_RAW = resolve(ROOT_DIR, 'scripts/data-mentah/edges_raw.geojson')
const PATH_KOORDINAT_SRC = resolve(ROOT_DIR, 'src/data/koordinat_fmipa.geojson')
const PATH_EDGES_SRC = resolve(ROOT_DIR, 'src/data/edges_fmipa.geojson')
const PATH_TEMPAT_SRC = resolve(ROOT_DIR, 'src/data/tempat.json')
const DIR_CADANGAN = resolve(ROOT_DIR, 'scripts/cadangan')

// Konstanta proyeksi planar lokal untuk area FMIPA Unimed (~3.607° N, 98.715° E)
const LAT0 = 3.6070
const LON0 = 98.7150
const METERS_PER_LAT = 110540.0
const METERS_PER_LON = 111320.0 * Math.cos((LAT0 * Math.PI) / 180.0)

/** Konversi [lon, lat] ke [x, y] meter relatif dari titik asal lokal */
function toLocalMeters([lon, lat]) {
  return [
    (lon - LON0) * METERS_PER_LON,
    (lat - LAT0) * METERS_PER_LAT,
  ]
}

/** Konversi [x, y] meter ke [lon, lat] */
function toGeoCoordinates([x, y]) {
  return [
    LON0 + x / METERS_PER_LON,
    LAT0 + y / METERS_PER_LAT,
  ]
}

/** Jarak Euclidean dalam meter */
function distanceMeters([x1, y1], [x2, y2]) {
  return Math.hypot(x1 - x2, y1 - y2)
}

/**
 * Proyeksi ortogonal sebuah titik P ke segmen garis AB.
 * Mengembalikan parameter t (0 = A, 1 = B), titik proyeksi terdekat proj, dan jaraknya ke P.
 */
function projectPointToSegment(P, A, B) {
  const dx = B[0] - A[0]
  const dy = B[1] - A[1]
  const L2 = dx * dx + dy * dy
  if (L2 === 0) {
    return { t: 0, proj: A, dist: distanceMeters(P, A) }
  }
  const t = ((P[0] - A[0]) * dx + (P[1] - A[1]) * dy) / L2
  const clampedT = Math.max(0, Math.min(1, t))
  const proj = [A[0] + clampedT * dx, A[1] + clampedT * dy]
  return { t: clampedT, rawT: t, proj, dist: distanceMeters(P, proj) }
}

/**
 * Membaca data mentah dan data referensi
 */
function muatData() {
  if (!existsSync(PATH_EDGES_RAW)) {
    console.error(`[GALAT] Berkas tidak ditemukan: ${PATH_EDGES_RAW}`)
    process.exit(1)
  }
  if (!existsSync(PATH_KOORDINAT_SRC)) {
    console.error(`[GALAT] Berkas referensi tidak ditemukan: ${PATH_KOORDINAT_SRC}`)
    process.exit(1)
  }

  const rawEdges = JSON.parse(readFileSync(PATH_EDGES_RAW, 'utf8'))
  const refKoordinat = JSON.parse(readFileSync(PATH_KOORDINAT_SRC, 'utf8'))
  const refTempat = existsSync(PATH_TEMPAT_SRC)
    ? JSON.parse(readFileSync(PATH_TEMPAT_SRC, 'utf8'))
    : null

  return { rawEdges, refKoordinat, refTempat }
}

/**
 * Memproses topologi jaringan jalan sesuai keputusan teknis
 */
function prosesJaringan(rawEdges, refKoordinat) {
  // 1. Ambil daftar pintu gedung referensi (ID 1 sampai 18)
  const doorPoints = refKoordinat.features
    .filter((f) => {
      const id = Number(f.properties.id)
      return id >= 1 && id <= 18
    })
    .map((f) => {
      const id = Number(f.properties.id)
      const coord = [Number(f.geometry.coordinates[0]), Number(f.geometry.coordinates[1])]
      return {
        id,
        coord,
        m: toLocalMeters(coord),
      }
    })
    .sort((a, b) => a.id - b.id)

  if (doorPoints.length !== 18) {
    console.warn(`[PERINGATAN] Jumlah titik pintu referensi: ${doorPoints.length} (diharapkan 18)`)
  }

  // 2. Baca seluruh garis dari edges_raw.geojson
  let lines = rawEdges.features.map((f, idx) => ({
    rawIdx: idx,
    coords: f.geometry.coordinates.map((c) => toLocalMeters([Number(c[0]), Number(c[1])])),
  }))

  // 3. Keputusan 1: Pecah otomatis ruas di setiap vertex interior yang berimpit dengan titik pintu 1-18 (toleransi 0,05 m)
  const linesAfterDoorSplit = []
  const laporanPintuDipecah = []

  lines.forEach((lineObj) => {
    const line = lineObj.coords
    const splitIndices = [{ idx: 0, pt: line[0] }]

    for (let i = 1; i < line.length - 1; i += 1) {
      const pt = line[i]
      const door = doorPoints.find((d) => distanceMeters(d.m, pt) <= 0.05)
      if (door) {
        splitIndices.push({ idx: i, pt: door.m, doorId: door.id, doorCoord: door.coord })
        laporanPintuDipecah.push({
          doorId: door.id,
          rawFeatureIdx: lineObj.rawIdx,
          coordIdx: i,
          coordGeo: toGeoCoordinates(pt),
          doorCoord: door.coord,
        })
      }
    }
    splitIndices.push({ idx: line.length - 1, pt: line[line.length - 1] })

    for (let s = 0; s < splitIndices.length - 1; s += 1) {
      const sub = line.slice(splitIndices[s].idx, splitIndices[s + 1].idx + 1)
      // Selaraskan koordinat ujung jika berimpit dengan pintu
      if (splitIndices[s].doorId) sub[0] = splitIndices[s].pt
      if (splitIndices[s + 1].doorId) sub[sub.length - 1] = splitIndices[s + 1].pt

      linesAfterDoorSplit.push({
        rawIdx: lineObj.rawIdx,
        coords: sub,
      })
    }
  })

  // 4. Keputusan 2: Noding T-junction (ujung ruas berjarak <= 0,5 m dari bagian dalam ruas lain)
  let currentLines = linesAfterDoorSplit.map((l) => ({ ...l, coords: [...l.coords] }))
  const laporanTNoding = []

  let changed = true
  let iter = 0
  const MAX_ITER = 20

  while (changed && iter < MAX_ITER) {
    changed = false
    iter += 1

    let bestCandidate = null

    for (let i = 0; i < currentLines.length; i += 1) {
      const l1 = currentLines[i].coords
      const endpoints = [
        { isStart: true, pt: l1[0] },
        { isStart: false, pt: l1[l1.length - 1] },
      ]

      for (const ep of endpoints) {
        for (let j = 0; j < currentLines.length; j += 1) {
          if (i === j) continue
          const l2 = currentLines[j].coords

          for (let s = 0; s < l2.length - 1; s += 1) {
            const A = l2[s]
            const B = l2[s + 1]
            const res = projectPointToSegment(ep.pt, A, B)

            // Syarat bagian dalam: jarak titik proyeksi ke A dan B harus > 0.05 m
            const distFromA = distanceMeters(res.proj, A)
            const distFromB = distanceMeters(res.proj, B)

            if (res.rawT > 0.001 && res.rawT < 0.999 && distFromA > 0.05 && distFromB > 0.05) {
              if (res.dist <= 0.5) {
                if (!bestCandidate || res.dist < bestCandidate.dist) {
                  bestCandidate = {
                    sourceLineIdx: i,
                    isStart: ep.isStart,
                    targetLineIdx: j,
                    segIdx: s,
                    proj: res.proj,
                    dist: res.dist,
                    sourceRawIdx: currentLines[i].rawIdx,
                    targetRawIdx: currentLines[j].rawIdx,
                  }
                }
              }
            }
          }
        }
      }
    }

    if (bestCandidate) {
      changed = true
      const { sourceLineIdx, isStart, targetLineIdx, segIdx, proj, dist, sourceRawIdx, targetRawIdx } = bestCandidate

      // Tempelkan ujung ruas sumber ke titik proyeksi
      if (isStart) {
        currentLines[sourceLineIdx].coords[0] = proj
      } else {
        currentLines[sourceLineIdx].coords[currentLines[sourceLineIdx].coords.length - 1] = proj
      }

      // Pecah ruas target di titik proyeksi
      const targetCoords = currentLines[targetLineIdx].coords
      const part1 = [...targetCoords.slice(0, segIdx + 1), proj]
      const part2 = [proj, ...targetCoords.slice(segIdx + 1)]

      currentLines.splice(
        targetLineIdx,
        1,
        { rawIdx: targetRawIdx, coords: part1 },
        { rawIdx: targetRawIdx, coords: part2 }
      )

      laporanTNoding.push({
        sourceRawIdx,
        targetRawIdx,
        projGeo: toGeoCoordinates(proj),
        dist,
      })
    }
  }

  // 5. Keputusan 4: Tempel ujung ke titik pintu hanya jika jaraknya <= 0,3 m.
  // Ujung berjarak 0,3 sampai 3 m dari sebuah pintu hanya DILAPORKAN.
  const laporanUjungDekatPintu = []

  currentLines.forEach((lineObj) => {
    const line = lineObj.coords
    ;[0, line.length - 1].forEach((endIdx) => {
      const pt = line[endIdx]
      doorPoints.forEach((d) => {
        const dist = distanceMeters(pt, d.m)
        if (dist <= 0.3) {
          line[endIdx] = d.m // Snap persis ke pintu
        } else if (dist <= 3.0) {
          laporanUjungDekatPintu.push({
            doorId: d.id,
            rawIdx: lineObj.rawIdx,
            coordGeo: toGeoCoordinates(pt),
            dist,
          })
        }
      })
    })
  })

  // 6. Keputusan 3: Celah > 0,5 m JANGAN dijembatani. Laporkan ke log.
  const laporanCelahBesar = []
  currentLines.forEach((lineObj, lineIdx) => {
    const line = lineObj.coords
    const endpoints = [
      { isStart: true, pt: line[0] },
      { isStart: false, pt: line[line.length - 1] },
    ]

    endpoints.forEach((ep) => {
      // Cari segmen terdekat dari garis lain
      let minDistToOthers = Infinity
      let nearestFeatureIdx = -1

      for (let j = 0; j < currentLines.length; j += 1) {
        if (j === lineIdx) continue
        const other = currentLines[j].coords
        for (let s = 0; s < other.length - 1; s += 1) {
          const res = projectPointToSegment(ep.pt, other[s], other[s + 1])
          if (res.dist < minDistToOthers) {
            minDistToOthers = res.dist
            nearestFeatureIdx = currentLines[j].rawIdx
          }
        }
      }

      // Jika ada celah antara 0.5m s.d. 5.0m
      if (minDistToOthers > 0.5 && minDistToOthers <= 5.0) {
        laporanCelahBesar.push({
          rawIdx: lineObj.rawIdx,
          isStart: ep.isStart,
          coordGeo: toGeoCoordinates(ep.pt),
          nearestFeatureIdx,
          dist: minDistToOthers,
        })
      }
    })
  })

  // 7. Keputusan 5: Pertahankan koordinat pintu 1-18 persis seperti saat ini.
  // Buat simpul unik. Pintu 1-18 didaftarkan lebih dahulu.
  const nodes = []
  doorPoints.forEach((d) => {
    nodes.push({
      id: d.id,
      coord: d.coord,
      m: d.m,
      isDoor: true,
    })
  })

  let nextIntersectionId = 19
  function getOrCreateNode(ptM) {
    // Cek apakah berimpit dengan salah satu pintu (toleransi 0.001 m)
    for (const d of nodes.filter((n) => n.isDoor)) {
      if (distanceMeters(d.m, ptM) <= 0.001) {
        return d
      }
    }
    // Cek apakah ada simpul persimpangan yang sudah ada (toleransi 0.05 m)
    for (const n of nodes.filter((x) => !x.isDoor)) {
      if (distanceMeters(n.m, ptM) <= 0.05) {
        return n
      }
    }
    // Buat simpul persimpangan baru
    const coordGeo = toGeoCoordinates(ptM)
    const newNode = {
      id: nextIntersectionId,
      coord: coordGeo,
      m: ptM,
      isDoor: false,
    }
    nextIntersectionId += 1
    nodes.push(newNode)
    return newNode
  }

  // 8. Bentuk daftar sisi (edges)
  const edges = []
  currentLines.forEach((lineObj) => {
    const coordsM = lineObj.coords
    const nodeAsal = getOrCreateNode(coordsM[0])
    const nodeTujuan = getOrCreateNode(coordsM[coordsM.length - 1])

    // Saring ruas mikroskopis/self-loop di mana kedua ujung menempel ke simpul yang sama
    if (nodeAsal.id === nodeTujuan.id) {
      return
    }

    // Pastikan koordinat ujung garis persis menempel pada koordinat simpulnya
    const finalCoordsGeo = coordsM.map((m, cIdx) => {
      if (cIdx === 0) return nodeAsal.coord
      if (cIdx === coordsM.length - 1) return nodeTujuan.coord
      return toGeoCoordinates(m)
    })

    edges.push({
      id: edges.length + 1,
      asal: nodeAsal.id,
      tujuan: nodeTujuan.id,
      geometry: {
        type: 'MultiLineString',
        coordinates: [finalCoordsGeo],
      },
    })
  })

  // 9. Analisis Graf: Derajat, Komponen, dan Pintu Tersambung
  const adj = {}
  nodes.forEach((n) => {
    adj[n.id] = []
  })
  edges.forEach((e) => {
    adj[e.asal].push(e.tujuan)
    adj[e.tujuan].push(e.asal)
  })

  const visited = new Set()
  const components = []

  nodes.forEach((n) => {
    if (!visited.has(n.id) && adj[n.id].length > 0) {
      const compNodeIds = []
      const queue = [n.id]
      visited.add(n.id)

      while (queue.length > 0) {
        const curr = queue.shift()
        compNodeIds.push(curr)
        for (const neighbor of adj[curr]) {
          if (!visited.has(neighbor)) {
            visited.add(neighbor)
            queue.push(neighbor)
          }
        }
      }
      components.push(compNodeIds)
    }
  })

  // Periksa pintu yang tidak tersambung
  const pintuTersambung = []
  const pintuTidakTersambung = []

  doorPoints.forEach((d) => {
    const degree = adj[d.id] ? adj[d.id].length : 0
    if (degree > 0) {
      pintuTersambung.push(d.id)
    } else {
      pintuTidakTersambung.push(d.id)
    }
  })

  // Simpul derajat 1 (ujung buntu) yang bukan pintu
  const deadEndsNonDoor = nodes
    .filter((n) => !n.isDoor && adj[n.id].length === 1)
    .map((n) => ({
      id: n.id,
      lat: n.coord[1],
      lon: n.coord[0],
    }))

  // Simpul terisolasi (derajat 0)
  const isolatedNodes = nodes.filter((n) => adj[n.id].length === 0)

  // Validasi keunikan ID sisi
  const edgeIds = edges.map((e) => e.id)
  const isEdgeIdUnique = new Set(edgeIds).size === edgeIds.length

  return {
    nodes,
    edges,
    doorPoints,
    components,
    pintuTersambung,
    pintuTidakTersambung,
    deadEndsNonDoor,
    isolatedNodes,
    isEdgeIdUnique,
    laporanPintuDipecah,
    laporanTNoding,
    laporanCelahBesar,
    laporanUjungDekatPintu,
  }
}

/**
 * Membuat GeoJSON final sesuai format yang diharapkan aplikasi
 */
function buatGeoJsonFinal(nodes, edges) {
  const koordinatGeoJson = {
    type: 'FeatureCollection',
    name: 'koordinat_fmipa',
    crs: { type: 'name', properties: { name: 'urn:ogc:def:crs:OGC:1.3:CRS84' } },
    features: nodes.map((n) => ({
      type: 'Feature',
      properties: {
        id: n.id,
        X: n.coord[0],
        Y: n.coord[1],
      },
      geometry: {
        type: 'Point',
        coordinates: [n.coord[0], n.coord[1]],
      },
    })),
  }

  const edgesGeoJson = {
    type: 'FeatureCollection',
    name: 'edges_fmipa',
    crs: { type: 'name', properties: { name: 'urn:ogc:def:crs:OGC:1.3:CRS84' } },
    features: edges.map((e) => ({
      type: 'Feature',
      properties: {
        id: e.id,
        asal: e.asal,
        tujuan: e.tujuan,
      },
      geometry: e.geometry,
    })),
  }

  return { koordinatGeoJson, edgesGeoJson }
}

/**
 * Mencadangkan berkas lama ke scripts/cadangan/
 */
function cadangkanBerkasLama() {
  if (!existsSync(DIR_CADANGAN)) {
    mkdirSync(DIR_CADANGAN, { recursive: true })
  }
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-')

  if (existsSync(PATH_KOORDINAT_SRC)) {
    const target = resolve(DIR_CADANGAN, `koordinat_fmipa_${timestamp}.geojson`)
    writeFileSync(target, readFileSync(PATH_KOORDINAT_SRC, 'utf8'), 'utf8')
    console.log(`[CADANGAN] Dicadangkan: ${target}`)
  }
  if (existsSync(PATH_EDGES_SRC)) {
    const target = resolve(DIR_CADANGAN, `edges_fmipa_${timestamp}.geojson`)
    writeFileSync(target, readFileSync(PATH_EDGES_SRC, 'utf8'), 'utf8')
    console.log(`[CADANGAN] Dicadangkan: ${target}`)
  }
}

/**
 * Program Utama
 */
function main() {
  const isWriteMode = process.argv.includes('--tulis')

  console.log('='.repeat(70))
  console.log(' PEMBANGUN JARINGAN JALAN PEJALAN KAKI FMIPA UNIMED')
  console.log(` Mode: ${isWriteMode ? '*** MODE TULIS (--tulis AKTIF) ***' : 'MODE KERING (DRY-RUN, tidak ada file diubah)'}`)
  console.log('='.repeat(70))

  const { rawEdges, refKoordinat } = muatData()
  const hasil = prosesJaringan(rawEdges, refKoordinat)

  const {
    nodes,
    edges,
    components,
    pintuTersambung,
    pintuTidakTersambung,
    deadEndsNonDoor,
    isolatedNodes,
    isEdgeIdUnique,
    laporanPintuDipecah,
    laporanTNoding,
    laporanCelahBesar,
    laporanUjungDekatPintu,
  } = hasil

  const totalSimpul = nodes.length
  const simpulPintu = nodes.filter((n) => n.isDoor).length
  const simpulPersimpangan = nodes.filter((n) => !n.isDoor).length
  const totalSisi = edges.length

  console.log('\n--- RINGKASAN TOPOLOGI ---')
  console.log(`• Total Simpul          : ${totalSimpul}`)
  console.log(`  - Simpul Pintu (1-18) : ${simpulPintu}`)
  console.log(`  - Simpul Persimpangan : ${simpulPersimpangan} (ID 19 s.d. ${18 + simpulPersimpangan})`)
  console.log(`• Total Sisi (Edges)    : ${totalSisi}`)
  console.log(`• Keunikan ID Sisi      : ${isEdgeIdUnique ? 'VALID (semua ID unik)' : 'TIDAK UNIK (ADA DUPLIKAT)'}`)

  console.log('\n--- PEMUTUSAN VERTEX PINTU INTERIOR (Toleransi <= 0,05 m) ---')
  console.log(`• Jumlah pintu dipecah: ${laporanPintuDipecah.length}`)
  laporanPintuDipecah.forEach((p, idx) => {
    console.log(`  ${idx + 1}. Pintu ID ${p.doorId} dipecah pada Fitur #${p.rawFeatureIdx} (vertex ke-${p.coordIdx}) -> [lon: ${p.coordGeo[0].toFixed(7)}, lat: ${p.coordGeo[1].toFixed(7)}]`)
  })

  console.log('\n--- NODING T-JUNCTION (<= 0,5 m) ---')
  console.log(`• Jumlah T-junction disambung: ${laporanTNoding.length}`)
  laporanTNoding.forEach((t, idx) => {
    console.log(`  ${idx + 1}. Fitur #${t.sourceRawIdx} disambung ke Fitur #${t.targetRawIdx} | Jarak: ${t.dist.toFixed(4)} m | Titik: [lon: ${t.projGeo[0].toFixed(7)}, lat: ${t.projGeo[1].toFixed(7)}]`)
  })

  console.log('\n--- LAPORAN CELAH BESAR (> 0,5 m s.d. 5 m, TIDAK DIJEMBATANI) ---')
  if (laporanCelahBesar.length === 0) {
    console.log('• Tidak ada celah terbuka (> 0,5 m s.d. 5 m).')
  } else {
    // Deduplikasi laporan celah berdasarkan koordinat terdekat
    const unikCelah = []
    laporanCelahBesar.forEach((c) => {
      const ada = unikCelah.find((u) => Math.hypot(u.coordGeo[0] - c.coordGeo[0], u.coordGeo[1] - c.coordGeo[1]) < 0.00001)
      if (!ada) unikCelah.push(c)
    })
    unikCelah.forEach((c, idx) => {
      console.log(`  ${idx + 1}. Fitur #${c.rawIdx} (${c.isStart ? 'awal' : 'akhir'}) di [lat: ${c.coordGeo[1].toFixed(7)}, lon: ${c.coordGeo[0].toFixed(7)}] -> terpisah ${c.dist.toFixed(3)} m ke Fitur #${c.nearestFeatureIdx}`)
    })
  }

  console.log('\n--- UJUNG RUAS DEKAT PINTU (0,3 m < jarak <= 3,0 m, TIDAK DI-SNAP) ---')
  if (laporanUjungDekatPintu.length === 0) {
    console.log('• Tidak ada ujung berjarak 0,3 s.d. 3,0 m dari pintu.')
  } else {
    laporanUjungDekatPintu.forEach((u, idx) => {
      console.log(`  ${idx + 1}. Pintu ID ${u.doorId} memiliki ujung Fitur #${u.rawIdx} berjarak ${u.dist.toFixed(3)} m di [lat: ${u.coordGeo[1].toFixed(7)}, lon: ${u.coordGeo[0].toFixed(7)}]`)
    })
  }

  console.log('\n--- KOMPONEN GRAF & KONEKTIVITAS ---')
  console.log(`• Jumlah Komponen Graf: ${components.length}`)
  components.forEach((c, idx) => {
    const doorsInComp = c.filter((id) => id <= 18)
    console.log(`  - Komponen #${idx + 1}: ${c.length} simpul, ${doorsInComp.length} pintu gedung [${doorsInComp.join(', ')}]`)
  })

  console.log('\n--- STATUS 18 PINTU GEDUNG ---')
  console.log(`• Pintu Tersambung (${pintuTersambung.length}/18): [${pintuTersambung.join(', ')}]`)
  if (pintuTidakTersambung.length > 0) {
    console.log(`• [PERINGATAN] Pintu TIDAK Tersambung (${pintuTidakTersambung.length}): [${pintuTidakTersambung.join(', ')}]`)
  } else {
    console.log('• Semua 18 pintu tersambung ke jaringan!')
  }

  console.log('\n--- UJUNG BUNTU (SIMPUL DERAJAT 1) BUKAN PINTU ---')
  console.log(`• Jumlah ujung buntu non-pintu: ${deadEndsNonDoor.length}`)
  deadEndsNonDoor.forEach((d, idx) => {
    console.log(`  ${idx + 1}. Simpul ID ${d.id} di lintang: ${d.lat.toFixed(7)}, bujur: ${d.lon.toFixed(7)}`)
  })

  if (isolatedNodes.length > 0) {
    console.log(`\n• [PERINGATAN] Simpul Derajat 0 (Terisolasi): ${isolatedNodes.length} simpul [${isolatedNodes.map((n) => n.id).join(', ')}]`)
  }

  // Evaluasi Kriteria Validasi
  const validKomponen = components.length === 1
  const validPintu = pintuTidakTersambung.length === 0 && pintuTersambung.length === 18
  const validEdgeId = isEdgeIdUnique
  const validSemua = validKomponen && validPintu && validEdgeId

  console.log('\n' + '='.repeat(70))
  console.log(' EVALUASI KRITERIA VALIDASI')
  console.log('='.repeat(70))
  console.log(`• Komponen graf == 1       : ${validKomponen ? 'LOLOS' : 'GAGAL'}`)
  console.log(`• Semua 18 pintu tersambung: ${validPintu ? 'LOLOS' : 'GAGAL'}`)
  console.log(`• ID sisi unik             : ${validEdgeId ? 'LOLOS' : 'GAGAL'}`)
  console.log(`• KESIMPULAN STATUS        : ${validSemua ? 'VALID (SIAP DITULIS)' : 'DITOLAK (TIDAK MEMENUHI SYARAT)'}`)
  console.log('='.repeat(70))

  if (!validSemua) {
    console.error('\n[GALAT] Validasi topologi gagal. Skrip menolak menulis perubahan.')
    process.exit(1)
  }

  if (isWriteMode) {
    console.log('\n[MENULIS] Menjalankan pencadangan dan penulisan berkas...')
    cadangkanBerkasLama()
    const { koordinatGeoJson, edgesGeoJson } = buatGeoJsonFinal(nodes, edges)

    writeFileSync(PATH_KOORDINAT_SRC, JSON.stringify(koordinatGeoJson, null, 2), 'utf8')
    console.log(`[BERHASIL] Ditulis: ${PATH_KOORDINAT_SRC}`)

    writeFileSync(PATH_EDGES_SRC, JSON.stringify(edgesGeoJson, null, 2), 'utf8')
    console.log(`[BERHASIL] Ditulis: ${PATH_EDGES_SRC}`)
    console.log('\nSemua berkas data berhasil diperbarui dengan aman!')
  } else {
    console.log('\n[MODE KERING SELESAI] Tidak ada berkas yang diubah pada mode kering.')
    console.log('Gunakan opsi --tulis untuk menerapkan perubahan saat Anda menyetujuinya.')
  }
}

export { muatData, prosesJaringan, buatGeoJsonFinal, main }

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main()
}
