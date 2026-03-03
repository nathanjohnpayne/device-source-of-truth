import { defineConfig, type Plugin } from 'vite'
import { writeFileSync } from 'fs'
import { resolve } from 'path'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

/** Writes public/version.json at build time so the poller can detect stale clients. */
function versionPlugin(): Plugin {
  return {
    name: 'version-json',
    buildStart() {
      const version = { hash: Date.now().toString(36) };
      writeFileSync(
        resolve(__dirname, 'public/version.json'),
        JSON.stringify(version),
      );
    },
  };
}

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    versionPlugin(),
    VitePWA({
      registerType: 'prompt',
      injectRegister: 'auto',
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
      },
      manifest: {
        name: 'Device Source of Truth',
        short_name: 'DST',
        theme_color: '#ffffff',
      },
    }),
  ],
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          firebase: ['firebase/app', 'firebase/auth', 'firebase/firestore', 'firebase/analytics'],
          recharts: ['recharts'],
          router: ['react-router-dom'],
        },
      },
    },
  },
})
