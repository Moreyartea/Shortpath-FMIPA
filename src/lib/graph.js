// src/lib/graph.js

export function haversineDistance(lat1, lon1, lat2, lon2) {
  const R = 6371000

  const lat1Rad = (lat1 * Math.PI) / 180
  const lat2Rad = (lat2 * Math.PI) / 180
  const deltaLat = ((lat2 - lat1) * Math.PI) / 180
  const deltaLon = ((lon2 - lon1) * Math.PI) / 180

  const a =
    Math.sin(deltaLat / 2) ** 2 +
    Math.cos(lat1Rad) *
      Math.cos(lat2Rad) *
      Math.sin(deltaLon / 2) ** 2

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))

  return R * c
}

function lineStringLength(coordinates) {
  let total = 0

  for (let i = 1; i < coordinates.length; i += 1) {
    const [lon1, lat1] = coordinates[i - 1]
    const [lon2, lat2] = coordinates[i]

    total += haversineDistance(lat1, lon1, lat2, lon2)
  }

  return total
}

function multiLineStringLength(coordinates) {
  let total = 0

  for (const line of coordinates) {
    total += lineStringLength(line)
  }

  return total
}

export function calculateEdgeWeight(geometry) {
  if (!geometry) {
    throw new Error('Geometry jalur tidak ditemukan.')
  }

  if (geometry.type === 'LineString') {
    return lineStringLength(geometry.coordinates)
  }

  if (geometry.type === 'MultiLineString') {
    return multiLineStringLength(geometry.coordinates)
  }

  throw new Error(
    `Geometry jalur tidak didukung: ${geometry.type}`
  )
}

class MinHeap {
  constructor() {
    this.items = []
  }

  isEmpty() {
    return this.items.length === 0
  }

  push(item) {
    this.items.push(item)
    this.bubbleUp()
  }

  pop() {
    if (this.items.length === 0) {
      return null
    }

    if (this.items.length === 1) {
      return this.items.pop()
    }

    const minimum = this.items[0]
    this.items[0] = this.items.pop()
    this.bubbleDown()

    return minimum
  }

  bubbleUp() {
    let index = this.items.length - 1

    while (index > 0) {
      const parentIndex = Math.floor((index - 1) / 2)

      if (
        this.items[parentIndex].priority <=
        this.items[index].priority
      ) {
        break
      }

      ;[this.items[parentIndex], this.items[index]] = [
        this.items[index],
        this.items[parentIndex],
      ]

      index = parentIndex
    }
  }

  bubbleDown() {
    let index = 0

    while (true) {
      const leftIndex = index * 2 + 1
      const rightIndex = index * 2 + 2

      let smallestIndex = index

      if (
        leftIndex < this.items.length &&
        this.items[leftIndex].priority <
          this.items[smallestIndex].priority
      ) {
        smallestIndex = leftIndex
      }

      if (
        rightIndex < this.items.length &&
        this.items[rightIndex].priority <
          this.items[smallestIndex].priority
      ) {
        smallestIndex = rightIndex
      }

      if (smallestIndex === index) {
        break
      }

      ;[this.items[index], this.items[smallestIndex]] = [
        this.items[smallestIndex],
        this.items[index],
      ]

      index = smallestIndex
    }
  }
}

export function buildGraph(pointsGeoJson, edgesGeoJson) {
  const graph = {}
  const pointsById = {}

  for (const feature of pointsGeoJson.features) {
    const id = Number(feature.properties.id)
    const [lon, lat] = feature.geometry.coordinates

    pointsById[id] = {
      id,
      lat,
      lon,
    }

    graph[id] = []
  }

  for (const edge of edgesGeoJson.features) {
    const edgeId = Number(edge.properties.id)
    const from = Number(edge.properties.asal)
    const to = Number(edge.properties.tujuan)
    const weight = calculateEdgeWeight(edge.geometry)

    if (!graph[from]) {
      graph[from] = []
    }

    if (!graph[to]) {
      graph[to] = []
    }

    graph[from].push({
      to,
      weight,
      edgeId,
    })

    graph[to].push({
      to: from,
      weight,
      edgeId,
    })
  }

  return {
    graph,
    pointsById,
  }
}

function initializeSearch(graph, startIds) {
  const distances = {}
  const previous = {}
  const previousEdge = {}

  for (const nodeId of Object.keys(graph)) {
    distances[nodeId] = Infinity
    previous[nodeId] = null
    previousEdge[nodeId] = null
  }

  for (const startId of startIds) {
    if (graph[startId]) {
      distances[startId] = 0
    }
  }

  return {
    distances,
    previous,
    previousEdge,
  }
}

function reconstructPath(
  targetId,
  previous,
  previousEdge
) {
  const path = []
  const edgeIds = []

  let current = targetId

  while (current !== null) {
    path.unshift(current)

    if (previousEdge[current] !== null) {
      edgeIds.unshift(previousEdge[current])
    }

    current = previous[current]
  }

  return {
    path,
    edgeIds,
  }
}

export function dijkstra(graph, startIds, targetIds = []) {
  const starts = Array.isArray(startIds)
    ? startIds.map(Number)
    : [Number(startIds)]

  const targets = new Set(
    Array.isArray(targetIds)
      ? targetIds.map(Number)
      : [Number(targetIds)]
  )

  const {
    distances,
    previous,
    previousEdge,
  } = initializeSearch(graph, starts)

  const heap = new MinHeap()

  for (const startId of starts) {
    if (!graph[startId]) {
      continue
    }

    heap.push({
      node: startId,
      priority: 0,
      distance: 0,
    })
  }

  let visitedCount = 0
  let reachedTarget = null

  while (!heap.isEmpty()) {
    const current = heap.pop()
    const currentNode = current.node
    const currentDistance = current.distance

    if (currentDistance !== distances[currentNode]) {
      continue
    }

    visitedCount += 1

    if (
      targets.size > 0 &&
      targets.has(Number(currentNode))
    ) {
      reachedTarget = Number(currentNode)
      break
    }

    const neighbors = graph[currentNode] || []

    for (const edge of neighbors) {
      const newDistance =
        currentDistance + edge.weight

      if (newDistance < distances[edge.to]) {
        distances[edge.to] = newDistance
        previous[edge.to] = currentNode
        previousEdge[edge.to] = edge.edgeId

        heap.push({
          node: edge.to,
          priority: newDistance,
          distance: newDistance,
        })
      }
    }
  }

  if (targets.size === 0) {
    return {
      found: true,
      distance: distances,
      previous,
      previousEdge,
      visitedCount,
    }
  }

  if (reachedTarget === null) {
    return {
      found: false,
      distance: Infinity,
      path: [],
      edgeIds: [],
      targetId: null,
      visitedCount,
    }
  }

  const { path, edgeIds } = reconstructPath(
    reachedTarget,
    previous,
    previousEdge
  )

  return {
    found: true,
    distance: distances[reachedTarget],
    path,
    edgeIds,
    targetId: reachedTarget,
    visitedCount,
  }
}

function heuristic(nodeId, targetIds, pointsById) {
  const node = pointsById[nodeId]

  if (!node) {
    return 0
  }

  let minimum = Infinity

  for (const targetId of targetIds) {
    const target = pointsById[targetId]

    if (!target) {
      continue
    }

    const distance = haversineDistance(
      node.lat,
      node.lon,
      target.lat,
      target.lon
    )

    if (distance < minimum) {
      minimum = distance
    }
  }

  return minimum === Infinity ? 0 : minimum
}

export function aStar(
  graph,
  pointsById,
  startIds,
  targetIds = []
) {
  const starts = Array.isArray(startIds)
    ? startIds.map(Number)
    : [Number(startIds)]

  const targets = new Set(
    Array.isArray(targetIds)
      ? targetIds.map(Number)
      : [Number(targetIds)]
  )

  const {
    distances,
    previous,
    previousEdge,
  } = initializeSearch(graph, starts)

  const heap = new MinHeap()

  for (const startId of starts) {
    if (!graph[startId]) {
      continue
    }

    heap.push({
      node: startId,
      priority: heuristic(
        startId,
        targets,
        pointsById
      ),
      distance: 0,
    })
  }

  let visitedCount = 0
  let reachedTarget = null

  while (!heap.isEmpty()) {
    const current = heap.pop()
    const currentNode = current.node
    const currentDistance = current.distance

    if (currentDistance !== distances[currentNode]) {
      continue
    }

    visitedCount += 1

    if (
      targets.size > 0 &&
      targets.has(Number(currentNode))
    ) {
      reachedTarget = Number(currentNode)
      break
    }

    const neighbors = graph[currentNode] || []

    for (const edge of neighbors) {
      const newDistance =
        currentDistance + edge.weight

      if (newDistance < distances[edge.to]) {
        distances[edge.to] = newDistance
        previous[edge.to] = currentNode
        previousEdge[edge.to] = edge.edgeId

        heap.push({
          node: edge.to,
          priority:
            newDistance +
            heuristic(
              edge.to,
              targets,
              pointsById
            ),
          distance: newDistance,
        })
      }
    }
  }

  if (targets.size === 0) {
    return {
      found: true,
      distance: distances,
      previous,
      previousEdge,
      visitedCount,
    }
  }

  if (reachedTarget === null) {
    return {
      found: false,
      distance: Infinity,
      path: [],
      edgeIds: [],
      targetId: null,
      visitedCount,
    }
  }

  const { path, edgeIds } = reconstructPath(
    reachedTarget,
    previous,
    previousEdge
  )

  return {
    found: true,
    distance: distances[reachedTarget],
    path,
    edgeIds,
    targetId: reachedTarget,
    visitedCount,
  }
}

export function floydWarshall(graph) {
  const nodes = Object.keys(graph).map(Number)
  const distances = {}

  for (const from of nodes) {
    distances[from] = {}

    for (const to of nodes) {
      distances[from][to] =
        from === to ? 0 : Infinity
    }
  }

  for (const from of nodes) {
    for (const edge of graph[from] || []) {
      if (
        edge.weight <
        distances[from][edge.to]
      ) {
        distances[from][edge.to] = edge.weight
      }
    }
  }

  for (const middle of nodes) {
    for (const from of nodes) {
      if (distances[from][middle] === Infinity) {
        continue
      }

      for (const to of nodes) {
        if (distances[middle][to] === Infinity) {
          continue
        }

        const throughMiddle =
          distances[from][middle] +
          distances[middle][to]

        if (
          throughMiddle <
          distances[from][to]
        ) {
          distances[from][to] =
            throughMiddle
        }
      }
    }
  }

  return distances
}

export function pathToLatLng(path, pointsById) {
  return path
    .map((pointId) => pointsById[pointId])
    .filter(Boolean)
    .map((point) => [point.lat, point.lon])
}
