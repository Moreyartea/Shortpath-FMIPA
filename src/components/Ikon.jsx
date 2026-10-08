// Ikon garis sederhana (inline SVG) agar tidak perlu pustaka tambahan.
const dasar = { fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' }

function Svg({ children, ukuran = 20, ...sisa }) {
  return (
    <svg width={ukuran} height={ukuran} viewBox="0 0 24 24" aria-hidden="true" focusable="false" {...dasar} {...sisa}>
      {children}
    </svg>
  )
}

export const IkonCari = (p) => (<Svg {...p}><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></Svg>)
export const IkonLokasi = (p) => (<Svg {...p}><circle cx="12" cy="12" r="3" /><path d="M12 2v3M12 19v3M2 12h3M19 12h3" /><circle cx="12" cy="12" r="8" /></Svg>)
export const IkonPeta = (p) => (<Svg {...p}><path d="M9 4 3 6v14l6-2 6 2 6-2V4l-6 2-6-2Z" /><path d="M9 4v14M15 6v14" /></Svg>)
export const IkonTutup = (p) => (<Svg {...p}><path d="M18 6 6 18M6 6l12 12" /></Svg>)
export const IkonTukar = (p) => (<Svg {...p}><path d="M7 4v16M7 20l-3-3M7 20l3-3M17 20V4M17 4l-3 3M17 4l3 3" /></Svg>)
export const IkonBagikan = (p) => (<Svg {...p}><circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" /><path d="m8.6 13.5 6.8 4M15.4 6.5l-6.8 4" /></Svg>)
export const IkonBantuan = (p) => (<Svg {...p}><circle cx="12" cy="12" r="9" /><path d="M9.5 9a2.5 2.5 0 1 1 3.5 2.3c-.7.4-1 1-1 1.7M12 17h.01" /></Svg>)
export const IkonPanah = (p) => (<Svg {...p}><path d="m9 6 6 6-6 6" /></Svg>)
export const IkonBawah = (p) => (<Svg {...p}><path d="m6 9 6 6 6-6" /></Svg>)
export const IkonGedung = (p) => (<Svg {...p}><path d="M4 21V5l8-2 8 2v16M4 21h16M9 8h1M14 8h1M9 12h1M14 12h1M9 16h1M14 16h1" /></Svg>)
export const IkonRuang = (p) => (<Svg {...p}><path d="M5 21V8l7-5 7 5v13M10 21v-6h4v6" /></Svg>)
export const IkonKembali = (p) => (<Svg {...p}><path d="m15 18-6-6 6-6" /></Svg>)
export const IkonJalan = (p) => (<Svg {...p}><circle cx="13" cy="4" r="2" /><path d="m9 21 2-6-3-3 2-4 3 1 2 3 3 1M11 15l3 2 1 4" /></Svg>)
export const IkonInfo = (p) => (<Svg {...p}><circle cx="12" cy="12" r="9" /><path d="M12 11v5M12 8h.01" /></Svg>)
