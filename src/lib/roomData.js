export const FLOOR_COUNTS = {
  '001': 3,
  '002': 8,
  '003': 10,
  '004': 8,
  '005': 10,
  '006': 2,
  '007': 3,
  '008': 4,
  '009': 3,
  '010': 5,
  '011': 4,
  '012': 2,
  '013': 1,
  '014': 1,
  '015': 1,
}

export const BUILDING_DISPLAY = {
  '001': { kode: '001', nama: 'Gedung Syawal' },
  '002': { kode: '002', nama: 'Gedung Matematika' },
  '003': { kode: '003', nama: 'Gedung Kimia' },
  '004': { kode: '004', nama: 'Gedung Fisika' },
  '005': { kode: '005', nama: 'Gedung Biologi' },
  '006': { kode: '006', nama: 'Gedung Bilingual' },
  '007': { kode: '007', nama: 'Lab. Kimia' },
  '008': { kode: '008', nama: 'Lab. Fisika' },
  '009': { kode: '009', nama: 'Lab. Komputer' },
  '010': { kode: '010/011', nama: 'Lab. Biologi' },
  '011': { kode: '011', nama: 'Lab. Biologi' },
  '012': { kode: '012', nama: 'Gedung Belajar Bersama' },
  '013': { kode: '013', nama: 'Rumah Hewan FMIPA' },
  '014': { kode: '014', nama: 'Taman Biologi' },
  '015': { kode: '015', nama: 'Ruang Serbaguna Taman Biologi' },
  'RUMAH-KACA': { kode: '-', nama: 'Rumah Kaca' },
}

export function displayBuilding(buildingId, fallbackName = '') {
  return BUILDING_DISPLAY[String(buildingId)] || { kode: '-', nama: fallbackName }
}
