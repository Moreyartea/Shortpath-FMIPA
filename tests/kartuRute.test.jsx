// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import KartuRute from '../src/components/KartuRute'
import { aturan, graphData, indeks } from './helpers'
import { hitungRute } from '../src/lib/routing'

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

  it('kimia -> syawal dan matematika -> syawal TIDAK menampilkan "Penyesuaian Jalur"; fisika -> syawal menampilkannya', () => {
    const syawal = { jenis: 'tempat', tempat: indeks.byId.get('syawal'), ruangan: null }
    const kimia = { jenis: 'tempat', tempat: indeks.byId.get('kimia'), ruangan: null }
    const matematika = { jenis: 'tempat', tempat: indeks.byId.get('matematika'), ruangan: null }
    const fisika = { jenis: 'tempat', tempat: indeks.byId.get('fisika'), ruangan: null }

    // 1. kimia -> syawal: tidak ada perubahan rute (sama-sama lobi barat 6), TIDAK menampilkan penyesuaian jalur
    const rKimia = hitungRute(graphData, kimia.tempat.titik, syawal.tempat.titik, aturan)
    const rKimiaTanpa = hitungRute(graphData, kimia.tempat.titikSemua, syawal.tempat.titikSemua, null)
    const { unmount: unmountKimia } = render(
      <KartuRute
        rute={rKimia}
        ruteTanpaAturan={rKimiaTanpa}
        aturan={aturan}
        langkah={[]}
        tujuan={syawal}
        asal={kimia}
        indeks={indeks}
        graphData={graphData}
        onBagikan={() => {}}
      />
    )
    expect(screen.queryByText(/Penyesuaian Jalur:/i)).toBeNull()
    unmountKimia()

    // 2. matematika -> syawal: tidak ada perubahan rute (sama-sama lobi timur 5), TIDAK menampilkan penyesuaian jalur
    const rMatematika = hitungRute(graphData, matematika.tempat.titik, syawal.tempat.titik, aturan)
    const rMatematikaTanpa = hitungRute(graphData, matematika.tempat.titikSemua, syawal.tempat.titikSemua, null)
    const { unmount: unmountMatematika } = render(
      <KartuRute
        rute={rMatematika}
        ruteTanpaAturan={rMatematikaTanpa}
        aturan={aturan}
        langkah={[]}
        tujuan={syawal}
        asal={matematika}
        indeks={indeks}
        graphData={graphData}
        onBagikan={() => {}}
      />
    )
    expect(screen.queryByText(/Penyesuaian Jalur:/i)).toBeNull()
    unmountMatematika()

    // 3. fisika -> syawal: mengubah target dari 7 (pintu utara) ke 6 (lobi barat), MENAMPILKAN penyesuaian jalur
    const rFisika = hitungRute(graphData, fisika.tempat.titik, syawal.tempat.titik, aturan)
    const rFisikaTanpa = hitungRute(graphData, fisika.tempat.titikSemua, syawal.tempat.titikSemua, null)
    expect(rFisikaTanpa.targetId).toBe(7)
    expect(rFisika.targetId).toBe(6)
    const { unmount: unmountFisika } = render(
      <KartuRute
        rute={rFisika}
        ruteTanpaAturan={rFisikaTanpa}
        aturan={aturan}
        langkah={[]}
        tujuan={syawal}
        asal={fisika}
        indeks={indeks}
        graphData={graphData}
        onBagikan={() => {}}
      />
    )
    expect(screen.getByText(/Penyesuaian Jalur:/i)).toBeTruthy()
    expect(screen.getByText(/Pintu utara Gedung Syawal tidak dibuka/i)).toBeTruthy()
    unmountFisika()
  })

  it('asal di tempat yang memiliki pintuTertutup (syawal -> fisika) menampilkan "Penyesuaian Jalur"', () => {
    const syawal = { jenis: 'tempat', tempat: indeks.byId.get('syawal'), ruangan: null }
    const fisika = { jenis: 'tempat', tempat: indeks.byId.get('fisika'), ruangan: null }

    const rute = hitungRute(graphData, syawal.tempat.titik, fisika.tempat.titik, aturan)
    const ruteTanpaAturan = hitungRute(graphData, syawal.tempat.titikSemua, fisika.tempat.titikSemua, null)

    // Tanpa aturan keluar lewat pintu 7, dengan aturan keluar lewat pintu 6
    expect(ruteTanpaAturan.startId).toBe(7)
    expect(rute.startId).toBe(6)

    render(
      <KartuRute
        rute={rute}
        ruteTanpaAturan={ruteTanpaAturan}
        aturan={aturan}
        langkah={[]}
        tujuan={fisika}
        asal={syawal}
        indeks={indeks}
        graphData={graphData}
        onBagikan={() => {}}
      />
    )

    expect(screen.getByText(/Penyesuaian Jalur:/i)).toBeTruthy()
    expect(screen.getByText(/Pintu utara Gedung Syawal tidak dibuka/i)).toBeTruthy()
  })

  it('taman-biologi -> syawal TIDAK menampilkan alasan "Pintu utara ...", tetapi menampilkan alasan Rumah Kaca pada rute yang berubah karena 18 (taman-biologi -> fisika)', () => {
    const syawal = { jenis: 'tempat', tempat: indeks.byId.get('syawal'), ruangan: null }
    const tamanBiologi = { jenis: 'tempat', tempat: indeks.byId.get('taman-biologi'), ruangan: null }
    const fisika = { jenis: 'tempat', tempat: indeks.byId.get('fisika'), ruangan: null }

    // 1. taman-biologi -> syawal: tidak memilih pintu 7 dan tidak melewati 18, TIDAK menampilkan alasan Pintu utara maupun Rumah Kaca
    const rKeSyawal = hitungRute(graphData, tamanBiologi.tempat.titik, syawal.tempat.titik, aturan)
    const rKeSyawalTanpa = hitungRute(graphData, tamanBiologi.tempat.titikSemua, syawal.tempat.titikSemua, null)
    expect(rKeSyawalTanpa.targetId).toBe(6)
    expect(rKeSyawalTanpa.path.slice(1, -1)).not.toContain(18)

    const { unmount: unmountSyawal } = render(
      <KartuRute
        rute={rKeSyawal}
        ruteTanpaAturan={rKeSyawalTanpa}
        aturan={aturan}
        langkah={[]}
        tujuan={syawal}
        asal={tamanBiologi}
        indeks={indeks}
        graphData={graphData}
        onBagikan={() => {}}
      />
    )
    expect(screen.queryByText(/Penyesuaian Jalur:/i)).toBeNull()
    expect(screen.queryByText(/Pintu utara Gedung Syawal tidak dibuka/i)).toBeNull()
    expect(screen.queryByText(/Rumah Kaca/i)).toBeNull()
    unmountSyawal()

    // 2. taman-biologi -> fisika: ruteTanpaAturan melewati 18 di tengah, MENAMPILKAN alasan Rumah Kaca
    const rKeFisika = hitungRute(graphData, tamanBiologi.tempat.titik, fisika.tempat.titik, aturan)
    const rKeFisikaTanpa = hitungRute(graphData, tamanBiologi.tempat.titikSemua, fisika.tempat.titikSemua, null)
    expect(rKeFisikaTanpa.path.slice(1, -1)).toContain(18)
    expect(rKeFisika.path.slice(1, -1)).not.toContain(18)

    const { unmount: unmountFisika } = render(
      <KartuRute
        rute={rKeFisika}
        ruteTanpaAturan={rKeFisikaTanpa}
        aturan={aturan}
        langkah={[]}
        tujuan={fisika}
        asal={tamanBiologi}
        indeks={indeks}
        graphData={graphData}
        onBagikan={() => {}}
      />
    )
    expect(screen.getByText(/Penyesuaian Jalur:/i)).toBeTruthy()
    expect(screen.getByText(/Rumah Kaca hanya menjadi titik awal atau tujuan/i)).toBeTruthy()
    expect(screen.queryByText(/Pintu utara Gedung Syawal tidak dibuka/i)).toBeNull()
    unmountFisika()
  })
})
