import { useEffect, useMemo, useRef, useState } from 'react'
import L from 'leaflet'
import { CircleMarker, Circle, MapContainer, Marker, Polygon, Polyline, TileLayer, Tooltip, ZoomControl, useMap, useMapEvents } from 'react-leaflet'
import { KELOMPOK } from '../lib/peta'
import Legenda from './Legenda'

function ikonLabel(teks, bawah = false) {
  return L.divIcon({ className: `peta-label${bawah ? ' peta-label-bawah' : ''}`, html: `<span>${teks.replace(/[<>&]/g, '')}</span>`, iconSize: [0, 0] })
}
const ikonPin = (huruf, kelas) => L.divIcon({ className: `peta-pin ${kelas}`, html: `<span>${huruf}</span>`, iconSize: [30, 30], iconAnchor: [15, 15] })

function AturPandangan({ batas, garis, kunciRute }) {
  const map = useMap()
  const sebelumnya = useRef(null)

  useEffect(() => {
    const pasang = () => {
      map.invalidateSize()
      if (garis && garis.length > 1) map.fitBounds(garis, { padding: [48, 48], maxZoom: 19 })
      else map.fitBounds(batas, { padding: [8, 8] })
    }
    const berubah = sebelumnya.current !== kunciRute
    sebelumnya.current = kunciRute
    if (!berubah) return undefined
    const timer = setTimeout(pasang, 320) // tunggu panel mobile selesai berubah tinggi
    return () => clearTimeout(timer)
  }, [map, batas, garis, kunciRute])

  useEffect(() => {
    if (typeof ResizeObserver === 'undefined') return undefined
    const pengamat = new ResizeObserver(() => map.invalidateSize())
    pengamat.observe(map.getContainer())
    return () => pengamat.disconnect()
  }, [map])

  return null
}

function TombolPusat({ batas }) {
  const map = useMap()
  return (
    <button type="button" onClick={() => map.fitBounds(batas, { padding: [8, 8] })} className="absolute left-2.5 top-2.5 z-[1000] rounded-lg bg-white px-3 py-2 text-xs font-semibold text-slate-900 shadow-md hover:bg-slate-50" aria-label="Kembali ke tampilan seluruh kawasan FMIPA">
      Seluruh kawasan
    </button>
  )
}

const PRIORITAS = { pusat: 0, jurusan: 1, lab: 2, lainnya: 3, taman: 4 }

/** Tampilkan label sebanyak mungkin tanpa saling menimpa; gedung yang lebih penting didahulukan. */
function labelTerlihat(map, bentuk) {
  const terlihat = new Set()
  if (map.getZoom() < 16) return terlihat
  const kotak = []
  const urut = [...bentuk].sort((a, b) => (PRIORITAS[a.kelompok] ?? 9) - (PRIORITAS[b.kelompok] ?? 9))
  for (const b of urut) {
    const p = map.latLngToContainerPoint([b.pusat.lat, b.pusat.lon])
    const w = b.label.length * 7.2 + 12
    const h = 18
    const k = { x1: p.x - w / 2, x2: p.x + w / 2, y1: p.y - h / 2, y2: p.y + h / 2 }
    const bertabrakan = kotak.some((o) => k.x1 < o.x2 && k.x2 > o.x1 && k.y1 < o.y2 && k.y2 > o.y1)
    if (!bertabrakan) {
      kotak.push(k)
      terlihat.add(b.tempatId)
    }
  }
  return terlihat
}

function LabelGedung({ bentuk, berpin }) {
  const map = useMap()
  const [versi, setVersi] = useState(0)
  useMapEvents({ zoomend: () => setVersi((v) => v + 1), moveend: () => setVersi((v) => v + 1) })
  const ikon = useMemo(() => new Map(bentuk.map((b) => [b.tempatId, [ikonLabel(b.label), ikonLabel(b.label, true)]])), [bentuk])
  const terlihat = useMemo(() => {
    void versi // hitung ulang setiap zoom atau geser
    return labelTerlihat(map, bentuk)
  }, [map, bentuk, versi])
  return bentuk
    .filter((b) => terlihat.has(b.tempatId))
    .map((b) => <Marker key={b.tempatId} position={[b.pusat.lat, b.pusat.lon]} icon={ikon.get(b.tempatId)[berpin.has(b.tempatId) ? 1 : 0]} interactive={false} keyboard={false} zIndexOffset={-100} />)
}

export default function MapView({ bentuk, batas, edges, pointsById, tampilJalur, garisRute, kunciRute, asal, tujuan, tujuanTempatId, terpilih, posisiPengguna, pilihPeta, onPilihTempat, onBatalPilih }) {
  const [petaSiap, setPetaSiap] = useState(false)
  const garisJalur = useMemo(
    () => edges.features.map((f) => ({ id: f.properties.id, positions: (f.geometry.type === 'MultiLineString' ? f.geometry.coordinates.flat() : f.geometry.coordinates).map(([lon, lat]) => [lat, lon]) })),
    [edges]
  )
  const pinAsal = useMemo(() => ikonPin('A', 'pin-a'), [])
  const pinTujuan = useMemo(() => ikonPin('B', 'pin-b'), [])
  const titikAsal = asal && pointsById[asal.titikId]
  const titikTujuan = tujuan && pointsById[tujuan]

  return (
    <div className="relative h-full w-full" data-pilih={pilihPeta || ''}>
      <MapContainer bounds={batas} boundsOptions={{ padding: [8, 8] }} minZoom={15} maxZoom={21} zoomSnap={0.25} zoomControl={false} className="h-full w-full" whenReady={() => setPetaSiap(true)} aria-label="Peta kawasan FMIPA Unimed">
        <TileLayer url="https://tile.openstreetmap.org/{z}/{x}/{y}.png" attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' maxZoom={21} maxNativeZoom={19} />
        <ZoomControl position="bottomright" />
        <AturPandangan batas={batas} garis={garisRute} kunciRute={kunciRute} />

        {bentuk.map((b) => {
          const warna = KELOMPOK[b.kelompok]?.warna || '#475569'
          const aktif = terpilih === b.tempatId || asal?.tempatId === b.tempatId || tujuan === b.tempatId
          return (
            <Polygon
              key={b.tempatId}
              positions={b.positions}
              pathOptions={{ color: warna, weight: aktif ? 4 : 2, fillColor: warna, fillOpacity: aktif ? 0.55 : 0.32 }}
              eventHandlers={{ click: () => onPilihTempat(b.tempatId) }}
            >
              <Tooltip direction="top" sticky>{b.label}</Tooltip>
            </Polygon>
          )
        })}

        {tampilJalur && garisJalur.map((g) => <Polyline key={g.id} positions={g.positions} interactive={false} pathOptions={{ color: '#64748b', weight: 3, opacity: 0.7 }} />)}

        {garisRute && garisRute.length > 1 && (
          <>
            <Polyline positions={garisRute} interactive={false} pathOptions={{ color: '#ffffff', weight: 11, opacity: 0.95, lineCap: 'round', lineJoin: 'round' }} />
            <Polyline positions={garisRute} interactive={false} pathOptions={{ color: '#1d4ed8', weight: 6, opacity: 1, lineCap: 'round', lineJoin: 'round' }} />
          </>
        )}

        {asal?.jenis === 'gps' && titikAsal && asal.jarak > 4 && (
          <Polyline positions={[[asal.lat, asal.lon], [titikAsal.lat, titikAsal.lon]]} interactive={false} pathOptions={{ color: '#1d4ed8', weight: 3, dashArray: '4 6' }} />
        )}

        <LabelGedung bentuk={bentuk} berpin={new Set([asal?.tempatId, tujuanTempatId].filter(Boolean))} />

        {titikAsal && <Marker position={[titikAsal.lat, titikAsal.lon]} icon={pinAsal} keyboard={false} title="Titik awal" />}
        {titikTujuan && <Marker position={[titikTujuan.lat, titikTujuan.lon]} icon={pinTujuan} keyboard={false} title="Tujuan" />}

        {posisiPengguna && (
          <>
            {posisiPengguna.akurasi > 0 && <Circle center={[posisiPengguna.lat, posisiPengguna.lon]} radius={posisiPengguna.akurasi} interactive={false} pathOptions={{ color: '#2563eb', weight: 1, fillColor: '#3b82f6', fillOpacity: 0.12 }} />}
            <CircleMarker center={[posisiPengguna.lat, posisiPengguna.lon]} radius={8} interactive={false} pathOptions={{ color: '#ffffff', weight: 3, fillColor: '#2563eb', fillOpacity: 1 }} />
          </>
        )}

        <TombolPusat batas={batas} />
      </MapContainer>

      <div className="pointer-events-none absolute right-2.5 top-2.5 z-[1000] flex h-10 w-10 flex-col items-center justify-center rounded-full bg-white/95 text-[10px] font-bold leading-none text-slate-800 shadow-md" aria-label="Utara berada di bagian atas peta">
        <span className="text-red-600">▲</span>U
      </div>

      <Legenda />

      {pilihPeta && (
        <div role="status" className="absolute left-1/2 top-2.5 z-[1100] flex w-[calc(100%-6rem)] max-w-sm -translate-x-1/2 items-center gap-2 rounded-xl bg-slate-900 px-3 py-2 text-sm text-white shadow-lg">
          <span className="flex-1">Ketuk gedung di peta untuk memilih {pilihPeta === 'asal' ? 'titik awal' : 'tujuan'}.</span>
          <button type="button" onClick={onBatalPilih} className="rounded-lg bg-white/15 px-2.5 py-1 font-semibold hover:bg-white/25">Batal</button>
        </div>
      )}
      {!petaSiap && <span className="sr-only">Memuat peta…</span>}
    </div>
  )
}
