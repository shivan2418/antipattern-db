import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    fs: {
      // Allow serving files from the artist-db folder
      allow: ['..', 'src/artist-db'],
    },
  },
  // Configure static asset handling
  assetsInclude: ['**/artist-db/**/*.json'],
});
