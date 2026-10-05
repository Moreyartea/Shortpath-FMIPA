// src/App.jsx

import { useEffect, useMemo, useState } from 'react'
import MapView from './components/MapView'
import {
  buildGraph,
  findRoute,
  findRouteAStar,
} from './lib/graph'

import koordinat from './data/koordinat_fmipa.geojson?url'
import edges from './data/edges_fmipa.geojson?url'

const gedungList = [
  { id: '001', nama: 'Gedung Fisika' },
  { id: '002', nama: 'Gedung Biologi' },
  { id: '003', nama: 'Gedung Matematika' },
  { id: '004', nama: 'Gedung Kimia' },
  { id: '005', nama: 'Syawal' },
  { id: '006', nama: 'Lab. Kimia' },
  { id: '007', nama: 'Lab. Komputer' },
  { id: '008', nama: 'Lab. Biologi' },
  { id: '009', nama: 'Gedung Belajar Bersama' },
  { id: '010', nama: 'Lab. Fisika' },
  { id: '011', nama: 'Gedung Bilingual' },
  { id: '012', nama: 'Rumah Kaca' },
  { id: '013', nama: 'Rumah Hewan FMIPA' },
  { id: '014', nama: 'Taman Biologi' },
  { id: '015', nama: 'Ruang Serbaguna Taman' },
]

function App() {
  const [asal, setAsal] = useState('')
  const [tujuan, setTujuan] = useState('')
  const [graphData, setGraphData] = useState(null)
  const [route, setRoute] = useState(null)
  const [comparison, setComparison] = useState(null)
  const [error, setError] = useState('')
  const [showAllRoutes, setShowAllRoutes] = useState(false)

  const gedungById = useMemo(() => {
    return Object.fromEntries(
      gedungList.map((gedung) => [
        gedung.id,
        gedung,
      ])
    )
  }, [])

  const namaAsal = gedungById[asal]?.nama || ''
  const namaTujuan =
    gedungById[tujuan]?.nama || ''

  useEffect(() => {
    async function loadGraphData() {
      try {
        const [pointsResponse, edgesResponse] =
          await Promise.all([
            fetch(koordinat),
            fetch(edges),
          ])

        if (
          !pointsResponse.ok ||
          !edgesResponse.ok
        ) {
          throw new Error(
            'Data GeoJSON gagal dimuat.'
          )
        }

        const pointsGeoJson =
          await pointsResponse.json()

        const edgesGeoJson =
          await edgesResponse.json()

        const data = buildGraph(
          pointsGeoJson,
          edgesGeoJson
        )

        setGraphData(data)
      } catch (err) {
        setError(err.message)
      }
    }

    loadGraphData()
  }, [])

  const handleAsalChange = (event) => {
    setAsal(event.target.value)
    setRoute(null)
    setComparison(null)
    setError('')
  }

  const handleTujuanChange = (event) => {
    setTujuan(event.target.value)
    setRoute(null)
    setComparison(null)
    setError('')
  }

  const handleSubmit = (event) => {
    event.preventDefault()

    setError('')
    setRoute(null)
    setComparison(null)

    if (!asal || !tujuan) {
      setError(
        'Pilih gedung asal dan tujuan terlebih dahulu.'
      )
      return
    }

    if (asal === tujuan) {
      setError(
        'Gedung asal dan tujuan harus berbeda.'
      )
      return
    }

    if (!graphData) {
      setError(
        'Data jaringan belum selesai dimuat.'
      )
      return
    }

    try {
      const dijkstraStart = performance.now()

      const dijkstraResult = findRoute(
        graphData.graph,
        graphData.pointsById,
        asal,
        tujuan
      )

      const dijkstraEnd = performance.now()

      if (!dijkstraResult.found) {
        setError(
          'Tidak ditemukan rute antara kedua gedung.'
        )
        return
      }

      const aStarStart = performance.now()

      const aStarResult = findRouteAStar(
        graphData.graph,
        graphData.pointsById,
        asal,
        tujuan
      )

      const aStarEnd = performance.now()

      if (!aStarResult.found) {
        setError(
          'A* tidak menemukan rute antara kedua gedung.'
        )
        return
      }

      const dijkstraTime =
        dijkstraEnd - dijkstraStart

      const aStarTime =
        aStarEnd - aStarStart

      const distanceDifference = Math.abs(
        dijkstraResult.distance -
          aStarResult.distance
      )

      setRoute({
        ...dijkstraResult,
        executionTime: dijkstraTime,
      })

      setComparison({
        dijkstra: {
          distance: dijkstraResult.distance,
          visitedCount:
            dijkstraResult.visitedCount,
          executionTime: dijkstraTime,
        },
        aStar: {
          distance: aStarResult.distance,
          visitedCount:
            aStarResult.visitedCount,
          executionTime: aStarTime,
        },
        distanceDifference,
      })
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <div className="h-screen w-screen overflow-hidden bg-slate-100">
      <div className="relative h-full w-full">
        <MapView
          routeEdgeIds={route?.edgeIds || []}
          routePath={route?.latLng || []}
          routePointIds={route?.path || []}
          startName={namaAsal}
          destinationName={namaTujuan}
          showAllRoutes={showAllRoutes}
        />

        <div className="absolute left-3 top-3 z-[1000] w-[calc(100%-1.5rem)] max-w-md sm:left-4 sm:top-4 sm:w-[calc(100%-2rem)]">
          <div className="max-h-[calc(100vh-1.5rem)] overflow-y-auto rounded-2xl bg-white/95 p-4 shadow-2xl backdrop-blur sm:max-h-[calc(100vh-2rem)] sm:p-5">
            <div>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                    FMIPA UNIMED
                  </p>

                  <h1 className="mt-1 text-xl font-bold text-slate-900 sm:text-2xl">
                    Pencarian Rute
                  </h1>
                </div>

                <div className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
                  Dijkstra
                </div>
              </div>

              <p className="mt-1 text-sm text-slate-500">
                Temukan jalur tercepat antar gedung.
              </p>
            </div>

            <form
              onSubmit={handleSubmit}
              className="mt-5 space-y-3"
            >
              <div>
                <label
                  htmlFor="asal"
                  className="mb-1.5 block text-sm font-semibold text-slate-700"
                >
                  Dari
                </label>

                <select
                  id="asal"
                  value={asal}
                  onChange={handleAsalChange}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
                >
                  <option value="">
                    Pilih gedung asal
                  </option>

                  {gedungList.map((gedung) => (
                    <option
                      key={gedung.id}
                      value={gedung.id}
                    >
                      {gedung.nama}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label
                  htmlFor="tujuan"
                  className="mb-1.5 block text-sm font-semibold text-slate-700"
                >
                  Ke
                </label>

                <select
                  id="tujuan"
                  value={tujuan}
                  onChange={handleTujuanChange}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
                >
                  <option value="">
                    Pilih gedung tujuan
                  </option>

                  {gedungList.map((gedung) => (
                    <option
                      key={gedung.id}
                      value={gedung.id}
                    >
                      {gedung.nama}
                    </option>
                  ))}
                </select>
              </div>

              <button
                type="submit"
                disabled={!graphData}
                className="w-full rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {graphData
                  ? 'Cari Rute'
                  : 'Memuat jaringan...'}
              </button>
            </form>

            <button
              type="button"
              onClick={() =>
                setShowAllRoutes(
                  (current) => !current
                )
              }
              className="mt-3 flex w-full items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
            >
              <span>
                Tampilkan semua jalur
              </span>

              <span
                className={`relative h-6 w-11 rounded-full transition ${
                  showAllRoutes
                    ? 'bg-slate-900'
                    : 'bg-slate-300'
                }`}
              >
                <span
                  className={`absolute top-1 h-4 w-4 rounded-full bg-white transition ${
                    showAllRoutes
                      ? 'left-6'
                      : 'left-1'
                  }`}
                />
              </span>
            </button>

            {error && (
              <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-3 py-3 text-sm text-red-700">
                {error}
              </div>
            )}

            {route && (
              <div className="mt-4 rounded-2xl bg-slate-900 p-4 text-white">
                <p className="text-xs font-medium text-slate-300">
                  Rute ditemukan
                </p>

                <div className="mt-2">
                  <p className="text-sm text-slate-300">
                    {namaAsal}
                  </p>

                  <p className="my-1 text-lg font-semibold">
                    ↓
                  </p>

                  <p className="text-base font-bold">
                    {namaTujuan}
                  </p>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-2">
                  <div className="rounded-xl bg-white/10 p-3">
                    <p className="text-xs text-slate-300">
                      Jarak
                    </p>

                    <p className="mt-1 text-sm font-semibold">
                      {route.distance.toFixed(1)} m
                    </p>
                  </div>

                  <div className="rounded-xl bg-white/10 p-3">
                    <p className="text-xs text-slate-300">
                      Titik diperiksa
                    </p>

                    <p className="mt-1 text-sm font-semibold">
                      {route.visitedCount}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {comparison && (
              <div className="mt-5">
                <h2 className="text-sm font-bold text-slate-900">
                  Perbandingan algoritma
                </h2>

                <div className="mt-2 overflow-hidden rounded-xl border border-slate-200">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-100 text-slate-600">
                      <tr>
                        <th className="px-3 py-2 font-semibold">
                          Algoritma
                        </th>

                        <th className="px-3 py-2 font-semibold">
                          Jarak
                        </th>

                        <th className="px-3 py-2 font-semibold">
                          Titik
                        </th>

                        <th className="px-3 py-2 font-semibold">
                          Waktu
                        </th>
                      </tr>
                    </thead>

                    <tbody className="divide-y divide-slate-200">
                      <tr>
                        <td className="px-3 py-2 font-medium text-slate-900">
                          Dijkstra
                        </td>

                        <td className="px-3 py-2 text-slate-600">
                          {comparison.dijkstra.distance.toFixed(
                            1
                          )}{' '}
                          m
                        </td>

                        <td className="px-3 py-2 text-slate-600">
                          {comparison.dijkstra.visitedCount}
                        </td>

                        <td className="px-3 py-2 text-slate-600">
                          {comparison.dijkstra.executionTime.toFixed(
                            3
                          )}{' '}
                          ms
                        </td>
                      </tr>

                      <tr>
                        <td className="px-3 py-2 font-medium text-slate-900">
                          A*
                        </td>

                        <td className="px-3 py-2 text-slate-600">
                          {comparison.aStar.distance.toFixed(
                            1
                          )}{' '}
                          m
                        </td>

                        <td className="px-3 py-2 text-slate-600">
                          {comparison.aStar.visitedCount}
                        </td>

                        <td className="px-3 py-2 text-slate-600">
                          {comparison.aStar.executionTime.toFixed(
                            3
                          )}{' '}
                          ms
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                <div className="mt-2 rounded-xl bg-slate-50 px-3 py-2 text-xs text-slate-600">
                  {comparison.distanceDifference <=
                  0.001
                    ? '✓ Jarak Dijkstra dan A* sama.'
                    : `⚠ Selisih jarak: ${comparison.distanceDifference.toFixed(
                        3
                      )} m`}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default App