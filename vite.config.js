import { defineConfig, loadEnv } from 'vite';
import vue from '@vitejs/plugin-vue';

export default defineConfig(({ mode }) => ({
  plugins: [vue()],
  base: loadEnv(mode, process.cwd(), '').VITE_BASE_PATH || './',
  server: { host: '127.0.0.1', port: 5173, strictPort: true },
  preview: { host: '127.0.0.1', port: 4173, strictPort: true },
  build: { rollupOptions: { output: { manualChunks(id) {
    if (id.includes('/node_modules/primevue/') || id.includes('/node_modules/@primeuix/')) return 'primevue';
    if (id.includes('/node_modules/vue/') || id.includes('/node_modules/@vue/') || id.includes('/node_modules/vue-router/')) return 'vue';
  } } } },
}));
