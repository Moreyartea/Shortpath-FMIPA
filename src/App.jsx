// src/App.jsx

import { useEffect, useState } from 'react'
import MapView from './components/MapView'
import {
  buildGraph,
  findRoute,
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
  const [error, setError] = useState('')

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
    setError('')
  }

  const handleTujuanChange = (event) => {
    setTujuan(event.target.value)
    setRoute(null)
    setError('')
  }

  const handleSubmit = (event) => {
    event.preventDefault()

    setError('')
    setRoute(null)

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
      const startTime = performance.now()

      const result = findRoute(
        graphData.graph,
        graphData.pointsById,
        asal,
        tujuan
      )

      const endTime = performance.now()

      if (!result.found) {
        setError(
          'Tidak ditemukan rute antara kedua gedung.'
        )
        return
      }

      // Debug hasil routing
      console.log('HASIL ROUTE:', result)
      console.log('EDGE IDS:', result.edgeIds)

      setRoute({
        ...result,
        executionTime: endTime - startTime,
      })
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <div className="h-screen w-screen">
      <div className="relative h-full w-full">
        <MapView
          routeEdgeIds={route?.edgeIds || []}
        />

        <div className="absolute left-4 top-4 z-[1000] w-[calc(100%-2rem)] max-w-sm">
          <div className="rounded-2xl bg-white p-5 shadow-xl">
            <h1 className="text-xl font-bold text-slate-900">
              Pemetaan FMIPA Unimed
            </h1>

            <p className="mt-1 text-sm text-slate-500">
              Cari rute tercepat antar gedung
            </p>

            <form
              onSubmit={handleSubmit}
              className="mt-5 space-y-4"
            >
              <div>
                <label
                  htmlFor="asal"
                  className="mb-1 block text-sm font-medium text-slate-700"
                >
                  Gedung asal
                </label>

                <select
                  id="asal"
                  value={asal}
                  onChange={handleAsalChange}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-slate-500"
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
                  className="mb-1 block text-sm font-medium text-slate-700"
                >
                  Gedung tujuan
                </label>

                <select
                  id="tujuan"
                  value={tujuan}
                  onChange={handleTujuanChange}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-slate-500"
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
                  ? 'Tampilkan Rute'
                  : 'Memuat Jaringan...'}
              </button>
            </form>

            {error && (
              <div className="mt-4 rounded-xl bg-red-50 px-3 py-2.5 text-sm text-red-700">
                {error}
              </div>
            )}

            {route && (
              <div className="mt-4 rounded-xl bg-slate-50 p-3">
                <h2 className="text-sm font-semibold text-slate-900">
                  Hasil Rute
                </h2>

                <div className="mt-2 space-y-1 text-sm text-slate-600">
                  <p>
                    Jarak:{' '}
                    <strong>
                      {route.distance.toFixed(1)} m
                    </strong>
                  </p>

                  <p>
                    Titik diperiksa:{' '}
                    <strong>
                      {route.visitedCount}
                    </strong>
                  </p>

                  <p>
                    Waktu eksekusi:{' '}
                    <strong>
                      {route.executionTime.toFixed(3)} ms
                    </strong>
                  </p>
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