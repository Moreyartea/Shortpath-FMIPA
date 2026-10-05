export const BUILDINGS = [
  { graphId: '001', code: '004', name: 'Gedung Fisika', floors: 8 },
  { graphId: '002', code: '005', name: 'Gedung Biologi', floors: 10 },
  { graphId: '003', code: '002', name: 'Gedung Matematika', floors: 8 },
  { graphId: '004', code: '003', name: 'Gedung Kimia', floors: 10 },
  { graphId: '005', code: '001', name: 'Gedung Syawal', floors: 3 },
  { graphId: '006', code: '007', name: 'Lab. Kimia', floors: 3 },
  { graphId: '007', code: '009', name: 'Lab. Komputer', floors: 3 },
  { graphId: '008', code: '010/011', name: 'Lab. Biologi', floors: 5 },
  { graphId: '009', code: '012', name: 'Gedung Belajar Bersama', floors: 2 },
  { graphId: '010', code: '008', name: 'Lab. Fisika', floors: 4 },
  { graphId: '011', code: '006', name: 'Gedung Bilingual', floors: 2 },
  { graphId: '012', code: '-', name: 'Rumah Kaca', floors: 1 },
  { graphId: '013', code: '-', name: 'Rumah Hewan FMIPA', floors: 1 },
  { graphId: '014', code: '-', name: 'Taman Biologi', floors: 1 },
  { graphId: '015', code: '-', name: 'Ruang Serbaguna Taman Biologi', floors: 1 },
]

export const OFFICIAL_TO_GRAPH = {
  '001': '005',
  '002': '003',
  '003': '004',
  '004': '001',
  '005': '002',
  '006': '011',
  '007': '006',
  '008': '010',
  '009': '007',
  '010': '008',
  '011': '008',
  '012': '009',
}

export function getBuildingByGraphId(id) {
  return BUILDINGS.find((building) => building.graphId === String(id)) || null
}

export function getBuildingByCode(code) {
  return BUILDINGS.find((building) => building.code === String(code)) || null
}
