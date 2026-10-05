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

function MapView() {
  const center = [3.6071, 98.7154]

  return (
    <MapContainer
      center={center}
      zoom={18}
      className="h-full w-full"
    >
      <TileLayer
        attribution='&copy; OpenStreetMap contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />

      <GedungFMIPA dataUrl={gedung} />

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