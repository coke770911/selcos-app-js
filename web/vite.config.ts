import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import UnoCSS from 'unocss/vite';

export default defineConfig({
  plugins: [vue(), UnoCSS()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  // 打包結果直接放進後端，由 Express 提供（正式環境只有一個 port）
  build: {
    outDir: fileURLToPath(new URL('../server/public', import.meta.url)),
    emptyOutDir: true,
  },
  server: {
    port: 5173,
    // 開發時用 Vite 即時更新畫面，/api 轉給本機 Node
    proxy: { '/api': 'http://localhost:3000' },
  },
});
