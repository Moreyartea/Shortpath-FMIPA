import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const FOTO_DIR = path.resolve(__dirname, '../src/assets/foto')

async function main() {
  if (!fs.existsSync(FOTO_DIR)) {
    console.error(`Direktori tidak ditemukan: ${FOTO_DIR}`)
    process.exit(1)
  }

  const files = fs.readdirSync(FOTO_DIR)
  const jpgFiles = files.filter((f) => f.toLowerCase().endsWith('.jpg') || f.toLowerCase().endsWith('.jpeg'))

  if (jpgFiles.length === 0) {
    console.log('Tidak ada berkas .jpg di src/assets/foto.')
    return
  }

  console.log(`Ditemukan ${jpgFiles.length} berkas JPG di src/assets/foto\n`)

  // 1. Kumpulkan data awal sebelum mengubah apa pun
  const fotoAwal = []

  for (const file of jpgFiles) {
    const fullPath = path.join(FOTO_DIR, file)
    const stat = fs.statSync(fullPath)
    const sizeKB = (stat.size / 1024).toFixed(2)

    // Dapatkan dimensi setelah orientasi EXIF diterapkan
    const rotatedBuffer = await sharp(fullPath).rotate().toBuffer({ resolveWithObject: true })
    const { width, height } = rotatedBuffer.info

    const aspect = width / height
    const orientasi = aspect > 1.05 ? 'Landscape' : aspect < 0.95 ? 'Portrait' : 'Square'
    const sempit = aspect < 1.2

    fotoAwal.push({
      file,
      id: path.parse(file).name,
      sizeBytes: stat.size,
      sizeKB,
      width,
      height,
      aspect: aspect.toFixed(2),
      orientasi,
      sempit,
      fullPath,
    })
  }

  // Tampilkan tabel sebelum diubah
  console.log('========================================================================================')
  console.log('TABEL FOTO ASLI (SEBELUM DIUBAH)')
  console.log('========================================================================================')
  console.log(
    '| ' +
      'Nama Berkas'.padEnd(24) +
      ' | ' +
      'Ukuran (KB)'.padStart(12) +
      ' | ' +
      'Dimensi (W x H)'.padEnd(17) +
      ' | ' +
      'Orientasi'.padEnd(10) +
      ' | ' +
      'Aspek'.padStart(6) +
      ' | ' +
      'Catatan (Aspek < 1.2)'.padEnd(23) +
      ' |'
  )
  console.log('|' + '-'.repeat(26) + '|' + '-'.repeat(14) + '|' + '-'.repeat(19) + '|' + '-'.repeat(12) + '|' + '-'.repeat(8) + '|' + '-'.repeat(25) + '|')

  for (const item of fotoAwal) {
    const catatan = item.sempit ? (item.orientasi === 'Portrait' ? '⚠️ Portrait (terpotong 4:3)' : '⚠️ Sempit (terpotong 4:3)') : 'OK'
    console.log(
      '| ' +
        item.file.padEnd(24) +
        ' | ' +
        `${item.sizeKB} KB`.padStart(12) +
        ' | ' +
        `${item.width} x ${item.height}`.padEnd(17) +
        ' | ' +
        item.orientasi.padEnd(10) +
        ' | ' +
        item.aspect.padStart(6) +
        ' | ' +
        catatan.padEnd(23) +
        ' |'
    )
  }
  console.log('========================================================================================\n')

  // 2. Eksekusi pengubahan foto ke WebP kualitas 75, max width 1280, tanpa metadata
  console.log('Memproses konversi ke WebP...')
  const fotoHasil = []

  for (const item of fotoAwal) {
    const outputPath = path.join(FOTO_DIR, `${item.id}.webp`)

    let quality = 75
    let buffer = await sharp(item.fullPath)
      .rotate() // terapkan orientasi EXIF
      .resize({ width: 1280, withoutEnlargement: true }) // lebar maksimal 1280
      .webp({ quality, effort: 6 }) // keluaran WebP kualitas 75, tanpa metadata
      .toBuffer()

    // Pastikan ukuran memenuhi batas kritis <= 300 KB
    while (buffer.length > 300 * 1024 && quality > 40) {
      quality -= 5
      buffer = await sharp(item.fullPath)
        .rotate()
        .resize({ width: 1280, withoutEnlargement: true })
        .webp({ quality, effort: 6 })
        .toBuffer()
    }

    fs.writeFileSync(outputPath, buffer)

    // Hapus file JPG asli
    fs.unlinkSync(item.fullPath)

    // Dapatkan info ukuran baru
    const newStat = fs.statSync(outputPath)
    const newMeta = await sharp(outputPath).metadata()
    const newSizeKB = (newStat.size / 1024).toFixed(2)
    const rasioKompresi = (((item.sizeBytes - newStat.size) / item.sizeBytes) * 100).toFixed(1)

    fotoHasil.push({
      file: `${item.id}.webp`,
      id: item.id,
      sizeBytes: newStat.size,
      sizeKB: newSizeKB,
      width: newMeta.width,
      height: newMeta.height,
      hematPersen: rasioKompresi,
      lulus300KB: newStat.size <= 300 * 1024,
      lulus150KB: newStat.size <= 150 * 1024,
    })
  }

  // Tampilkan tabel sesudah diubah
  console.log('\n========================================================================================')
  console.log('TABEL FOTO BARU (WEBP HASIL OPTIMASI)')
  console.log('========================================================================================')
  console.log(
    '| ' +
      'Nama Berkas Baru'.padEnd(24) +
      ' | ' +
      'Ukuran Baru'.padStart(12) +
      ' | ' +
      'Dimensi Baru'.padEnd(15) +
      ' | ' +
      'Hemat (%)'.padStart(10) +
      ' | ' +
      '<= 300 KB'.padEnd(10) +
      ' | ' +
      '<= 150 KB'.padEnd(10) +
      ' |'
  )
  console.log('|' + '-'.repeat(26) + '|' + '-'.repeat(14) + '|' + '-'.repeat(17) + '|' + '-'.repeat(12) + '|' + '-'.repeat(12) + '|' + '-'.repeat(12) + '|')

  let semuaLulus300 = true
  let semuaLulus150 = true

  for (const h of fotoHasil) {
    if (!h.lulus300KB) semuaLulus300 = false
    if (!h.lulus150KB) semuaLulus150 = false

    console.log(
      '| ' +
        h.file.padEnd(24) +
        ' | ' +
        `${h.sizeKB} KB`.padStart(12) +
        ' | ' +
        `${h.width} x ${h.height}`.padEnd(15) +
        ' | ' +
        `${h.hematPersen}%`.padStart(10) +
        ' | ' +
        (h.lulus300KB ? '✓ Lulus' : '✗ Gagal').padEnd(10) +
        ' | ' +
        (h.lulus150KB ? '✓ Ya' : '✗ Belum').padEnd(10) +
        ' |'
    )
  }
  console.log('========================================================================================')
  console.log(`Status Batas Kritis (<= 300 KB): ${semuaLulus300 ? 'SEMUA LULUS ✓' : 'ADA YANG MELEBIHI 300 KB ✗'}`)
  console.log(`Status Target Optimal (<= 150 KB): ${semuaLulus150 ? 'SEMUA LULUS OPTIMAL ✓' : 'BEBERAPA DI ATAS 150 KB (tapi <= 300 KB)'}\n`)
}

main().catch((err) => {
  console.error('Terjadi kesalahan:', err)
  process.exit(1)
})
