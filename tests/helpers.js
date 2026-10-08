// Pemuat data bersama untuk pengujian (membaca berkas yang sama dengan aplikasi).
import { readFileSync } from 'node:fs'
import { buildGraph } from '../src/lib/graph'
import { bangunIndeksTempat } from '../src/lib/places'
import { normalisasiSemua } from '../src/lib/rooms'

const baca = (rel) => JSON.parse(readFileSync(new URL(rel, import.meta.url), 'utf8'))

export const koordinat = baca('../src/data/koordinat_fmipa.geojson')
export const edges = baca('../src/data/edges_fmipa.geojson')
export const poligon = baca('../src/data/gedung_fmipa.geojson')
export const tempat = baca('../src/data/tempat.json')
export const ruanganMentah = baca('../src/data/rooms.json')

export const graphData = buildGraph(koordinat, edges)
export const indeks = bangunIndeksTempat(tempat, graphData.pointsById)
export const ruangan = normalisasiSemua(ruanganMentah, tempat)
