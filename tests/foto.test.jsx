// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { render, screen, cleanup } from '@testing-library/react'
import tempatJson from '../src/data/tempat.json'
import { ambilFotoTempat, adaFotoTempat } from '../src/lib/foto'
import DetailTempat from '../src/components/DetailTempat'
import KartuRute from '../src/components/KartuRute'
import { indeks, graphData } from './helpers'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const FOTO_DIR = path.resolve(__dirname, '../src/assets/foto')

describe('Aset Foto Gedung dan Fasilitas FMIPA', () => {
  afterEach(cleanup)

  const berkasFoto = fs.readdirSync(FOTO_DIR).filter((f) => f.endsWith('.webp'))
  const idTempatList = tempatJson.map((t) => t.id)

  it('semua tempat di tempat.json memiliki berkas foto .webp yang sesuai', () => {
    for (const id of idTempatList) {
      const namaBerkas = `${id}.webp`
      expect(berkasFoto).toContain(namaBerkas)
      expect(fs.existsSync(path.join(FOTO_DIR, namaBerkas))).toBe(true)
    }
  })

  it('tidak ada berkas foto liar (semua berkas foto cocok dengan id tempat di tempat.json)', () => {
    for (const f of berkasFoto) {
      const id = f.replace(/\.webp$/, '')
      expect(idTempatList).toContain(id)
    }
    expect(berkasFoto.length).toBe(idTempatList.length)
  })

  it('semua berkas foto WebP berukuran <= 300 KB (batas kritis)', () => {
    for (const f of berkasFoto) {
      const fullPath = path.join(FOTO_DIR, f)
      const stat = fs.statSync(fullPath)
      const ukuranKB = stat.size / 1024
      expect(ukuranKB).toBeLessThanOrEqual(300)
    }
  })

  it('modul foto.js memetakan semua tempat dengan benar', () => {
    for (const id of idTempatList) {
      expect(adaFotoTempat(id)).toBe(true)
      const url = ambilFotoTempat(id)
      expect(typeof url).toBe('string')
      expect(url.length).toBeGreaterThan(0)
    }

    expect(ambilFotoTempat('tempat-tidak-ada')).toBeNull()
    expect(ambilFotoTempat(null)).toBeNull()
    expect(ambilFotoTempat('')).toBeNull()
    expect(adaFotoTempat('tempat-tidak-ada')).toBe(false)
  })

  it('komponen DetailTempat menampilkan foto gedung dengan alt yang tepat', () => {
    const tempat = indeks.byId.get('syawal')
    render(
      <DetailTempat
        tempat={tempat}
        indeks={indeks}
        graph={graphData.graph}
        ruangan={[]}
        aturan={null}
        onKembali={() => {}}
        onRuteKe={() => {}}
        onRuteDari={() => {}}
        onBuka={() => {}}
        onPilihRuangan={() => {}}
      />
    )

    const img = screen.getByRole('img', { name: `Foto ${tempat.nama}` })
    expect(img).toBeTruthy()
    expect(img.getAttribute('src')).toBe(ambilFotoTempat(tempat.id))
  })

  it('komponen KartuRute menampilkan foto tempat tujuan', () => {
    const syawal = indeks.byId.get('syawal')
    const tujuan = { jenis: 'tempat', tempat: syawal, ruangan: null }
    const asal = { jenis: 'tempat', tempat: indeks.byId.get('matematika'), ruangan: null }
    const rute = {
      found: true,
      distance: 85,
      path: [3, 5],
      startId: 3,
      targetId: 5,
      perbandingan: {
        dijkstra: { distance: 85, visitedCount: 5, ms: 0.1 },
        aStar: { distance: 85, visitedCount: 4, ms: 0.1 },
        selisih: 0,
      },
    }

    render(
      <KartuRute
        rute={rute}
        langkah={[{ titikId: 3, jenis: 'mulai', teks: 'Mulai dari Gedung Matematika' }, { titikId: 5, jenis: 'tiba', teks: 'Tiba di Gedung Syawal' }]}
        tujuan={tujuan}
        asal={asal}
        indeks={indeks}
        graphData={graphData}
        onBagikan={() => {}}
      />
    )

    const img = screen.getByRole('img', { name: `Foto ${syawal.nama}` })
    expect(img).toBeTruthy()
    expect(screen.getByText(`Tampak ${syawal.nama}`)).toBeTruthy()
  })
})
