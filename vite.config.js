import { defineConfig } from 'vite';
import exchangeRateHandler from './api/exchange-rate.js';

export default defineConfig({
  plugins: [{
    name: 'local-exchange-rate',
    configureServer(server) {
      server.middlewares.use('/api/exchange-rate', async (req, res) => {
        try {
          const chunks = [];
          for await (const chunk of req) chunks.push(chunk);
          const response = await exchangeRateHandler(new Request('http://localhost/api/exchange-rate', {
            method: req.method,
            headers: { 'Content-Type': 'application/json' },
            ...(req.method === 'POST' ? { body: Buffer.concat(chunks).toString() } : {}),
          }));
          res.writeHead(response.status, Object.fromEntries(response.headers));
          res.end(await response.text());
        } catch {
          res.writeHead(502, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Exchange-rate provider unavailable' }));
        }
      });
    },
  }],
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
