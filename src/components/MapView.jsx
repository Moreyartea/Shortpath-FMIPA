// src/components/MapView.jsx

import React from 'react'
import {
  MapContainer,
  TileLayer,
  CircleMarker,
  Popup,
  GeoJSON,
} from 'react-leaflet'
import 'leaflet/dist/leaflet.css'

import koordinat from '../data/koordinat_fmipa.geojson?url'
import gedung from '../data/gedung_fmipa.geojson?url'
import edges from '../data/edges_fmipa.geojson?url'

function MapView({ routeEdgeIds = [] }) {
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
      />

      <TitikFMIPA dataUrl={koordinat} />
    </MapContainer>
  )
}

function GedungFMIPA({ dataUrl }) {
  const [data, setData] = React.useState(null)

  React.useEffect(() => {
    fetch(dataUrl)
      .then((response) => response.json())
      .then((json) => setData(json))
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
          `<strong>${feature.properties.nama}</strong>`
        )
      }}
    />
  )
}

function JalurFMIPA({ dataUrl, routeEdgeIds }) {
  const [data, setData] = React.useState(null)

  React.useEffect(() => {
    fetch(dataUrl)
      .then((response) => response.json())
      .then((json) => setData(json))
  }, [dataUrl])

  if (!data || routeEdgeIds.length === 0) {
    return null
  }

  const routeIds = new Set(
    routeEdgeIds.map(Number)
  )

  const routeFeatures = data.features.filter(
    (feature) =>
      routeIds.has(Number(feature.properties.id))
  )

  return (
    <GeoJSON
      data={{
        type: 'FeatureCollection',
        features: routeFeatures,
      }}
      style={{
        weight: 7,
        opacity: 0.95,
      }}
    />
  )
}

function TitikFMIPA({ dataUrl }) {
  const [data, setData] = React.useState(null)

  React.useEffect(() => {
    fetch(dataUrl)
      .then((response) => response.json())
      .then((json) => setData(json))
  }, [dataUrl])

  if (!data) {
    return null
  }

  return data.features.map((feature) => {
    const [lon, lat] = feature.geometry.coordinates

    return (
      <CircleMarker
        key={feature.properties.id}
        center={[lat, lon]}
        radius={7}
      >
        <Popup>
          Titik {feature.properties.id}
        </Popup>
      </CircleMarker>
    )
  })
}

export default MapView