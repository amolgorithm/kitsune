import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import electron from 'vite-plugin-electron/simple'
import { resolve } from 'path'

export default defineConfig(({ command }) => ({
  plugins: [
    react(),
    electron({
      main: {
        entry: 'src/main/index.ts',
        vite: {
          build: {
            sourcemap: true,
            minify: false,
            outDir: 'dist-electron/main',
            rollupOptions: {
              external: ['electron', 'electron-store'],
              output: {
                inlineDynamicImports: true,
                entryFileNames: 'index.js',
              },
            },
          },
        },
      },
      preload: {
        input: 'src/main/preload.ts',
        vite: {
          build: {
            sourcemap: 'inline',
            minify: false,
            outDir: 'dist-electron/preload',
            rollupOptions: {
              external: ['electron'],
              output: {
                inlineDynamicImports: true,
                entryFileNames: 'preload.js',
              },
            },
          },
        },
      },
    }),
  ],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
      '@shared': resolve(__dirname, 'src/shared'),
    },
  },
  base: command === 'serve' ? '/' : './',
  server: {
    strictPort: true,
    port: 5173,
  },
}))
