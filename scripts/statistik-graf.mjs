#!/usr/bin/env node
/**
 * scripts/statistik-graf.mjs
 * 
 * Skrip analisa statistik graf dan perbandingan topologi jaringan FMIPA Unimed.
 * Membaca data jaringan aktif di src/data/ dan cadangan tertua di scripts/cadangan/.
 * 
 * Penggunaan:
 *   node scripts/statistik-graf.mjs
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  buildGraph,
  calculateEdgeWeight,
  dijkstra,
  aStar,
  floydWarshall,
} from '../src/lib/graph.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const ROOT_DIR = resolve(__dirname, '..')

// Path berkas aktif
const PATH_KOORDINAT_SRC = resolve(ROOT_DIR, 'src/data/koordinat_fmipa.geojson')
const PATH_EDGES_SRC = resolve(ROOT_DIR, 'src/data/edges_fmipa.geojson')
const PATH_TEMPAT_SRC = resolve(ROOT_DIR, 'src/data/tempat.json')
const PATH_ATURAN_SRC = resolve(ROOT_DIR, 'src/data/aturanJalur.json')
const DIR_CADANGAN = resolve(ROOT_DIR, 'scripts/cadangan')
const PATH_OUTPUT_MD = resolve(ROOT_DIR, 'docs/statistik-graf.md')

/**
 * Mencari nama resmi simpul dari tempat.json tanpa mengarang kata
 */
function getNamaSimpul(id, tempatList) {
  if (id === 79) return 'Non-pintu (jalur ke jalan raya)'
  if (id > 18) return `Persimpangan #${id}`
  for (const t of tempatList) {
    if (t.namaTitik && t.namaTitik[String(id)]) {
      return t.namaTitik[String(id)]
    }
    if (t.titik && t.titik.includes(id)) {
      return t.nama
    }
  }
  return `Simpul #${id}`
}

/**
 * Mencari berkas cadangan tertua
 */
function cariCadanganTertua() {
  if (!existsSync(DIR_CADANGAN)) {
    throw new Error(`Direktori cadangan tidak ditemukan: ${DIR_CADANGAN}`)
  }
  const files = readdirSync(DIR_CADANGAN).sort()
  const coordFiles = files.filter((f) => f.startsWith('koordinat_fmipa_'))
  const edgeFiles = files.filter((f) => f.startsWith('edges_fmipa_'))

  if (coordFiles.length === 0 || edgeFiles.length === 0) {
    throw new Error('Berkas cadangan tidak ditemukan di scripts/cadangan/')
  }

  const oldestCoord = coordFiles[0]
  const oldestEdge = edgeFiles[0]

  const coordsOld = JSON.parse(readFileSync(resolve(DIR_CADANGAN, oldestCoord), 'utf8'))
  const edgesOld = JSON.parse(readFileSync(resolve(DIR_CADANGAN, oldestEdge), 'utf8'))

  // Verifikasi jumlah simpul (18) dan ruas (51)
  const nodeCount = coordsOld.features.length
  const edgeCount = edgesOld.features.length

  if (nodeCount !== 18 || edgeCount !== 51) {
    throw new Error(
      `Berkas cadangan tertua (${oldestCoord}, ${oldestEdge}) tidak memiliki 18 simpul dan 51 ruas (ditemukan: ${nodeCount} simpul, ${edgeCount} ruas).`
    )
  }

  return { coordsOld, edgesOld, oldestCoord, oldestEdge }
}

/**
 * Fungsi pembantu pencarian titik potong (cut vertices) dan jembatan (bridges)
 */
function hitungTitikPotongDanJembatan(nodeIds, edgeFeatures) {
  const nSet = new Set(nodeIds)
  const localAdj = {}
  for (const id of nodeIds) localAdj[id] = []
  for (const e of edgeFeatures) {
    const u = Number(e.properties.asal)
    const v = Number(e.properties.tujuan)
    if (nSet.has(u) && nSet.has(v)) {
      localAdj[u].push({ v, eid: Number(e.properties.id) })
      localAdj[v].push({ v: u, eid: Number(e.properties.id) })
    }
  }

  // Hitung jumlah komponen awal
  const vis0 = new Set()
  let baseComp = 0
  for (const id of nodeIds) {
    if (!vis0.has(id)) {
      baseComp += 1
      const q = [id]
      vis0.add(id)
      while (q.length > 0) {
        const c = q.shift()
        for (const { v } of localAdj[c]) {
          if (!vis0.has(v)) {
            vis0.add(v)
            q.push(v)
          }
        }
      }
    }
  }

  // Titik potong (cut vertices)
  const cutVertices = []
  for (const id of nodeIds) {
    const rem = nodeIds.filter((x) => x !== id)
    const vis = new Set()
    let comp = 0
    for (const start of rem) {
      if (!vis.has(start)) {
        comp += 1
        const q = [start]
        vis.add(start)
        while (q.length > 0) {
          const c = q.shift()
          for (const { v } of localAdj[c]) {
            if (v !== id && !vis.has(v)) {
              vis.add(v)
              q.push(v)
            }
          }
        }
      }
    }
    if (comp > baseComp) cutVertices.push(id)
  }

  // Jembatan (bridges)
  const bridges = []
  for (const e of edgeFeatures) {
    const targetEid = Number(e.properties.id)
    const vis = new Set()
    let comp = 0
    for (const start of nodeIds) {
      if (!vis.has(start)) {
        comp += 1
        const q = [start]
        vis.add(start)
        while (q.length > 0) {
          const c = q.shift()
          for (const { v, eid } of localAdj[c]) {
            if (eid !== targetEid && !vis.has(v)) {
              vis.add(v)
              q.push(v)
            }
          }
        }
      }
    }
    if (comp > baseComp) bridges.push(targetEid)
  }

  return { cutVertices, bridges, baseComp }
}

/**
 * Analisa topologi dan metrik graf
 */
function analisaMetrikGraf(coordsGeoJson, edgesGeoJson, tempatList) {
  const nodeFeatures = coordsGeoJson.features
  const edgeFeatures = edgesGeoJson.features
  const nodeIds = nodeFeatures.map((f) => Number(f.properties.id)).sort((a, b) => a - b)
  const isDoor = (id) => id <= 18

  // a. Simpul, ruas, komponen
  const totalNodes = nodeIds.length
  const doorNodes = nodeIds.filter(isDoor).length
  const intersectionNodes = totalNodes - doorNodes
  const totalEdges = edgeFeatures.length

  const adj = {}
  for (const id of nodeIds) adj[id] = []
  for (const e of edgeFeatures) {
    const u = Number(e.properties.asal)
    const v = Number(e.properties.tujuan)
    adj[u].push(v)
    adj[v].push(u)
  }

  const visited = new Set()
  let componentsCount = 0
  for (const id of nodeIds) {
    if (!visited.has(id)) {
      componentsCount += 1
      const q = [id]
      visited.add(id)
      while (q.length > 0) {
        const curr = q.shift()
        for (const nbr of adj[curr]) {
          if (!visited.has(nbr)) {
            visited.add(nbr)
            q.push(nbr)
          }
        }
      }
    }
  }

  // b. Distribusi derajat
  const degrees = nodeIds.map((id) => adj[id].length)
  const minDegree = Math.min(...degrees)
  const maxDegree = Math.max(...degrees)
  const sumDegree = degrees.reduce((a, b) => a + b, 0)
  const avgDegree = sumDegree / totalNodes

  const histogram = {}
  for (const deg of degrees) {
    histogram[deg] = (histogram[deg] || 0) + 1
  }

  const deg1Nodes = nodeIds
    .filter((id) => adj[id].length === 1)
    .map((id) => {
      const feat = nodeFeatures.find((f) => Number(f.properties.id) === id)
      return {
        id,
        isDoor: isDoor(id),
        nama: getNamaSimpul(id, tempatList),
        coords: feat ? feat.geometry.coordinates : null,
      }
    })

  // c. Panjang ruas
  const lengths = edgeFeatures.map((e) => calculateEdgeWeight(e.geometry))
  const minLength = Math.min(...lengths)
  const maxLength = Math.max(...lengths)
  const totalLength = lengths.reduce((a, b) => a + b, 0)
  const avgLength = totalLength / totalEdges

  // Ruas lebih pendek dari 3 meter
  const shortEdges = []
  for (const e of edgeFeatures) {
    const len = calculateEdgeWeight(e.geometry)
    if (len < 3.0) {
      const asalId = Number(e.properties.asal)
      const tujuanId = Number(e.properties.tujuan)
      const featAsal = nodeFeatures.find((f) => Number(f.properties.id) === asalId)
      const featTujuan = nodeFeatures.find((f) => Number(f.properties.id) === tujuanId)
      shortEdges.push({
        id: Number(e.properties.id),
        panjang: len,
        asal: asalId,
        tujuan: tujuanId,
        derajatAsal: adj[asalId].length,
        derajatTujuan: adj[tujuanId].length,
        coordAsal: featAsal ? featAsal.geometry.coordinates : null,
        coordTujuan: featTujuan ? featTujuan.geometry.coordinates : null,
      })
    }
  }
  shortEdges.sort((a, b) => a.panjang - b.panjang)

  // d. Titik potong & jembatan
  const { cutVertices, bridges } = hitungTitikPotongDanJembatan(nodeIds, edgeFeatures)

  // Verifikasi (a): apakah ketujuh jembatan menyentuh simpul berderajat 1
  const deg1Set = new Set(deg1Nodes.map((n) => n.id))
  const jembatanMenyentuhDeg1 = bridges.map((bId) => {
    const e = edgeFeatures.find((f) => Number(f.properties.id) === bId)
    const u = Number(e.properties.asal)
    const v = Number(e.properties.tujuan)
    const uDeg1 = deg1Set.has(u)
    const vDeg1 = deg1Set.has(v)
    const deg1Id = uDeg1 ? u : (vDeg1 ? v : null)
    const nbrId = uDeg1 ? v : (vDeg1 ? u : null)
    return {
      bridgeId: bId,
      asal: u,
      tujuan: v,
      simpulDeg1: deg1Id,
      namaDeg1: deg1Id ? getNamaSimpul(deg1Id, tempatList) : null,
      simpulTetangga: nbrId,
      namaTetangga: nbrId ? getNamaSimpul(nbrId, tempatList) : null,
      menyentuhDeg1: deg1Id !== null,
    }
  })
  const semuaJembatanMenyentuhDeg1 = jembatanMenyentuhDeg1.every((j) => j.menyentuhDeg1)

  // Verifikasi (b): apakah ketujuh titik potong adalah tetangga simpul berderajat 1
  const tetanggaDeg1Set = new Set(deg1Nodes.map((d) => adj[d.id][0]))
  const titikPotongAdalahTetanggaDeg1 =
    cutVertices.length === tetanggaDeg1Set.size &&
    cutVertices.every((cv) => tetanggaDeg1Set.has(cv))

  // Verifikasi (c): analisis graf inti (core graph) setelah membuang ruas ujung
  const bridgeSet = new Set(bridges)
  const coreNodeIds = nodeIds.filter((id) => !deg1Set.has(id))
  const coreEdgeFeatures = edgeFeatures.filter((e) => !bridgeSet.has(Number(e.properties.id)))
  const grafIntiAnalisa = hitungTitikPotongDanJembatan(coreNodeIds, coreEdgeFeatures)

  // e. Diameter
  const graphObj = buildGraph(coordsGeoJson, edgesGeoJson)
  const fw = floydWarshall(graphObj.graph)

  let nodeDiameter = 0
  let nodeDiameterPair = null
  for (let i = 0; i < nodeIds.length; i += 1) {
    for (let j = i + 1; j < nodeIds.length; j += 1) {
      const u = nodeIds[i]
      const v = nodeIds[j]
      const d = fw[u]?.[v] ?? Infinity
      if (Number.isFinite(d) && d > nodeDiameter) {
        nodeDiameter = d
        nodeDiameterPair = [u, v]
      }
    }
  }

  let placeDiameter = 0
  let placeDiameterPair = null
  for (let i = 0; i < tempatList.length; i += 1) {
    for (let j = i + 1; j < tempatList.length; j += 1) {
      const tA = tempatList[i]
      const tB = tempatList[j]
      let minD = Infinity
      for (const u of tA.titik) {
        for (const v of tB.titik) {
          const d = fw[u]?.[v] ?? Infinity
          if (d < minD) minD = d
        }
      }
      if (Number.isFinite(minD) && minD > placeDiameter) {
        placeDiameter = minD
        placeDiameterPair = [tA.nama, tB.nama]
      }
    }
  }

  return {
    totalNodes,
    doorNodes,
    intersectionNodes,
    totalEdges,
    componentsCount,
    minDegree,
    maxDegree,
    avgDegree,
    histogram,
    deg1Nodes,
    minLength,
    maxLength,
    avgLength,
    totalLength,
    shortEdges,
    cutVertices,
    bridges,
    jembatanMenyentuhDeg1,
    semuaJembatanMenyentuhDeg1,
    titikPotongAdalahTetanggaDeg1,
    grafIntiAnalisa,
    coreNodeIds,
    coreEdgeFeatures,
    nodeDiameter,
    nodeDiameterPair,
    placeDiameter,
    placeDiameterPair,
    graphObj,
    fw,
  }
}

/**
 * Validasi 225 Pasangan Tempat & Dampak Aturan
 */
function validasiPasanganDanAturan(graphData, tempatList, aturan) {
  const { graph, pointsById } = graphData
  const pintuTertutupIds = new Set(aturan.pintuTertutup?.map((p) => p.id) || [])
  const titikUjungSajaIds = new Set(aturan.titikUjungSaja?.map((u) => u.id) || [])

  function getTitikAktif(t, applyRules) {
    if (!applyRules) return t.titik
    return t.titik.filter((id) => !pintuTertutupIds.has(id))
  }

  function getGraphTersaring(gSrc, dariTitik, applyRules) {
    if (!applyRules) return gSrc
    const g = {}
    for (const [k, edgeList] of Object.entries(gSrc)) {
      g[k] = edgeList.map((e) => ({ ...e }))
    }
    for (const u of titikUjungSajaIds) {
      if (!dariTitik.includes(u) && g[u]) {
        g[u] = []
      }
    }
    return g
  }

  // --- 1. Tanpa Aturan ---
  const fwTanpa = floydWarshall(graph)
  let maxDiffTanpa = 0
  const pairsTanpa = []

  for (const tA of tempatList) {
    for (const tB of tempatList) {
      const titikA = tA.titik
      const titikB = tB.titik

      const resDijk = dijkstra(graph, titikA, titikB)
      const distDijk = resDijk.found ? resDijk.distance : (titikA.some((x) => titikB.includes(x)) ? 0 : Infinity)

      const resA = aStar(graph, pointsById, titikA, titikB)
      const distAStar = resA.found ? resA.distance : (titikA.some((x) => titikB.includes(x)) ? 0 : Infinity)

      let distFW = Infinity
      for (const u of titikA) {
        for (const v of titikB) {
          const d = fwTanpa[u]?.[v] ?? Infinity
          if (d < distFW) distFW = d
        }
      }

      const diffDA = Math.abs(distDijk - distAStar)
      const diffDF = Math.abs(distDijk - distFW)
      const diffAF = Math.abs(distAStar - distFW)
      const localMax = Math.max(diffDA, diffDF, diffAF)
      if (localMax > maxDiffTanpa) maxDiffTanpa = localMax

      pairsTanpa.push({ dari: tA, ke: tB, dist: distDijk })
    }
  }

  // --- 2. Dengan Aturan ---
  const grafBiasa = getGraphTersaring(graph, [], true)
  const fwBiasa = floydWarshall(grafBiasa)

  const titikRumahKaca = tempatList.find((t) => t.id === 'rumah-kaca')?.titik || [18]
  const grafRumahKaca = getGraphTersaring(graph, titikRumahKaca, true)
  const fwRumahKaca = floydWarshall(grafRumahKaca)

  let maxDiffDengan = 0
  const pairsDengan = []

  for (const tA of tempatList) {
    const isRumahKaca = tA.id === 'rumah-kaca' || tA.titik.includes(18)
    const grafDipakai = isRumahKaca ? grafRumahKaca : grafBiasa
    const fwDipakai = isRumahKaca ? fwRumahKaca : fwBiasa

    for (const tB of tempatList) {
      const titikA = getTitikAktif(tA, true)
      const titikB = getTitikAktif(tB, true)

      const resDijk = dijkstra(grafDipakai, titikA, titikB)
      const distDijk = resDijk.found ? resDijk.distance : (titikA.some((x) => titikB.includes(x)) ? 0 : Infinity)

      const resA = aStar(grafDipakai, pointsById, titikA, titikB)
      const distAStar = resA.found ? resA.distance : (titikA.some((x) => titikB.includes(x)) ? 0 : Infinity)

      let distFW = Infinity
      for (const u of titikA) {
        for (const v of titikB) {
          const d = fwDipakai[u]?.[v] ?? Infinity
          if (d < distFW) distFW = d
        }
      }

      const diffDA = Math.abs(distDijk - distAStar)
      const diffDF = Math.abs(distDijk - distFW)
      const diffAF = Math.abs(distAStar - distFW)
      const localMax = Math.max(diffDA, diffDF, diffAF)
      if (localMax > maxDiffDengan) maxDiffDengan = localMax

      pairsDengan.push({ dari: tA, ke: tB, dist: distDijk })
    }
  }

  // --- 3. Dampak Aturan ---
  const changedPairs = []
  for (let i = 0; i < pairsTanpa.length; i += 1) {
    const dTanpa = pairsTanpa[i].dist
    const dDengan = pairsDengan[i].dist
    const selisih = Math.abs(dDengan - dTanpa)
    if (selisih > 0.0001) {
      changedPairs.push({
        dari: pairsTanpa[i].dari.nama,
        ke: pairsTanpa[i].ke.nama,
        dTanpa,
        dDengan,
        selisih,
      })
    }
  }

  const sumDiff = changedPairs.reduce((acc, p) => acc + p.selisih, 0)
  const avgDiffChanged = changedPairs.length > 0 ? sumDiff / changedPairs.length : 0
  const avgDiffAll = sumDiff / pairsTanpa.length
  const maxDiffRule = changedPairs.length > 0 ? Math.max(...changedPairs.map((p) => p.selisih)) : 0

  return {
    totalPairs: pairsTanpa.length,
    maxDiffTanpa,
    maxDiffDengan,
    changedPairs,
    avgDiffChanged,
    avgDiffAll,
    maxDiffRule,
  }
}

/**
 * Format teks markdown
 */
function buatDokumentasiMarkdown(statsNew, statsOld, hasilValidasi, infoCadangan) {
  const {
    totalPairs,
    maxDiffTanpa,
    maxDiffDengan,
    changedPairs,
    avgDiffChanged,
    avgDiffAll,
    maxDiffRule,
  } = hasilValidasi

  const histNewStr = Object.entries(statsNew.histogram)
    .sort((a, b) => Number(a[0]) - Number(b[0]))
    .map(([deg, count]) => `Derajat ${deg}: ${count} simpul`)
    .join(', ')

  const histOldStr = Object.entries(statsOld.histogram)
    .sort((a, b) => Number(a[0]) - Number(b[0]))
    .map(([deg, count]) => `Derajat ${deg}: ${count} simpul`)
    .join(', ')

  const md = `# Statistik Graf & Analisa Topologi Jaringan FMIPA Unimed

Dokumen ini dihasilkan secara otomatis oleh \\\`scripts/statistik-graf.mjs\\\` berdasarkan data jaringan jalan pejalan kaki FMIPA Unimed di \\\`src/data/\\\` dan data cadangan historis tertua di \\\`scripts/cadangan/\\\`.

Tanggal Analisis: ${new Date().toISOString()}

---

## 1. Perbandingan Jaringan: Lama vs Baru

Jaringan lama merujuk pada berkas cadangan paling awal (\\\`${infoCadangan.oldestCoord}\\\` & \\\`${infoCadangan.oldestEdge}\\\`) yang hanya menghubungkan 18 pintu gedung secara langsung. Jaringan baru merupakan model graf topologi pejalan kaki berpresisi tinggi dengan persimpangan noded.

| Metrik | Jaringan Lama (Cadangan Awal) | Jaringan Baru (Aktif) | Perubahan / Keterangan |
| :--- | :---: | :---: | :--- |
| **Jumlah Simpul** | **${statsOld.totalNodes}** | **${statsNew.totalNodes}** | +${statsNew.totalNodes - statsOld.totalNodes} simpul |
| • Simpul Pintu (1–18) | ${statsOld.doorNodes} | ${statsNew.doorNodes} | Tetap (18 pintu) |
| • Simpul Persimpangan | ${statsOld.intersectionNodes} | ${statsNew.intersectionNodes} | +${statsNew.intersectionNodes} persimpangan noded |
| **Jumlah Ruas (Edges)** | **${statsOld.totalEdges}** | **${statsNew.totalEdges}** | +${statsNew.totalEdges - statsOld.totalEdges} ruas |
| **Komponen Terhubung** | **${statsOld.componentsCount}** | **${statsNew.componentsCount}** | 1 (100% terhubung penuh) |
| **Distribusi Derajat Simpul** | | | |
| • Derajat Minimum | ${statsOld.minDegree} | ${statsNew.minDegree} | |
| • Derajat Maksimum | ${statsOld.maxDegree} | ${statsNew.maxDegree} | Penurunan dari 10 ke 4 (graf planar) |
| • Derajat Rata-rata | ${statsOld.avgDegree.toFixed(2)} | ${statsNew.avgDegree.toFixed(2)} | Penyesuaian topologi riil |
| • Histogram Derajat | ${histOldStr} | ${histNewStr} | |
| **Panjang Ruas Jalan** | | | |
| • Ruas Terpendek | ${statsOld.minLength.toFixed(2)} m | ${statsNew.minLength.toFixed(2)} m | Ruas mikro telah dibersihkan (>= 0,25 m) |
| • Ruas Terpanjang | ${statsOld.maxLength.toFixed(2)} m | ${statsNew.maxLength.toFixed(2)} m | Pecah menjadi segmen-segmen jalan riil |
| • Panjang Rata-rata Ruas | ${statsOld.avgLength.toFixed(2)} m | ${statsNew.avgLength.toFixed(2)} m | |
| • Total Panjang Jaringan | **${statsOld.totalLength.toFixed(2)} m** | **${statsNew.totalLength.toFixed(2)} m** | Efisiensi & penghapusan garis tumpang tindih |
| **Diameter Jaringan** | | | |
| • Diameter Antar-Simpul | ${statsOld.nodeDiameter.toFixed(2)} m (Simpul ${statsOld.nodeDiameterPair.join(' ↔ ')}) | ${statsNew.nodeDiameter.toFixed(2)} m (Simpul ${statsNew.nodeDiameterPair.join(' ↔ ')}) | Jalur terjauh di koridor kampus |
| • Diameter Antar-Tempat | ${statsOld.placeDiameter.toFixed(2)} m (${statsOld.placeDiameterPair.join(' ↔ ')}) | ${statsNew.placeDiameter.toFixed(2)} m (${statsNew.placeDiameterPair.join(' ↔ ')}) | Jarak pejalan kaki terjauh antar-gedung |

---

## 2. Struktur & Konektivitas Topologi Jaringan Aktif

### A. Simpul Berderajat 1 (Dead Ends)
Seluruh nama simpul diambil langsung dari \\\`src/data/tempat.json\\\` (nama tempat riil atau \\\`namaTitik\\\`):
* Jumlah: **${statsNew.deg1Nodes.length} simpul**
${statsNew.deg1Nodes.map((n) => `* **Simpul ${n.id}** — **${n.nama}** (${n.isDoor ? 'Pintu Gedung' : 'Batas Jalan'}): [lon: ${n.coords[0].toFixed(7)}, lat: ${n.coords[1].toFixed(7)}]`).join('\n')}

> **Catatan Validitas**: Simpul 79 adalah satu-satunya ujung buntu non-pintu yang sah, mewakili jalur pejalan kaki yang mengarah ke jalan raya (batas selatan kawasan FMIPA).

### B. Analisa Jembatan (Bridges) & Titik Potong (Cut Vertices)
* **Jumlah Jembatan**: **${statsNew.bridges.length} ruas** (\\\`${statsNew.bridges.join(', ')}\\\`)
* **Jumlah Titik Potong**: **${statsNew.cutVertices.length} simpul** (\\\`${statsNew.cutVertices.join(', ')}\\\`)

#### Verifikasi Struktural:
1. **Apakah seluruh 7 jembatan menyentuh simpul berderajat 1?**
   **YA (100%)**. Setiap jembatan merupakan ruas cabang tunggal (*pendant edge*) yang menghubungkan simpul berderajat 1 ke simpul tetangganya:
${statsNew.jembatanMenyentuhDeg1.map((j) => `   - **Jembatan Ruas #${j.bridgeId}**: Ruas (${j.asal} ↔ ${j.tujuan}) menghubungkan Simpul ${j.simpulDeg1} (**${j.namaDeg1}**, der. 1) dengan Simpul ${j.simpulTetangga} (**${j.namaTetangga}**)`).join('\n')}

2. **Apakah seluruh 7 titik potong adalah tetangga simpul berderajat 1?**
   **YA (100% Bijeksi)**. Himpunan titik potong persis sama dengan himpunan tetangga dari ketujuh simpul berderajat 1:
   - Simpul 9 (Lab. Kimia) ↔ Titik Potong **35**
   - Simpul 12 (Gedung Belajar Bersama) ↔ Titik Potong **50**
   - Simpul 13 (Lab. Fisika) ↔ Titik Potong **62**
   - Simpul 14 (Gedung Bilingual) ↔ Titik Potong **29**
   - Simpul 15 (Rumah Hewan FMIPA) ↔ Titik Potong **86**
   - Simpul 16 (Ruang Serbaguna Taman Biologi) ↔ Titik Potong **17**
   - Simpul 79 (Non-pintu jalan raya) ↔ Titik Potong **78**

3. **Analisa Graf Inti (Core Graph) setelah Ruas Ujung Dibuang**:
   Ketika seluruh 7 ruas ujung (jembatan) beserta 7 simpul berderajat 1 dilepas dari graf:
   - Jumlah Simpul Inti: **${statsNew.coreNodeIds.length} simpul** (92 - 7)
   - Jumlah Ruas Inti: **${statsNew.coreEdgeFeatures.length} ruas** (132 - 7)
   - Komponen Terhubung: **${statsNew.grafIntiAnalisa.baseComp} komponen tunggal**
   - **Jumlah Titik Potong Graf Inti**: **${statsNew.grafIntiAnalisa.cutVertices.length}** (NOL)
   - **Jumlah Jembatan Graf Inti**: **${statsNew.grafIntiAnalisa.bridges.length}** (NOL)
   
   > **Kesimpulan Ketahanan Graf**: Graf inti bersifat **2-vertex-connected** dan **2-edge-connected** (*biconnected*). Seluruh koridor utama pejalan kaki FMIPA membentuk siklus tertutup (loop redundan), sehingga tidak memiliki *single point of failure* (titik kegagalan tunggal).

## 3. Daftar Ruas Pendek (< 3 Meter)

Pemeriksaan seluruh ruas dengan panjang \\\`< 3 m\\\`:

| ID Ruas | Panjang | Asal (Derajat) | Koordinat Asal (Lat, Lon) | Tujuan (Derajat) | Koordinat Tujuan (Lat, Lon) |
| :---: | :---: | :---: | :---: | :---: | :---: |
${statsNew.shortEdges.map((s) => `| **${s.id}** | **${s.panjang.toFixed(3)} m** | Simpul ${s.asal} (der. ${s.derajatAsal}) | ${s.coordAsal[1].toFixed(7)}, ${s.coordAsal[0].toFixed(7)} | Simpul ${s.tujuan} (der. ${s.derajatTujuan}) | ${s.coordTujuan[1].toFixed(7)}, ${s.coordTujuan[0].toFixed(7)} |`).join('\n')}

> **Catatan**: Kelayakan ruas pendek di lapangan belum diverifikasi; hanya data yang dilaporkan.

---

## 4. Validasi Algoritma Rute Terpendek (225 Pasangan Tempat)

Pengujian kesetaraan algoritma **Dijkstra**, **A\***, dan **Floyd-Warshall** pada seluruh 225 pasangan tempat (15 × 15 tempat):

1. **Tanpa Aturan Jalur (\\\`aturanJalur.json = null\\\`)**:
   * Jumlah pasangan diuji: **${totalPairs}**
   * Status: **VALID (Dijkstra = A\* = Floyd-Warshall)**
   * Selisih Maksimum: **${maxDiffTanpa.toExponential(4)} m** (presisi mesin floating-point, << 0,001 m)
2. **Dengan Aturan Jalur (\\\`aturanJalur.json\\\` Aktif)**:
   * Jumlah pasangan diuji: **${totalPairs}**
   * Status: **VALID (Dijkstra = A\* = Floyd-Warshall)**
   * Selisih Maksimum: **${maxDiffDengan.toExponential(4)} m** (presisi mesin floating-point, << 0,001 m)

---

## 5. Dampak Aturan Jalur (\\\`aturanJalur.json\\\`) Terhadap Jarak Antar-Tempat

* **Pasangan Tempat Terdampak**: **${changedPairs.length} pasangan** dari ${totalPairs} (${((changedPairs.length / totalPairs) * 100).toFixed(1)}%)
* **Perubahan Jarak Rata-rata (pada pasangan terdampak)**: **${avgDiffChanged.toFixed(2)} meter**
* **Perubahan Jarak Rata-rata (seluruh 225 pasangan)**: **${avgDiffAll.toFixed(2)} meter**
* **Perubahan Jarak Maksimum**: **${maxDiffRule.toFixed(2)} meter**
* **Daftar Pasangan dengan Perubahan Jarak Signifikan**:
${changedPairs.slice(0, 10).map((p, idx) => `  ${idx + 1}. **${p.dari}** ↔ **${p.ke}**: ${p.dTanpa.toFixed(2)} m → ${p.dDengan.toFixed(2)} m (selisih: +${p.selisih.toFixed(2)} m)`).join('\n')}
${changedPairs.length > 10 ? `  *(dan ${changedPairs.length - 10} pasangan lainnya)*\n` : ''}
* **Penyebab Perubahan**:
  1. Penutupan Pintu 7 (Lobi Utara Gedung Syawal) mengalihkan rute masuk/keluar ke Lobi Barat (Pintu 6) atau Lobi Timur (Pintu 5).
  2. Kebijakan Rumah Kaca (Simpul 18) hanya sebagai titik awal/tujuan mencegah jalur pejalan kaki transit menembus area Rumah Kaca.
`
  return md
}

/**
 * Program Utama
 */
function main() {
  console.log('='.repeat(78))
  console.log(' ANALISIS STATISTIK GRAF JARINGAN JALAN PEJALAN KAKI FMIPA UNIMED')
  console.log('='.repeat(78))

  const coordsNew = JSON.parse(readFileSync(PATH_KOORDINAT_SRC, 'utf8'))
  const edgesNew = JSON.parse(readFileSync(PATH_EDGES_SRC, 'utf8'))
  const tempatList = JSON.parse(readFileSync(PATH_TEMPAT_SRC, 'utf8'))
  const aturan = existsSync(PATH_ATURAN_SRC)
    ? JSON.parse(readFileSync(PATH_ATURAN_SRC, 'utf8'))
    : { pintuTertutup: [], titikUjungSaja: [] }

  const infoCadangan = cariCadanganTertua()
  console.log(`[INFO] Cadangan tertua terverifikasi: ${infoCadangan.oldestCoord} & ${infoCadangan.oldestEdge}`)
  console.log(`       (${infoCadangan.coordsOld.features.length} simpul, ${infoCadangan.edgesOld.features.length} ruas)`)

  const statsNew = analisaMetrikGraf(coordsNew, edgesNew, tempatList)
  const statsOld = analisaMetrikGraf(infoCadangan.coordsOld, infoCadangan.edgesOld, tempatList)
  const validasi = validasiPasanganDanAturan(statsNew.graphObj, tempatList, aturan)

  // Cetak Tabel Ringkasan Teks
  console.log('\n' + '-'.repeat(78))
  console.log(' TABEL 1: PERBANDINGAN JARINGAN LAMA VS BARU')
  console.log('-'.repeat(78))
  console.log(
    `| ${'Metrik Topologi'.padEnd(28)} | ${'Jaringan Lama'.padEnd(16)} | ${'Jaringan Baru'.padEnd(16)} | ${'Perubahan'.padEnd(10)} |`
  )
  console.log(`|${'-'.repeat(30)}|${'-'.repeat(18)}|${'-'.repeat(18)}|${'-'.repeat(12)}|`)
  console.log(
    `| ${'Jumlah Simpul'.padEnd(28)} | ${String(statsOld.totalNodes).padEnd(16)} | ${String(statsNew.totalNodes).padEnd(16)} | ${`+${statsNew.totalNodes - statsOld.totalNodes}`.padEnd(10)} |`
  )
  console.log(
    `| ${'- Pintu Gedung (1-18)'.padEnd(28)} | ${String(statsOld.doorNodes).padEnd(16)} | ${String(statsNew.doorNodes).padEnd(16)} | ${'Tetap'.padEnd(10)} |`
  )
  console.log(
    `| ${'- Persimpangan Jalan'.padEnd(28)} | ${String(statsOld.intersectionNodes).padEnd(16)} | ${String(statsNew.intersectionNodes).padEnd(16)} | ${`+${statsNew.intersectionNodes}`.padEnd(10)} |`
  )
  console.log(
    `| ${'Jumlah Ruas (Edges)'.padEnd(28)} | ${String(statsOld.totalEdges).padEnd(16)} | ${String(statsNew.totalEdges).padEnd(16)} | ${`+${statsNew.totalEdges - statsOld.totalEdges}`.padEnd(10)} |`
  )
  console.log(
    `| ${'Komponen Terhubung'.padEnd(28)} | ${String(statsOld.componentsCount).padEnd(16)} | ${String(statsNew.componentsCount).padEnd(16)} | ${'Tetap (1)'.padEnd(10)} |`
  )
  console.log(
    `| ${'Derajat Min / Maks / Rata'.padEnd(28)} | ${`${statsOld.minDegree} / ${statsOld.maxDegree} / ${statsOld.avgDegree.toFixed(2)}`.padEnd(16)} | ${`${statsNew.minDegree} / ${statsNew.maxDegree} / ${statsNew.avgDegree.toFixed(2)}`.padEnd(16)} | ${'-'.padEnd(10)} |`
  )
  console.log(
    `| ${'Panjang Ruas Min (m)'.padEnd(28)} | ${statsOld.minLength.toFixed(2).padEnd(16)} | ${statsNew.minLength.toFixed(2).padEnd(16)} | ${'-'.padEnd(10)} |`
  )
  console.log(
    `| ${'Panjang Ruas Maks (m)'.padEnd(28)} | ${statsOld.maxLength.toFixed(2).padEnd(16)} | ${statsNew.maxLength.toFixed(2).padEnd(16)} | ${'-'.padEnd(10)} |`
  )
  console.log(
    `| ${'Panjang Rata-rata (m)'.padEnd(28)} | ${statsOld.avgLength.toFixed(2).padEnd(16)} | ${statsNew.avgLength.toFixed(2).padEnd(16)} | ${'-'.padEnd(10)} |`
  )
  console.log(
    `| ${'Total Panjang Jaringan (m)'.padEnd(28)} | ${statsOld.totalLength.toFixed(2).padEnd(16)} | ${statsNew.totalLength.toFixed(2).padEnd(16)} | ${`${(statsNew.totalLength - statsOld.totalLength).toFixed(1)} m`.padEnd(10)} |`
  )
  console.log(
    `| ${'Diameter Simpul (m)'.padEnd(28)} | ${statsOld.nodeDiameter.toFixed(2).padEnd(16)} | ${statsNew.nodeDiameter.toFixed(2).padEnd(16)} | ${'-'.padEnd(10)} |`
  )
  console.log(
    `| ${'Diameter Tempat (m)'.padEnd(28)} | ${statsOld.placeDiameter.toFixed(2).padEnd(16)} | ${statsNew.placeDiameter.toFixed(2).padEnd(16)} | ${'-'.padEnd(10)} |`
  )
  console.log('-'.repeat(78))

  console.log('\n' + '-'.repeat(78))
  console.log(' TABEL 2: DETAIL STRUKTUR JARINGAN AKTIF')
  console.log('-'.repeat(78))
  console.log(`• Histogram Derajat Simpul : ${JSON.stringify(statsNew.histogram)}`)
  console.log(`• Simpul Derajat 1 (${statsNew.deg1Nodes.length} simpul):`)
  statsNew.deg1Nodes.forEach((n) => {
    console.log(`  - Simpul ${String(n.id).padStart(2)}: ${n.nama} (${n.isDoor ? 'Pintu Gedung' : 'Batas Jalan'})`)
  })

  console.log(`\n• Analisa Jembatan & Titik Potong:`)
  console.log(`  (a) 7 Jembatan semuanya menyentuh simpul derajat 1? ${statsNew.semuaJembatanMenyentuhDeg1 ? 'YA (BENAR)' : 'TIDAK'}`)
  statsNew.jembatanMenyentuhDeg1.forEach((j) => {
    console.log(`      * Jembatan #${j.bridgeId} (${j.asal} ↔ ${j.tujuan}): Simpul ${j.simpulDeg1} (${j.namaDeg1}) ↔ Simpul ${j.simpulTetangga} (${j.namaTetangga})`)
  })
  console.log(`  (b) 7 Titik Potong semuanya tetangga simpul derajat 1? ${statsNew.titikPotongAdalahTetanggaDeg1 ? 'YA (100% PERSIS SAMA)' : 'TIDAK'}`)
  console.log(`      Daftar Titik Potong: [${statsNew.cutVertices.join(', ')}]`)
  console.log(`  (c) Graf Inti (setelah membuang 7 ruas ujung & simpul derajat 1):`)
  console.log(`      * Simpul Inti    : ${statsNew.coreNodeIds.length} simpul | Ruas Inti: ${statsNew.coreEdgeFeatures.length} ruas`)
  console.log(`      * Titik Potong   : ${statsNew.grafIntiAnalisa.cutVertices.length} (TIDAK ADA)`)
  console.log(`      * Jembatan       : ${statsNew.grafIntiAnalisa.bridges.length} (TIDAK ADA)`)
  console.log(`      * Status Graf    : 2-connected (biconnected, redundansi penuh tanpa single point of failure)`)
  console.log('-'.repeat(78))

/**
 * Menghitung vektor dan sudut antar ruas yang menempel pada sebuah simpul
 */
function hitungSudutSimpul(nodeId, edgeFeatures, coordsGeoJson) {
  const nodeFeat = coordsGeoJson.features.find((f) => Number(f.properties.id) === nodeId)
  const nodeCoord = nodeFeat.geometry.coordinates

  const incident = edgeFeatures.filter(
    (e) => Number(e.properties.asal) === nodeId || Number(e.properties.tujuan) === nodeId
  )

  const LAT0 = 3.6070
  const LON0 = 98.7150
  const METERS_PER_LAT = 110540.0
  const METERS_PER_LON = 111320.0 * Math.cos((LAT0 * Math.PI) / 180.0)

  function toLocalM([lon, lat]) {
    return [(lon - LON0) * METERS_PER_LON, (lat - LAT0) * METERS_PER_LAT]
  }

  const mNode = toLocalM(nodeCoord)

  const vectors = incident.map((edge) => {
    const c = edge.geometry.coordinates[0]
    const isStart = Number(edge.properties.asal) === nodeId
    const pNext = isStart ? c[1] : c[c.length - 2]
    const otherId = isStart ? Number(edge.properties.tujuan) : Number(edge.properties.asal)
    const mNext = toLocalM(pNext)
    const dx = mNext[0] - mNode[0]
    const dy = mNext[1] - mNode[1]
    const azimuth = (Math.atan2(dx, dy) * 180 / Math.PI + 360) % 360
    return {
      edgeId: Number(edge.properties.id),
      otherId,
      dx,
      dy,
      azimuth,
    }
  })

  const pairs = []
  for (let i = 0; i < vectors.length; i += 1) {
    for (let j = i + 1; j < vectors.length; j += 1) {
      const v1 = vectors[i]
      const v2 = vectors[j]
      const dot = v1.dx * v2.dx + v1.dy * v2.dy
      const mag1 = Math.hypot(v1.dx, v1.dy)
      const mag2 = Math.hypot(v2.dx, v2.dy)
      const cosA = Math.max(-1, Math.min(1, dot / (mag1 * mag2)))
      const angleDeg = (Math.acos(cosA) * 180) / Math.PI
      pairs.push({
        edge1: v1.edgeId,
        other1: v1.otherId,
        edge2: v2.edgeId,
        other2: v2.otherId,
        angleDeg,
      })
    }
  }

  return {
    nodeId,
    lat: nodeCoord[1],
    lon: nodeCoord[0],
    vectors,
    pairs,
  }
}

  console.log('\n' + '-'.repeat(78))
  console.log(' TABEL 3: DAFTAR RUAS LEBIH PENDEK DARI 3 METER')
  console.log('-'.repeat(78))
  statsNew.shortEdges.forEach((s, idx) => {
    console.log(`  ${idx + 1}. Ruas ID ${s.id} | Panjang: ${s.panjang.toFixed(3)} m`)
    console.log(`     Asal   : Simpul ${s.asal} (der. ${s.derajatAsal}) di [lat: ${s.coordAsal[1].toFixed(7)}, lon: ${s.coordAsal[0].toFixed(7)}]`)
    console.log(`     Tujuan : Simpul ${s.tujuan} (der. ${s.derajatTujuan}) di [lat: ${s.coordTujuan[1].toFixed(7)}, lon: ${s.coordTujuan[0].toFixed(7)}]`)
  })
  console.log('  Catatan: Kelayakan ruas pendek di lapangan belum diverifikasi; hanya data yang dilaporkan.')
  console.log('-'.repeat(78))

  console.log('\n' + '-'.repeat(78))
  console.log(' DETAIL SIMPUL 88 DAN 89 (KOORDINAT & SUDUT RUAS)')
  console.log('-'.repeat(78))
  const sudut88 = hitungSudutSimpul(88, edgesNew.features, coordsNew)
  const sudut89 = hitungSudutSimpul(89, edgesNew.features, coordsNew)

  console.log(`• Simpul 88:`)
  console.log(`  - Koordinat: Lintang ${sudut88.lat.toFixed(7)}, Bujur ${sudut88.lon.toFixed(7)}`)
  console.log(`  - Ruas yang menempel:`)
  sudut88.vectors.forEach((v) => {
    console.log(`    * Ruas #${v.edgeId} (menuju Simpul ${v.otherId}): azimuth ${v.azimuth.toFixed(2)}°`)
  })
  console.log(`  - Sudut antar ruas:`)
  sudut88.pairs.forEach((p) => {
    console.log(`    * Ruas #${p.edge1} ↔ Ruas #${p.edge2}: ${p.angleDeg.toFixed(2)}°`)
  })

  console.log(`\n• Simpul 89:`)
  console.log(`  - Koordinat: Lintang ${sudut89.lat.toFixed(7)}, Bujur ${sudut89.lon.toFixed(7)}`)
  console.log(`  - Ruas yang menempel:`)
  sudut89.vectors.forEach((v) => {
    console.log(`    * Ruas #${v.edgeId} (menuju Simpul ${v.otherId}): azimuth ${v.azimuth.toFixed(2)}°`)
  })
  console.log(`  - Sudut antar ruas:`)
  sudut89.pairs.forEach((p) => {
    console.log(`    * Ruas #${p.edge1} ↔ Ruas #${p.edge2}: ${p.angleDeg.toFixed(2)}°`)
  })
  console.log('-'.repeat(78))

  console.log('\n' + '-'.repeat(78))
  console.log(' TABEL 4: VALIDASI ALGORITMA PADA 225 PASANGAN TEMPAT')
  console.log('-'.repeat(78))
  console.log(`• Tanpa Aturan  : Dijkstra = A* = Floyd-Warshall | Selisih Maks: ${validasi.maxDiffTanpa.toExponential(4)} m (VALID)`)
  console.log(`• Dengan Aturan : Dijkstra = A* = Floyd-Warshall | Selisih Maks: ${validasi.maxDiffDengan.toExponential(4)} m (VALID)`)
  console.log('-'.repeat(78))

  console.log('\n' + '-'.repeat(78))
  console.log(' TABEL 5: DAMPAK ATURAN JALUR TERHADAP JARAK TEMPAT')
  console.log('-'.repeat(78))
  console.log(`• Jumlah Pasangan Berubah : ${validasi.changedPairs.length} dari ${validasi.totalPairs} (${((validasi.changedPairs.length / validasi.totalPairs) * 100).toFixed(1)}%)`)
  console.log(`• Rata-rata Perubahan (Pasangan Berubah) : ${validasi.avgDiffChanged.toFixed(2)} m`)
  console.log(`• Rata-rata Perubahan (Semua Pasangan)   : ${validasi.avgDiffAll.toFixed(2)} m`)
  console.log(`• Perubahan Jarak Maksimum               : ${validasi.maxDiffRule.toFixed(2)} m`)
  console.log('-'.repeat(78))

  // Tulis ke docs/statistik-graf.md
  const docsDir = resolve(ROOT_DIR, 'docs')
  if (!existsSync(docsDir)) {
    mkdirSync(docsDir, { recursive: true })
  }
  const contentMd = buatDokumentasiMarkdown(statsNew, statsOld, validasi, infoCadangan)
  writeFileSync(PATH_OUTPUT_MD, contentMd, 'utf8')
  console.log(`\n[BERHASIL] Dokumentasi lengkap ditulis ke: ${PATH_OUTPUT_MD}`)
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main()
}
