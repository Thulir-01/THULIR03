import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: parseInt(process.env.PORT || '5173'),
    host: '0.0.0.0',
    proxy: {
      '/api': {
        target: process.env.VITE_API_URL || 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
  build: {
    rollupOptions: {
      output: {
        // Stable vendor chunks (rolldown `codeSplitting.groups`): third-party
        // code changes rarely, so browsers can cache these across app releases
        // instead of re-downloading them with every page chunk. lucide-react is
        // deliberately left out — its per-icon tree-shaken chunks are already
        // tiny and shared.
        codeSplitting: {
          groups: [
            {
              name: 'react-vendor',
              test: /node_modules\/(react|react-dom|scheduler|react-router)\//,
            },
            { name: 'axios', test: /node_modules\/axios\// },
            {
              name: 'ui-utils',
              test: /node_modules\/(clsx|class-variance-authority|tailwind-merge)\//,
            },
            { name: 'qrcode', test: /node_modules\/qrcode\// },
            { name: 'jsbarcode', test: /node_modules\/jsbarcode\// },
          ],
        },
      },
    },
  },
});
