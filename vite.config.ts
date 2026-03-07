import { defineConfig, type Plugin } from 'vite'
import { writeFileSync } from 'fs'
import { resolve } from 'path'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

/** Writes public/version.json and injects __APP_VERSION_HASH__ at build time. */
function versionPlugin(): Plugin {
  const hash = Date.now().toString(36);
  return {
    name: 'version-json',
    config() {
      return { define: { __APP_VERSION_HASH__: JSON.stringify(hash) } };
    },
    buildStart() {
      writeFileSync(
        resolve(__dirname, 'public/version.json'),
        JSON.stringify({ hash }),
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
