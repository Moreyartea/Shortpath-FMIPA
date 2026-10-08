// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import MapView from '../src/components/MapView'
import { edges, graphData } from './helpers'

// Mock react-leaflet komponen untuk pengujian DOM
vi.mock('react-leaflet', () => ({
  MapContainer: ({ children, className }) => <div className={className}>{children}</div>,
  TileLayer: () => <div data-testid="tile-layer" />,
  ZoomControl: () => <div data-testid="zoom-control" />,
  Polygon: () => <div data-testid="polygon" />,
  Polyline: ({ positions }) => <div data-testid="polyline" data-positions={JSON.stringify(positions)} />,
  Tooltip: ({ children }) => <div>{children}</div>,
  Marker: () => <div data-testid="marker" />,
  Circle: () => <div data-testid="circle" />,
  CircleMarker: () => <div data-testid="circle-marker" />,
  useMap: () => ({
    fitBounds: vi.fn(),
    getZoom: () => 17,
    latLngToContainerPoint: () => ({ x: 100, y: 100 }),
    getContainer: () => document.createElement('div'),
    invalidateSize: vi.fn(),
  }),
  useMapEvents: () => ({}),
}))

describe('Toggle Seluruh Rute di Peta', () => {
  afterEach(cleanup)

  const defaultProps = {
    bentuk: [],
    batas: [[3.5, 98.6], [3.6, 98.7]],
    edges,
    pointsById: graphData.pointsById,
    tampilJalur: false, // Default tidak terlihat
    onToggleJalur: vi.fn(),
    garisRute: null,
    kunciRute: 'kosong',
    asal: null,
    tujuan: null,
    tujuanTempatId: null,
    terpilih: null,
    posisiPengguna: null,
    pilihPeta: null,
    onPilihTempat: vi.fn(),
    onBatalPilih: vi.fn(),
  }

  it('default: seluruh rute tidak terlihat (tampilJalur = false)', () => {
    const { container } = render(<MapView {...defaultProps} tampilJalur={false} />)

    // Polyline untuk seluruh rute tidak boleh dirender
    const polylines = container.querySelectorAll('[data-testid="polyline"]')
    expect(polylines.length).toBe(0)

    // Tombol toggle menampilkan status tidak aktif
    const tombol = screen.getByRole('button', { name: /Tampilkan seluruh rute di peta/i })
    expect(tombol).toBeTruthy()
    expect(tombol.textContent).toContain('Lihat semua rute')
  })

  it('ketika toggle dinyalakan (tampilJalur = true), seluruh rute dirender', () => {
    const { container } = render(<MapView {...defaultProps} tampilJalur={true} />)

    // Polyline untuk seluruh edges dirender
    const polylines = container.querySelectorAll('[data-testid="polyline"]')
    expect(polylines.length).toBe(edges.features.length)

    // Tombol toggle menampilkan status aktif
    const tombol = screen.getByRole('button', { name: /Sembunyikan seluruh rute di peta/i })
    expect(tombol).toBeTruthy()
    expect(tombol.textContent).toContain('Semua rute aktif')
  })

  it('mengklik tombol toggle memanggil onToggleJalur', () => {
    const onToggle = vi.fn()
    render(<MapView {...defaultProps} onToggleJalur={onToggle} />)

    const tombol = screen.getByRole('button', { name: /Tampilkan seluruh rute di peta/i })
    fireEvent.click(tombol)

    expect(onToggle).toHaveBeenCalledTimes(1)
  })
})
