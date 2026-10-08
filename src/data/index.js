// Data peta dimuat sekali saat aplikasi dibuka (tanpa permintaan jaringan tambahan).
import koordinatRaw from './koordinat_fmipa.geojson?raw'
import edgesRaw from './edges_fmipa.geojson?raw'
import poligonRaw from './gedung_fmipa.geojson?raw'
import tempat from './tempat.json'
import ruanganMentah from './rooms.json'
import { buildGraph } from '../lib/graph'
import { bangunIndeksTempat } from '../lib/places'
import { bentukPoligon, batasPeta } from '../lib/peta'
import { normalisasiSemua } from '../lib/rooms'

export const koordinat = JSON.parse(koordinatRaw)
export const edges = JSON.parse(edgesRaw)
export const poligon = JSON.parse(poligonRaw)

export const graphData = buildGraph(koordinat, edges)
export const indeks = bangunIndeksTempat(tempat, graphData.pointsById)
export const bentuk = bentukPoligon(poligon, tempat)
export const batas = batasPeta(bentuk, graphData.pointsById)
export const ruanganLokal = normalisasiSemua(ruanganMentah, tempat)
export { tempat, ruanganMentah }
