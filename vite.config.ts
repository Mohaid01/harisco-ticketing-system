import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

const BACKEND_PORT = process.env.PORT || 8082;

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        target: `http://localhost:${BACKEND_PORT}`,
        changeOrigin: true,
      },
    },
  },
});
