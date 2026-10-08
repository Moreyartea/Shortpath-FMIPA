// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import KartuRute from '../src/components/KartuRute'
import { graphData, indeks } from './helpers'

describe('KartuRute — Tampilan Instruksi Navigasi Lantai dan Koneksi Khusus', () => {
  afterEach(cleanup)
  const dummyRuteSama = {
    found: true,
    distance: 0,
    path: ['002_p1'],
    startId: '002_p1',
    targetId: '002_p1',
    perbandingan: {
      dijkstra: { distance: 0, visitedCount: 1, ms: 0.1 },
      aStar: { distance: 0, visitedCount: 1, ms: 0.1 },
      selisih: 0,
    },
  }

  const dummyRuteBeda = {
    found: true,
    distance: 45.2,
    path: ['010_p1', '009_p1'],
    startId: '010_p1',
    targetId: '009_p1',
    perbandingan: {
      dijkstra: { distance: 45.2, visitedCount: 2, ms: 0.2 },
      aStar: { distance: 45.2, visitedCount: 2, ms: 0.2 },
      selisih: 0,
    },
  }

  it('menampilkan petunjuk lift/tangga pada gedung sama lantai berbeda', () => {
    const asal = {
      jenis: 'tempat',
      tempat: { id: 'gedung-matematika', nama: 'Gedung Matematika', gedung: [{ kode: '002' }] },
      ruangan: { kodeGedung: '002', lantai: 1, nama: 'Ruang Seminar Lt 1' },
    }
    const tujuan = {
      tempat: { id: 'gedung-matematika', nama: 'Gedung Matematika', gedung: [{ kode: '002' }] },
      ruangan: { kodeGedung: '002', lantai: 5, nama: 'Lab Komputasi Lt 5' },
    }

    render(
      <KartuRute
        rute={dummyRuteSama}
        langkah={[]}
        tujuan={tujuan}
        asal={asal}
        indeks={indeks}
        graphData={graphData}
        onBagikan={() => { }}
      />
    )

    expect(screen.getByText(/Ruang Seminar Lt 1/i)).toBeTruthy()
    expect(screen.getByText(/Lab Komputasi Lt 5/i)).toBeTruthy()
    expect(screen.getByText(/Petunjuk Navigasi Lantai:/i)).toBeTruthy()
    expect(screen.getByText(/Naik ke lantai 5 menggunakan lift atau tangga/i)).toBeTruthy()
  })

  it('menampilkan koridor penghubung pada koneksi langsung 010 Lt 2 -> 009 Lt 2', () => {
    const asal = {
      jenis: 'tempat',
      tempat: { id: 'lab-biologi', nama: 'Lab Biologi', gedung: [{ kode: '010' }] },
      ruangan: { kodeGedung: '010', lantai: 2, nama: 'Lab Ekologi Lt 2' },
    }
    const tujuan = {
      tempat: { id: 'lab-komputer', nama: 'Lab Komputer', gedung: [{ kode: '009' }] },
      ruangan: { kodeGedung: '009', lantai: 2, nama: 'Lab Jaringan Lt 2' },
    }

    render(
      <KartuRute
        rute={dummyRuteBeda}
        langkah={[{ titikId: '010_p1', jenis: 'mulai', teks: 'Mulai dari Lab Biologi' }, { titikId: '009_p1', jenis: 'tiba', teks: 'Tiba di Lab Komputer' }]}
        tujuan={tujuan}
        asal={asal}
        indeks={indeks}
        graphData={graphData}
        onBagikan={() => { }}
      />
    )

    expect(screen.getByText(/Koneksi Antar Gedung:/i)).toBeTruthy()
    expect(screen.getByText(/koridor penghubung lantai 2 Lab\. Biologi dan Lab\. Komputer/i)).toBeTruthy()
    expect(screen.queryByText(/turun ke lantai/i)).toBeNull()
    expect(screen.queryByText(/naik ke lantai/i)).toBeNull()
  })

  it('menampilkan turun lantai lalu koridor pada 010 Lt 3 -> 009 Lt 1', () => {
    const asal = {
      jenis: 'tempat',
      tempat: { id: 'lab-biologi', nama: 'Lab Biologi', gedung: [{ kode: '010' }] },
      ruangan: { kodeGedung: '010', lantai: 3, nama: 'Lab Genetika Lt 3' },
    }
    const tujuan = {
      tempat: { id: 'lab-komputer', nama: 'Lab Komputer', gedung: [{ kode: '009' }] },
      ruangan: { kodeGedung: '009', lantai: 1, nama: 'Lab Multimedia Lt 1' },
    }

    render(
      <KartuRute
        rute={dummyRuteBeda}
        langkah={[{ titikId: '010_p1', jenis: 'mulai', teks: 'Mulai dari Lab Biologi' }, { titikId: '009_p1', jenis: 'tiba', teks: 'Tiba di Lab Komputer' }]}
        tujuan={tujuan}
        asal={asal}
        indeks={indeks}
        graphData={graphData}
        onBagikan={() => { }}
      />
    )

    expect(screen.getByText(/Koneksi Antar Gedung:/i)).toBeTruthy()
    expect(screen.getByText(/turun ke lantai 1 menggunakan tangga/i)).toBeTruthy()
    expect(screen.getByText(/koridor penghubung lantai 1 Lab\. Biologi dan Lab\. Komputer/i)).toBeTruthy()
  })
})
