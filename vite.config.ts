import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import fs, { copyFileSync, mkdirSync, readdirSync, statSync } from "fs";

// Helper function to copy directories recursively
function copyDir(src: string, dest: string) {
  mkdirSync(dest, { recursive: true });
  const entries = readdirSync(src, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      copyDir(srcPath, destPath);
    } else {
      copyFileSync(srcPath, destPath);
    }
  }
}

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  base: mode === 'production' ? '/' : '/',
  server: {
    // Bind to all interfaces so LAN devices can reach it
    host: true,
    port: 8080,
    // Enable HTTPS automatically when local cert files exist.
    // Create these with mkcert (recommended): certs/localhost.pem + certs/localhost-key.pem
    https: (() => {
      const certDir = path.resolve(__dirname, "certs");
      const certPath = path.join(certDir, "localhost.pem");
      const keyPath = path.join(certDir, "localhost-key.pem");

      if (fs.existsSync(certPath) && fs.existsSync(keyPath)) {
        return {
          cert: fs.readFileSync(certPath),
          key: fs.readFileSync(keyPath),
        };
      }

      return undefined;
    })(),
    // HMR should use the same host users connect with.
    // If you need to force it (some LAN setups), set HMR_HOST env var.
    hmr: {
      host: process.env.HMR_HOST,
      protocol: "wss",
    },
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:3000',
        changeOrigin: true,
        secure: false,
        ws: true, // Enable websocket proxying
        timeout: 300000, // SFTP test/download can take 30–60s+
        proxyTimeout: 300000,
        configure: (proxy, _options) => {
          proxy.on('error', (err, _req, _res) => {
            console.log('proxy error', err);
          });
          proxy.on('proxyReq', (proxyReq, req, _res) => {
            console.log('Proxying request:', req.method, req.url, '→', 'http://127.0.0.1:3000' + req.url);
          });
          proxy.on('proxyRes', (proxyRes, req, _res) => {
            console.log('Proxy response:', req.method, req.url, '→', proxyRes.statusCode);
          });
        }
      }
    }
  },
  plugins: [
    react(),
    // Custom plugin to copy server files to dist
    {
      name: 'copy-server-files',
      closeBundle() {
        // Create server directory in dist
        mkdirSync('dist/server', { recursive: true });
        
        // Copy server files and directories
        const serverItems = [
          { src: 'src/server.js', dest: 'dist/server/server.js' },
          { src: 'src/database', dest: 'dist/server/database', isDir: true },
          { src: 'src/routes', dest: 'dist/server/routes', isDir: true },
          { src: 'src/lib', dest: 'dist/server/lib', isDir: true },
          { src: 'src/middleware', dest: 'dist/server/middleware', isDir: true },
          { src: 'package.json', dest: 'dist/package.json' },
          { src: 'package-lock.json', dest: 'dist/package-lock.json' },
          { src: 'bun.lockb', dest: 'dist/bun.lockb' },
          { src: 'ecosystem.config.js', dest: 'dist/ecosystem.config.js' },
          { src: 'docker-compose.yml', dest: 'dist/docker-compose.yml' },
          { src: 'Dockerfile', dest: 'dist/Dockerfile' }
        ];
        
        serverItems.forEach(item => {
          try {
            if (item.isDir) {
              if (statSync(item.src).isDirectory()) {
                copyDir(item.src, item.dest);
                console.log(`✅ Copied directory ${item.src} to ${item.dest}`);
              }
            } else {
              copyFileSync(item.src, item.dest);
              console.log(`✅ Copied ${item.src} to ${item.dest}`);
            }
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            console.warn(`⚠️ Could not copy ${item.src}:`, errorMessage);
          }
        });
        
        console.log('🚀 Server files copied to dist folder');
      }
    }
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    outDir: 'dist',
    rollupOptions: {
      input: {
        main: path.resolve(__dirname, 'index.html'),
      },
      output: {
        // Ensure server files are not processed by Vite
        manualChunks: undefined,
      },
    },
    // Don't process server files
    exclude: ['src/server.js', 'src/database/**', 'src/routes/**', 'src/lib/**', 'src/middleware/**','src/uploads/**','uploads/**'],
  },
  // Development optimizations
  ...(mode === 'development' && {
    build: {
      sourcemap: true,
    },
  }),
}));
