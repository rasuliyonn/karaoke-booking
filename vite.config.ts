import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// Локальная разработка: `vercel dev` поднимает фронтенд и serverless-функции
// вместе. Если гоняешь C#-бэкенд отдельно, укажи его адрес в API_PROXY.
const apiProxy = process.env.API_PROXY ?? 'http://localhost:5080';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    proxy: {
      '/api': { target: apiProxy, changeOrigin: true },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
  },
});
