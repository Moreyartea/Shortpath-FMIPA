// src/lib/graph.test.js

import { describe, expect, test } from 'vitest'
import { readFileSync } from 'node:fs'

import {
  buildGraph,
  dijkstra,
  aStar,
  floydWarshall,
  gedungTitik,
} from './graph'

function loadGeoJson(relativePath) {
  const url = new URL(
    relativePath,
    import.meta.url
  )

  return JSON.parse(
    readFileSync(url, 'utf8')
  )
}

function minimumBuildingDistance(
  distances,
  startIds,
  targetIds
) {
  let minimum = Infinity

  for (const startId of startIds) {
    for (const targetId of targetIds) {
      const distance =
        distances[startId]?.[targetId] ??
        Infinity

      minimum = Math.min(
        minimum,
        distance
      )
    }
  }

  return minimum
}

const pointsGeoJson = loadGeoJson(
  '../data/koordinat_fmipa.geojson'
)

const edgesGeoJson = loadGeoJson(
  '../data/edges_fmipa.geojson'
)

const graphData = buildGraph(
  pointsGeoJson,
  edgesGeoJson
)

const { graph, pointsById } = graphData

describe('Shortest Path FMIPA', () => {
  test('graf berhasil dibentuk dari GeoJSON', () => {
    expect(
      Object.keys(pointsById).length
    ).toBeGreaterThan(0)

    expect(
      Object.keys(graph).length
    ).toBe(
      Object.keys(pointsById).length
    )
  })

  test('Dijkstra dan Floyd-Warshall sama untuk semua pasangan gedung', () => {
    const distances = floydWarshall(graph)
    const buildingIds =
      Object.keys(gedungTitik)

    for (const asal of buildingIds) {
      for (const tujuan of buildingIds) {
        const startIds =
          gedungTitik[asal]

        const targetIds =
          gedungTitik[tujuan]

        const dijkstraResult =
          dijkstra(
            graph,
            startIds,
            targetIds
          )

        const floydDistance =
          minimumBuildingDistance(
            distances,
            startIds,
            targetIds
          )

        expect(
          dijkstraResult.found
            ? dijkstraResult.distance
            : Infinity
        ).toBeCloseTo(
          floydDistance,
          3
        )
      }
    }
  })

  test('Dijkstra dan A* sama untuk semua pasangan gedung', () => {
    const buildingIds =
      Object.keys(gedungTitik)

    for (const asal of buildingIds) {
      for (const tujuan of buildingIds) {
        const dijkstraResult =
          dijkstra(
            graph,
            gedungTitik[asal],
            gedungTitik[tujuan]
          )

        const aStarResult =
          aStar(
            graph,
            pointsById,
            gedungTitik[asal],
            gedungTitik[tujuan]
          )

        expect(
          aStarResult.found
            ? aStarResult.distance
            : Infinity
        ).toBeCloseTo(
          dijkstraResult.found
            ? dijkstraResult.distance
            : Infinity,
          3
        )
      }
    }
  })

  test('asal sama dengan tujuan menghasilkan jarak nol', () => {
    const result = dijkstra(
      graph,
      gedungTitik['001'],
      gedungTitik['001']
    )

    expect(result.found).toBe(true)
    expect(result.distance).toBe(0)
    expect(result.path.length).toBe(1)
  })

  test('gedung Syawal menggunakan banyak titik', () => {
    expect(
      gedungTitik['005']
    ).toEqual([5, 6, 7, 8])

    const result = dijkstra(
      graph,
      gedungTitik['001'],
      gedungTitik['005']
    )

    expect(result.found).toBe(true)
    expect(
      gedungTitik['005']
    ).toContain(result.targetId)
  })

  test('Floyd-Warshall menghasilkan jarak nol pada diagonal', () => {
    const distances =
      floydWarshall(graph)

    for (const nodeId of Object.keys(graph)) {
      const id = Number(nodeId)

      expect(
        distances[id][id]
      ).toBe(0)
    }
  })
})