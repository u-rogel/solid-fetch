import { defineConfig } from 'vite';
import tsConfigPaths from 'vite-tsconfig-paths'

export default defineConfig({
  plugins: [tsConfigPaths()],
  build: {
    lib: {
      entry: './src/index.ts',
      name: 'SolidFetch',
      formats: ['es', 'cjs'],
      fileName: (format) => (format === 'es' ? 'index.min.mjs' : 'index.min.cjs'),
    },
    // rollupOptions: {
    //   external: ['tslib'], // Mark tslib as external
    //   output: {
    //     globals: {
    //       tslib: 'tslib',
    //     },
    //   },
    // },
  },
});