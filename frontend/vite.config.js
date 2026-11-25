import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  // La carpeta `public/` del repositorio guarda el emblema y el favicon.
  publicDir: '../public',
  plugins: [react()],
  server: {
    host: true,
    port: 5173,
  },
});
