import { defineConfig, type Plugin } from 'vite'
import { writeFileSync, mkdirSync } from 'fs'
import { createHash } from 'crypto'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

function versionJsonPlugin(): Plugin {
  return {
    name: 'generate-version-json',
    writeBundle({ dir }) {
      const version = createHash('sha256')
        .update(Date.now().toString() + Math.random().toString())
        .digest('hex')
        .slice(0, 12);
      const outDir = dir || 'dist';
      mkdirSync(outDir, { recursive: true });
      writeFileSync(`${outDir}/version.json`, JSON.stringify({ version }) + '\n');
    },
  };
}

export default defineConfig({
  plugins: [react(), tailwindcss(), versionJsonPlugin()],
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
