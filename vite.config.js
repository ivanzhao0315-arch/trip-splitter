import { defineConfig } from 'vite';

export default defineConfig({
  base: process.env.RELATIVE_BASE === 'true'
    ? './'
    : process.env.GITHUB_PAGES === 'true'
      ? '/trip-splitter/'
      : '/',
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/react') || id.includes('node_modules/react-dom')) {
            return 'react';
          }
          if (id.includes('node_modules/@supabase')) {
            return 'supabase';
          }
          if (id.includes('node_modules/@phosphor-icons')) {
            return 'icons';
          }
          if (id.includes('node_modules')) {
            return 'vendor';
          }
          return undefined;
        },
      },
    },
  },
});
