import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  base: './', // hasil build bisa diletakkan di folder mana pun (domain utama maupun subfolder)
  plugins: [react(), tailwindcss()],
})
