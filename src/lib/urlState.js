// urlState.js - menyimpan pilihan rute di alamat halaman supaya bisa dibagikan.

export function bacaUrl(search = '') {
  const p = new URLSearchParams(search)
  return { dari: p.get('dari') || '', ke: p.get('ke') || '', ruang: p.get('ruang') || '' }
}

export function tulisUrl({ dari = '', ke = '', ruang = '' }) {
  const p = new URLSearchParams()
  if (dari) p.set('dari', dari)
  if (ke) p.set('ke', ke)
  if (ke && ruang) p.set('ruang', ruang)
  const s = p.toString()
  return s ? `?${s}` : ''
}
