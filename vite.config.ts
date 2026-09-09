import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// En GitHub Pages (repo de proyecto) el sitio vive en /msal-front/.
// El workflow define VITE_BASE_PATH=/msal-front/. En local queda "/".
const base = process.env.VITE_BASE_PATH ?? '/'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  base,
})
