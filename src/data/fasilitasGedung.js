// fasilitasGedung.js — data fasilitas gedung FMIPA dan koneksi khusus antar gedung.
// Sumber kebenaran: GEMINI.md bagian "Fasilitas Gedung" dan "Koneksi Khusus Gedung".
// JANGAN mengubah data ini berdasarkan asumsi — hanya dari data eksplisit.

/**
 * Fasilitas setiap gedung berdasarkan kode gedung.
 *
 * - `lantai`: daftar lantai yang ada.
 * - `liftFloors`: daftar lantai yang dilayani lift (kosong jika tidak ada lift).
 * - `tangga`: daftar lantai yang bisa dijangkau tangga.
 *
 * Lift hanya boleh direkomendasikan jika gedung memiliki lift
 * DAN lantai asal DAN lantai tujuan sama-sama dilayani lift.
 */
export const FASILITAS_GEDUNG = {
  '001': { nama: 'Syawal',          lantai: [1, 2, 3],                         liftFloors: [],                                  tangga: [1, 2, 3] },
  '002': { nama: 'Matematika',      lantai: [1, 2, 3, 4, 5, 6, 7, 8],         liftFloors: [1, 2, 3, 4, 5, 6, 7, 8],           tangga: [1, 2, 3, 4, 5, 6, 7, 8] },
  '003': { nama: 'Kimia',           lantai: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],  liftFloors: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],   tangga: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] },
  '004': { nama: 'Fisika',          lantai: [1, 2, 3, 4, 5, 6, 7, 8, 9],      liftFloors: [1, 2, 3, 4, 5, 6, 7, 8],           tangga: [1, 2, 3, 4, 5, 6, 7, 8, 9] },
  '005': { nama: 'Biologi',         lantai: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],  liftFloors: [1, 2, 3, 4, 5, 6, 7, 8],           tangga: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] },
  '006': { nama: 'Bilingual',       lantai: [1, 2],                            liftFloors: [],                                  tangga: [1, 2] },
  '007': { nama: 'Lab Kimia',       lantai: [1, 2, 3],                         liftFloors: [],                                  tangga: [1, 2, 3] },
  '008': { nama: 'Lab Fisika',      lantai: [1, 2, 3, 4],                      liftFloors: [],                                  tangga: [1, 2, 3, 4] },
  '009': { nama: 'Lab Komputer',    lantai: [1, 2, 3],                         liftFloors: [],                                  tangga: [1, 2, 3] },
  '010': { nama: 'Lab Biologi',     lantai: [1, 2, 3, 4],                      liftFloors: [],                                  tangga: [1, 2, 3, 4] },
  '011': { nama: 'Lab Biologi',     lantai: [1, 2, 3, 4],                      liftFloors: [],                                  tangga: [1, 2, 3, 4] },
  '012': { nama: 'Belajar Bersama', lantai: [1, 2],                            liftFloors: [],                                  tangga: [1, 2] },
}

/**
 * Koneksi khusus antar gedung pada lantai tertentu.
 * Jika asal dan tujuan berada pada pasangan ini dan lantainya sama,
 * pengguna TIDAK perlu turun/naik lantai.
 */
export const KONEKSI_GEDUNG = [
  { gedungA: '010', gedungB: '009', lantai: [1, 2, 3] },
  { gedungA: '011', gedungB: '009', lantai: [1, 2, 3] },
]
