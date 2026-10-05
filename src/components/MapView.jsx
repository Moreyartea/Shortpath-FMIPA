// src/components/MapView.jsx

import React from 'react'
import {
  MapContainer,
  TileLayer,
  CircleMarker,
  Popup,
  GeoJSON,
  useMap,
} from 'react-leaflet'
import 'leaflet/dist/leaflet.css'

import koordinat from '../data/koordinat_fmipa.geojson?url'
import gedung from '../data/gedung_fmipa.geojson?url'
import edges from '../data/edges_fmipa.geojson?url'

function MapView({
  routeEdgeIds = [],
  routePath = [],
  routePointIds = [],
  startName = '',
  destinationName = '',
  showAllRoutes = false,
  userLocation = null,
}) {
  const center = [3.6071, 98.7154]

  return (
    <MapContainer
      center={center}
      zoom={18}
      minZoom={16}
      maxZoom={22}
      zoomControl={true}
      scrollWheelZoom={true}
      doubleClickZoom={true}
      touchZoom={true}
      dragging={true}
      className="h-full w-full"
    >
      <TileLayer
        attribution="&copy; OpenStreetMap contributors"
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />

      <GedungFMIPA dataUrl={gedung} />

      <JalurFMIPA
        dataUrl={edges}
        routeEdgeIds={routeEdgeIds}
        showAllRoutes={showAllRoutes}
      />

      <TitikFMIPA dataUrl={koordinat} />

      {userLocation && (
        <CircleMarker
          center={[userLocation.lat, userLocation.lon]}
          radius={10}
          pathOptions={{ weight: 3, fillOpacity: 0.9 }}
        >
          <Popup>Lokasi Anda</Popup>
        </CircleMarker>
      )}

      <RouteOverlay
        routePath={routePath}
        routePointIds={routePointIds}
        startName={startName}
        destinationName={destinationName}
      />
    </MapContainer>
  )
}

function RouteOverlay({
  routePath,
  routePointIds,
  startName,
  destinationName,
}) {
  const map = useMap()

  React.useEffect(() => {
    if (routePath.length < 2) {
      return
    }

    const bounds = routePath.map(
      ([lat, lon]) => [lat, lon]
    )

    map.fitBounds(bounds, {
      padding: [70, 70],
      maxZoom: 20,
    })
  }, [map, routePath])

  if (routePath.length === 0) {
    return null
  }

  return routePath.map(
    ([lat, lon], index) => {
      const pointId =
        routePointIds[index]

      const isStart = index === 0

      const isFinish =
        index === routePath.length - 1

      return (
        <CircleMarker
          key={`route-point-${pointId}-${index}`}
          center={[lat, lon]}
          radius={
            isStart || isFinish ? 9 : 6
          }
          pathOptions={{
            weight: 3,
            fillOpacity: 0.9,
          }}
        >
          <Popup>
            <div className="text-sm">
              <strong>
                {isStart
                  ? 'Mulai'
                  : isFinish
                    ? 'Tujuan'
                    : `Titik ${pointId}`}
              </strong>

              <div className="mt-1">
                {isStart
                  ? startName
                  : isFinish
                    ? `${destinationName} melalui titik ${pointId}`
                    : 'Ikuti jalur yang disorot.'}
              </div>
            </div>
          </Popup>
        </CircleMarker>
      )
    }
  )
}

function GedungFMIPA({ dataUrl }) {
  const [data, setData] =
    React.useState(null)

  React.useEffect(() => {
    let active = true

    fetch(dataUrl)
      .then((response) => {
        if (!response.ok) {
          throw new Error(
            'Data gedung gagal dimuat.'
          )
        }

        return response.json()
      })
      .then((json) => {
        if (active) {
          setData(json)
        }
      })
      .catch(() => {
        if (active) {
          setData(null)
        }
      })

    return () => {
      active = false
    }
  }, [dataUrl])

  if (!data) {
    return null
  }

  return (
    <GeoJSON
      data={data}
      style={{
        fillOpacity: 0.35,
        weight: 2,
      }}
      onEachFeature={(feature, layer) => {
        layer.bindPopup(
          feature.properties?.nama ||
            'Gedung'
        )
      }}
    />
  )
}

function JalurFMIPA({
  dataUrl,
  routeEdgeIds,
  showAllRoutes,
}) {
  const [data, setData] =
    React.useState(null)

  React.useEffect(() => {
    let active = true

    fetch(dataUrl)
      .then((response) => {
        if (!response.ok) {
          throw new Error(
            'Data jalur gagal dimuat.'
          )
        }

        return response.json()
      })
      .then((json) => {
        if (active) {
          setData(json)
        }
      })
      .catch(() => {
        if (active) {
          setData(null)
        }
      })

    return () => {
      active = false
    }
  }, [dataUrl])

  if (!data) {
    return null
  }

  const routeIds = new Set(
    routeEdgeIds.map(Number)
  )

  const routeFeatures =
    data.features.filter(
      (feature) =>
        routeIds.has(
          Number(feature.properties.id)
        )
    )

  const allFeatures = data.features

  return (
    <>
      {showAllRoutes && (
        <GeoJSON
          key="all-routes"
          data={{
            type: 'FeatureCollection',
            features: allFeatures,
          }}
          style={{
            weight: 3,
            opacity: 0.65,
          }}
        />
      )}

      {routeFeatures.length > 0 && (
        <GeoJSON
          key={`route-${routeEdgeIds.join('-')}`}
          data={{
            type: 'FeatureCollection',
            features: routeFeatures,
          }}
          style={{
            weight: 8,
            opacity: 0.95,
          }}
        />
      )}
    </>
  )
}

function TitikFMIPA({ dataUrl }) {
  const [data, setData] =
    React.useState(null)

  React.useEffect(() => {
    let active = true

    fetch(dataUrl)
      .then((response) => {
        if (!response.ok) {
          throw new Error(
            'Data titik gagal dimuat.'
          )
        }

        return response.json()
      })
      .then((json) => {
        if (active) {
          setData(json)
        }
      })
      .catch(() => {
        if (active) {
          setData(null)
        }
      })

    return () => {
      active = false
    }
  }, [dataUrl])

  if (!data) {
    return null
  }

  return data.features.map(
    (feature) => {
      const [lon, lat] =
        feature.geometry.coordinates

      return (
        <CircleMarker
          key={feature.properties.id}
          center={[lat, lon]}
          radius={7}
          pathOptions={{
            weight: 2,
            fillOpacity: 0.75,
          }}
        >
          <Popup>
            Titik {feature.properties.id}
          </Popup>
        </CircleMarker>
      )
    }
  )
}

export default MapView