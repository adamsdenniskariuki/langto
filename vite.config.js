import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';

// Served from the root of a custom domain (langto.madebyfavor.com), so base is '/'.
export default defineConfig({
  base: '/',
  plugins: [preact()],
  build: { target: 'es2020', sourcemap: true },
  test: { environment: 'node', include: ['tests/**/*.test.js'] },
});
