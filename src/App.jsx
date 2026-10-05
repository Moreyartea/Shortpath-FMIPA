import { useEffect, useMemo, useState } from 'react'
import MapView from './components/MapView'
import AdminPanel from './components/AdminPanel'
import roomsSeed from './data/rooms.json'
import { BUILDINGS, OFFICIAL_TO_GRAPH, getBuildingByGraphId } from './lib/buildings'
import { findRoute, findRouteAStar, findRouteFromPoint, findRouteAStarFromPoint, buildGraph } from './lib/graph'
import { searchRooms, deduplicateRoomResults } from './lib/search'
import { findNearestPoint, getCurrentPosition } from './lib/gps'
import { isSupabaseConfigured, listRooms } from './lib/supabase'
import koordinat from './data/koordinat_fmipa.geojson?url'
import edges from './data/edges_fmipa.geojson?url'

function App() {
  const [page, setPage] = useState('map')
  const [asal, setAsal] = useState('')
  const [tujuan, setTujuan] = useState('')
  const [graphData, setGraphData] = useState(null)
  const [route, setRoute] = useState(null)
  const [comparison, setComparison] = useState(null)
  const [error, setError] = useState('')
  const [showAllRoutes, setShowAllRoutes] = useState(false)
  const [rooms, setRooms] = useState(roomsSeed)
  const [roomQuery, setRoomQuery] = useState('')
  const [roomResults, setRoomResults] = useState([])
  const [selectedRoom, setSelectedRoom] = useState(null)
  const [userLocation, setUserLocation] = useState(null)
  const [gpsLoading, setGpsLoading] = useState(false)
  const [gpsPoint, setGpsPoint] = useState(null)
  const [originMode, setOriginMode] = useState('building')

  const graphById = useMemo(() => Object.fromEntries(BUILDINGS.map((building) => [building.graphId, building])), [])
  const namaAsal = originMode === 'gps' ? 'Lokasi Anda' : graphById[asal]?.name || ''
  const destination = graphById[tujuan]
  const namaTujuan = destination?.name || ''

  const loadRooms = async () => {
    if (!isSupabaseConfigured()) return
    try {
      const data = await listRooms()
      if (Array.isArray(data) && data.length > 0) {
        setRooms(data.map((room) => ({
          ...room,
          kode: room.kode,
          kodeGedung: room.gedung_id,
          namaGedung: graphById[OFFICIAL_TO_GRAPH[room.gedung_id]]?.name || room.gedung_id,
        })))
      }
    } catch {
      setRooms(roomsSeed)
    }
  }

  useEffect(() => {
    async function loadGraphData() {
      try {
        const [pointsResponse, edgesResponse] = await Promise.all([fetch(koordinat), fetch(edges)])
        if (!pointsResponse.ok || !edgesResponse.ok) throw new Error('Data jaringan gagal dimuat.')
        setGraphData(buildGraph(await pointsResponse.json(), await edgesResponse.json()))
      } catch (err) { setError(err.message) }
    }
    loadGraphData()
    loadRooms()
  }, [])

  useEffect(() => {
    const results = deduplicateRoomResults(searchRooms(rooms, roomQuery))
    setRoomResults(results.slice(0, 12))
  }, [roomQuery, rooms])

  const clearRoute = () => { setRoute(null); setComparison(null); setError('') }

  const runRoute = (startBuildingId, targetBuildingId, startPointId = null) => {
    if (!graphData) throw new Error('Data jaringan belum selesai dimuat.')
    if (!targetBuildingId) throw new Error('Pilih gedung tujuan terlebih dahulu.')
    const dijkstraStart = performance.now()
    const dijkstraResult = startPointId ? findRouteFromPoint(graphData.graph, graphData.pointsById, startPointId, targetBuildingId) : findRoute(graphData.graph, graphData.pointsById, startBuildingId, targetBuildingId)
    const dijkstraTime = performance.now() - dijkstraStart
    if (!dijkstraResult.found) throw new Error('Tidak ditemukan rute antara lokasi asal dan tujuan.')
    const aStarStart = performance.now()
    const aStarResult = startPointId ? findRouteAStarFromPoint(graphData.graph, graphData.pointsById, startPointId, targetBuildingId) : findRouteAStar(graphData.graph, graphData.pointsById, startBuildingId, targetBuildingId)
    const aStarTime = performance.now() - aStarStart
    if (!aStarResult.found) throw new Error('A* tidak menemukan rute.')
    setRoute({ ...dijkstraResult, executionTime: dijkstraTime })
    setComparison({ dijkstra: { distance: dijkstraResult.distance, visitedCount: dijkstraResult.visitedCount, executionTime: dijkstraTime }, aStar: { distance: aStarResult.distance, visitedCount: aStarResult.visitedCount, executionTime: aStarTime }, distanceDifference: Math.abs(dijkstraResult.distance - aStarResult.distance) })
  }

  const handleSubmit = (event) => {
    event.preventDefault(); clearRoute()
    if (!tujuan) return setError('Pilih gedung tujuan terlebih dahulu.')
    if (originMode === 'building' && !asal) return setError('Pilih gedung asal terlebih dahulu.')
    if (originMode === 'building' && asal === tujuan) return setError('Gedung asal dan tujuan harus berbeda.')
    try { runRoute(asal, tujuan, originMode === 'gps' ? gpsPoint?.id : null) } catch (err) { setError(err.message) }
  }

  const useGps = async () => {
    setGpsLoading(true); setError('')
    try {
      if (!graphData) throw new Error('Jaringan belum selesai dimuat.')
      const position = await getCurrentPosition()
      const location = { lat: position.coords.latitude, lon: position.coords.longitude }
      const nearest = findNearestPoint(location, graphData.pointsById)
      setUserLocation(location); setGpsPoint(nearest); setOriginMode('gps'); setAsal('')
      setError('')
    } catch (err) {
      setError(err.code === 1 ? 'Izin lokasi ditolak. Aktifkan GPS atau pilih asal manual.' : err.message)
    } finally { setGpsLoading(false) }
  }

  const selectRoom = (room) => {
    setSelectedRoom(room)
    const graphId = OFFICIAL_TO_GRAPH[room.kodeGedung]
    if (!graphId) { setError('Gedung ruangan ini belum memiliki titik jaringan pada peta.'); return }
    setTujuan(graphId); setPage('map'); clearRoute()
    setTimeout(() => { if (originMode === 'gps' && gpsPoint) { try { runRoute(null, graphId, gpsPoint.id) } catch (err) { setError(err.message) } } }, 0)
  }

  const resetSearch = () => { setRoomQuery(''); setRoomResults([]); setSelectedRoom(null) }

  return <div className="h-screen w-screen overflow-hidden bg-slate-100">
    {page === 'map' ? <div className="relative h-full w-full">
      <MapView routeEdgeIds={route?.edgeIds || []} routePath={route?.latLng || []} routePointIds={route?.path || []} startName={namaAsal} destinationName={namaTujuan} showAllRoutes={showAllRoutes} userLocation={userLocation} />
      <div className="absolute left-3 top-3 z-[1000] w-[calc(100%-1.5rem)] max-w-md sm:left-4 sm:top-4 sm:w-[calc(100%-2rem)]">
        <div className="max-h-[calc(100vh-1.5rem)] overflow-y-auto rounded-2xl bg-white/95 p-4 shadow-2xl backdrop-blur sm:max-h-[calc(100vh-2rem)] sm:p-5">
          <div className="flex items-start justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-wider text-slate-500">FMIPA UNIMED</p><h1 className="mt-1 text-xl font-bold text-slate-900 sm:text-2xl">Peta & Pencarian Rute</h1><p className="mt-1 text-sm text-slate-500">Cari gedung atau ruangan dan temukan jalur tercepat.</p></div><button onClick={() => setPage('admin')} className="rounded-xl border px-3 py-2 text-xs font-semibold">Admin</button></div>
          <form onSubmit={handleSubmit} className="mt-5 space-y-3">
            <div className="flex gap-2"><button type="button" onClick={() => { setOriginMode('building'); clearRoute() }} className={`flex-1 rounded-xl px-3 py-2 text-sm font-semibold ${originMode === 'building' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-700'}`}>Asal Gedung</button><button type="button" onClick={useGps} className={`flex-1 rounded-xl px-3 py-2 text-sm font-semibold ${originMode === 'gps' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-700'}`}>{gpsLoading ? 'Mencari GPS...' : 'Gunakan GPS'}</button></div>
            {originMode === 'building' && <select value={asal} onChange={(e) => { setAsal(e.target.value); clearRoute() }} className="w-full rounded-xl border border-slate-300 bg-white px-3 py-3 text-sm"><option value="">Pilih gedung asal</option>{BUILDINGS.map((b) => <option key={b.graphId} value={b.graphId}>{b.code !== '-' ? `${b.code} — ` : ''}{b.name}</option>)}</select>}
            <select value={tujuan} onChange={(e) => { setTujuan(e.target.value); clearRoute() }} className="w-full rounded-xl border border-slate-300 bg-white px-3 py-3 text-sm"><option value="">Pilih gedung tujuan</option>{BUILDINGS.map((b) => <option key={b.graphId} value={b.graphId}>{b.code !== '-' ? `${b.code} — ` : ''}{b.name}</option>)}</select>
            <button disabled={!graphData || (originMode === 'gps' && !gpsPoint)} className="w-full rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50">{graphData ? 'Cari Rute' : 'Memuat jaringan...'}</button>
          </form>
          <div className="mt-4 rounded-2xl border border-slate-200 p-3"><div className="flex items-center justify-between"><label className="text-sm font-semibold text-slate-700">Cari ruangan</label><button onClick={resetSearch} className="text-xs text-slate-500">Bersihkan</button></div><input value={roomQuery} onChange={(e) => setRoomQuery(e.target.value)} placeholder="Contoh: ruang tata usaha" className="mt-2 w-full rounded-xl border px-3 py-3 text-sm" />{roomResults.length > 0 && <div className="mt-2 max-h-56 overflow-auto rounded-xl border divide-y">{roomResults.map((room) => <button key={`${room.kode}-${room.barisCsv || ''}`} onClick={() => selectRoom(room)} className="block w-full px-3 py-3 text-left hover:bg-slate-50"><p className="text-sm font-semibold text-slate-900">{room.nama}</p><p className="mt-0.5 text-xs text-slate-500">{room.kode} · {room.namaGedung || room.kodeGedung} · Lantai {room.lantai}</p></button>)}</div>}</div>
          {selectedRoom && <div className="mt-3 rounded-xl bg-slate-50 p-3 text-sm"><p className="font-semibold">Tujuan ruangan</p><p className="mt-1 text-slate-700">{selectedRoom.nama}</p><p className="text-xs text-slate-500">{selectedRoom.kode} · {selectedRoom.namaGedung}</p></div>}
          <button type="button" onClick={() => setShowAllRoutes((value) => !value)} className="mt-3 flex w-full items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm font-medium text-slate-700"><span>Tampilkan semua jalur</span><span className={`relative h-6 w-11 rounded-full ${showAllRoutes ? 'bg-slate-900' : 'bg-slate-300'}`}><span className={`absolute top-1 h-4 w-4 rounded-full bg-white ${showAllRoutes ? 'left-6' : 'left-1'}`} /></span></button>
          {error && <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-3 py-3 text-sm text-red-700">{error}</div>}
          {route && <div className="mt-4 rounded-2xl bg-slate-900 p-4 text-white"><p className="text-xs font-medium text-slate-300">Rute ditemukan</p><div className="mt-2"><p className="text-sm text-slate-300">{namaAsal}</p><p className="my-1 text-lg">↓</p><p className="text-base font-bold">{namaTujuan}</p></div><div className="mt-4 grid grid-cols-2 gap-2"><div className="rounded-xl bg-white/10 p-3"><p className="text-xs text-slate-300">Jarak</p><p className="mt-1 text-sm font-semibold">{route.distance.toFixed(1)} m</p></div><div className="rounded-xl bg-white/10 p-3"><p className="text-xs text-slate-300">Titik diperiksa</p><p className="mt-1 text-sm font-semibold">{route.visitedCount}</p></div></div></div>}
          {comparison && <div className="mt-5"><h2 className="text-sm font-bold text-slate-900">Perbandingan algoritma</h2><div className="mt-2 overflow-hidden rounded-xl border border-slate-200"><table className="w-full text-left text-xs"><thead className="bg-slate-100"><tr><th className="px-3 py-2">Algoritma</th><th className="px-3 py-2">Jarak</th><th className="px-3 py-2">Titik</th><th className="px-3 py-2">Waktu</th></tr></thead><tbody className="divide-y"><tr><td className="px-3 py-2 font-medium">Dijkstra</td><td className="px-3 py-2">{comparison.dijkstra.distance.toFixed(1)} m</td><td className="px-3 py-2">{comparison.dijkstra.visitedCount}</td><td className="px-3 py-2">{comparison.dijkstra.executionTime.toFixed(3)} ms</td></tr><tr><td className="px-3 py-2 font-medium">A*</td><td className="px-3 py-2">{comparison.aStar.distance.toFixed(1)} m</td><td className="px-3 py-2">{comparison.aStar.visitedCount}</td><td className="px-3 py-2">{comparison.aStar.executionTime.toFixed(3)} ms</td></tr></tbody></table></div><div className="mt-2 rounded-xl bg-slate-50 px-3 py-2 text-xs text-slate-600">{comparison.distanceDifference <= 0.001 ? '✓ Jarak Dijkstra dan A* sama.' : `Selisih jarak: ${comparison.distanceDifference.toFixed(3)} m`}</div></div>}
        </div>
      </div>
    </div> : <div className="h-full overflow-auto bg-slate-100 p-4 sm:p-8"><div className="mx-auto max-w-5xl"><button onClick={() => setPage('map')} className="mb-4 rounded-xl border bg-white px-3 py-2 text-sm">← Kembali ke Peta</button><AdminPanel rooms={rooms} onRoomsChange={loadRooms} /></div></div>}
  </div>
}

export default App
