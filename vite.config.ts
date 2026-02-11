import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    proxy: {
      '/api/scrapingbee': {
        target: 'https://app.scrapingbee.com/api/v1',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/scrapingbee/, ''),
        secure: true,
        timeout: 60000, // 60 second timeout for long-running scraping
        proxyTimeout: 60000,
        configure: (proxy) => {
          proxy.on('proxyReq', (proxyReq, req) => {
            console.log('Proxying ScrapingBee request to:', proxyReq.path);
          });
          proxy.on('proxyRes', (proxyRes) => {
            const contentType = proxyRes.headers['content-type'] || 'unknown';
            console.log('Proxy response status:', proxyRes.statusCode, 'content-type:', contentType);
          });
        },
      },
    },
  },
  plugins: [
    react(),
    mode === 'development' &&
    componentTagger(),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
