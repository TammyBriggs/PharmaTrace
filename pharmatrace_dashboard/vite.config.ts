import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// In dev, /api is proxied to an Express server so the browser never makes a cross-origin call.
// By default that is your own laptop (http://localhost:3000). To use the hosted backend instead,
// put VITE_DEV_API=https://pharmatrace-bf19.onrender.com in pharmatrace_dashboard/.env.local and restart `npm run dev`.
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const target = (env.VITE_DEV_API || 'http://localhost:3000').replace(/\/+$/, '').replace(/\/api$/, '');
  return {
    plugins: [react(), tailwindcss()],
    server: {
      port: 5173,
      proxy: { '/api': { target, changeOrigin: true, secure: true } },
    },
  };
});
